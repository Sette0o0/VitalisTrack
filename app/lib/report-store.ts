import { buildHealthReport, reportWindow, toDisplayDistance, toDisplayWeight, type TimelineCursor, type TimelineKind, type TimelinePage, type ReportPeriod, type UnitSystem, type HealthHistory } from "@vitalis/contracts";
import { getDatabase } from "./local-database";
export async function readReport(userId: string, profileId: string, period: ReportPeriod, date: string, goals: {
    waterMl: number;
    steps: number;
}) {
    const db = await getDatabase(), range = reportWindow(period, date);
    const rows = await db.getAllAsync<{
        kind: string;
        day: string;
        total: number;
        duration: number;
        distance: number;
        count: number;
    }>(`SELECT kind,day,
    SUM(CASE kind WHEN 'water' THEN json_extract(record,'$.amountMl') WHEN 'meal' THEN json_extract(record,'$.calories') WHEN 'steps' THEN json_extract(record,'$.steps') WHEN 'activity' THEN json_extract(record,'$.calories') ELSE 0 END) total,
    AVG(CASE kind WHEN 'weight' THEN json_extract(record,'$.weightKg') ELSE 0 END) weight,
    SUM(COALESCE(json_extract(record,'$.durationSeconds'),json_extract(record,'$.durationMinutes')*60,0)) duration,
    SUM(COALESCE(json_extract(record,'$.distanceMeters'),json_extract(record,'$.distanceKm')*1000,0)) distance, COUNT(*) count
    FROM health_records WHERE user_id=? AND profile_id=? AND day>=? AND day<=? GROUP BY kind,day`, userId, profileId, range.start, range.end);
    const history: HealthHistory = { water: [], meals: [], activities: [], weights: [], steps: [] };
    for (const row of rows) {
        const common = { id: row.day, date: row.day };
        if (row.kind === "water")
            history.water.push({ ...common, amountMl: row.total });
        if (row.kind === "meal")
            history.meals.push({ ...common, name: "Total diário", calories: row.total });
        if (row.kind === "steps")
            history.steps.push({ date: row.day, steps: row.total });
        if (row.kind === "weight")
            history.weights.push({ ...common, weightKg: (row as unknown as {
                    weight: number;
                }).weight });
        if (row.kind === "activity")
            history.activities.push({ ...common, type: "summary", calories: row.total, durationSeconds: row.duration, distanceMeters: row.distance, count: row.count });
    }
    return buildHealthReport(history, period, date, goals);
}
export async function listTimeline(userId: string, profileId: string, filter?: TimelineKind, cursor?: TimelineCursor, limit = 30, units: UnitSystem = "metric"): Promise<TimelinePage> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{
        day: string;
        time: string;
        kind: TimelineKind;
        id: string;
        record: string;
    }>(`WITH items AS (
    SELECT day,time,kind,id,record FROM health_records WHERE user_id=? AND profile_id=? AND kind IN ('meal','activity','weight')
    UNION ALL
    SELECT date(json_extract(record,'$.data.occurredAt'),'localtime'),time(json_extract(record,'$.data.occurredAt'),'localtime'),'mood',id,json_extract(record,'$.data')
    FROM wellbeing_records WHERE user_id=? AND profile_id=? AND kind='mood' AND deleted=0
    ) SELECT * FROM items WHERE 1=1 ${filter ? "AND kind=?" : ""} ${cursor ? "AND (day,time,kind,id)<(?,?,?,?)" : ""}
    ORDER BY day DESC,time DESC,kind DESC,id DESC LIMIT ?`, userId, profileId, userId, profileId, ...(filter ? [filter] : []), ...(cursor ? [cursor.date, cursor.time, cursor.kind, cursor.id] : []), Math.min(100, limit) + 1);
    const number = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
    const records = rows.slice(0, Math.min(100, limit)).map(row => {
        const r = JSON.parse(row.record);
        const title = row.kind === "meal" ? r.name : row.kind === "activity" ? ({ walk: "Caminhada", run: "Corrida", cycling: "Ciclismo" } as Record<string, string>)[r.type] : row.kind === "weight" ? "Pesagem" : "Humor";
        const detail = row.kind === "meal" ? `${number(r.calories)} kcal · ${number(r.quantity)} ${r.unit}` : row.kind === "activity" ? `${number((r.durationSeconds ?? r.durationMinutes * 60) / 60)} min · ${number(toDisplayDistance((r.distanceMeters ?? r.distanceKm * 1000) / 1000, units))} ${units === "imperial" ? "mi" : "km"} · ${number(r.calories)} kcal` : row.kind === "weight" ? `${number(toDisplayWeight(r.weightKg, units))} ${units === "imperial" ? "lb" : "kg"}` : `${r.score}/5${r.notes ? " · " + r.notes : ""}`;
        return { date: row.day, time: row.time, kind: row.kind, id: row.id, title: title ?? "Atividade", detail };
    });
    const last = records.at(-1);
    return { records, nextCursor: rows.length > limit && last ? { date: last.date, time: last.time, kind: last.kind, id: last.id } : undefined };
}
export function csvCell(value: unknown, text = false) {
    let s = value === null || value === undefined ? "" : String(value);
    if (text && /^[\s\u0000-\u001f]*[=+@-]/.test(s))
        s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
}
export const CSV_HEADER = ["tipo", "perfil_id", "registro_id", "data", "horario", "nome_ou_atividade", "peso_kg", "duracao_segundos", "distancia_m", "quantidade", "unidade", "calorias_kcal"];
export function healthCsvRow(kind: string, profileId: string, r: Record<string, unknown>) {
    const values = [kind, profileId, r.id, r.date, r.time ?? "", r.name ?? r.type ?? "", r.weightKg ?? "", kind === "activity" ? r.durationSeconds ?? Number(r.durationMinutes) * 60 : "", kind === "activity" ? r.distanceMeters ?? Number(r.distanceKm) * 1000 : "", r.quantity ?? "", r.unit ?? "", r.calories ?? ""];
    return values.map((value, i) => csvCell(value, [0, 1, 2, 4, 5, 10].includes(i))).join(",") + "\r\n";
}

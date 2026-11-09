import { getDatabase } from "./local-database";
import { moodLabel } from "./wellbeing-display";
export async function dailyReportExtras(userId: string, profileId: string, date: string) {
    const db = await getDatabase(), rows = await db.getAllAsync<{
        kind: string;
        record: string;
    }>(`SELECT kind,record FROM wellbeing_records WHERE user_id=? AND profile_id=? AND deleted=0 AND ((kind='sleep' AND json_extract(record,'$.data.date')=?) OR (kind IN ('bloodPressure','mood') AND date(json_extract(record,'$.data.occurredAt'),'localtime')=?)) ORDER BY datetime(json_extract(record,'$.data.occurredAt')) DESC,id DESC`, userId, profileId, date, date);
    const texts: string[] = [], sleep = rows.filter(r => r.kind === "sleep");
    if (sleep.length) {
        const minutes = sleep.reduce((sum, r) => sum + JSON.parse(r.record).data.durationMinutes, 0);
        texts.push(`Sono registrado: ${Math.floor(minutes / 60)} h ${minutes % 60} min (${sleep.length} registros).`);
    }
    const pressure = rows.find(r => r.kind === "bloodPressure"), mood = rows.find(r => r.kind === "mood");
    if (pressure) {
        const data = JSON.parse(pressure.record).data;
        texts.push(`Última pressão registrada no dia: ${data.systolic}/${data.diastolic} mmHg.`);
    }
    if (mood)
        texts.push(`Último humor registrado no dia: ${moodLabel(JSON.parse(mood.record).data.score)}.`);
    return texts;
}

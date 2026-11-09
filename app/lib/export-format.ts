import { toDisplayDistance, toDisplayWeight, type HealthReport, type UnitSystem } from "@vitalis/contracts";
import type { AppState } from "@/state/types";
export const htmlEscape = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const number = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
export function reportHtml(report: HealthReport, name: string, units: UnitSystem, pending: boolean, extras: string[] = []) {
    const weight = units === "imperial" ? "lb" : "kg", distance = units === "imperial" ? "mi" : "km";
    const rows = report.days.map(p => `<tr><td>${p.date.split("-").reverse().join("/")}</td><td>${p.hasWater ? number(p.waterMl / 1000) : "—"}</td><td>${p.hasSteps ? number(p.steps) : "—"}</td><td>${p.weightKg === null ? "—" : number(toDisplayWeight(p.weightKg, units))}</td><td>${p.hasMeals ? number(p.consumedKcal) : "—"}</td><td>${p.activityCount ? number(p.activityKcal) : "—"}</td><td>${p.activityCount}</td><td>${number(p.durationSeconds / 60)}</td><td>${number(toDisplayDistance(p.distanceMeters / 1000, units))}</td></tr>`).join("");
    const title = report.period === "day" ? "Resumo diário" : report.period === "week" ? "Relatório semanal" : "Relatório mensal";
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${title}</title><style>
  @page{size:A4;margin:12mm}body{font-family:sans-serif;font-size:11px;color:#142b34;margin:0}h1{font-size:22px}h2{font-size:15px}p,li{line-height:1.5}table{border-collapse:collapse;width:100%;font-size:9px}th,td{border:1px solid #c4d2d5;padding:5px;text-align:right;overflow-wrap:anywhere}th{background:#e8f4f1}thead{display:table-header-group}tr{page-break-inside:avoid}.note{color:#465b63}h1,h2{page-break-after:avoid}</style></head><body>
  <h1>VitalisTrack · ${title}</h1><h2>${htmlEscape(name)}</h2><p>${report.start} a ${report.end}</p>
  <p class="note">${pending ? "Sincronização pendente. " : ""}Valores ausentes são indicados por —.</p>
  <p><strong>Calorias gastas: somente atividades registradas.</strong> O gasto basal não foi somado. Peso diário: média das pesagens.</p>
  <p>Totais: água ${number(report.totals.waterMl / 1000)} L; ${number(report.totals.steps)} passos; alimentação ${number(report.totals.consumedKcal)} kcal; atividades ${number(report.totals.activityKcal)} kcal; ${report.totals.activityCount} ${report.totals.activityCount===1?"atividade":"atividades"}, ${number(report.totals.durationSeconds / 60)} minutos.</p>
  <table><thead><tr><th>Data</th><th>Água L</th><th>Passos</th><th>Peso ${weight}</th><th>Consumo kcal</th><th>Atividades kcal</th><th>Qtd.</th><th>Min.</th><th>Dist. ${distance}</th></tr></thead><tbody>${rows}</tbody></table>
  <h2>Acompanhamento</h2><ul>${[...report.text, ...extras].map(s => `<li>${htmlEscape(s)}</li>`).join("")}</ul>
  <p class="note">Resumo descritivo dos registros. Não inclui diagnósticos nem documentos médicos anexados.</p></body></html>`;
}
export function backupProfileDetails(profile: AppState["profile"], avatarBlobId?: string) {
    return { name: profile.name, email: profile.email, birthDate: profile.birthDate || null, weightKg: profile.hasWeight === false ? null : profile.weightKg, heightCm: profile.hasHeight === false ? null : profile.heightCm, gender: profile.gender, ...(avatarBlobId ? { avatarBlobId } : {}) };
}
const pick = (r: Record<string, unknown>, keys: string[]) => Object.fromEntries(keys.filter(k => r[k] !== undefined).map(k => [k, r[k]]));
export function backupHealthRow(kind: string, r: Record<string, unknown>) {
    const base = pick(r, ["id", "date", "createdAt", "updatedAt"]);
    if (kind === "water")
        return { ...base, ...pick(r, ["time", "amountMl"]) };
    if (kind === "meal")
        return { ...base, ...pick(r, ["name", "time", "quantity", "unit", "calories", "nutrition"]) };
    if (kind === "weight")
        return { ...base, weightKg: r.weightKg };
    if (kind === "steps")
        return { date: r.date, steps: r.steps };
    return { ...base, ...pick(r, ["type", "calories", "visibility", "heartRate"]), durationSeconds: r.durationSeconds ?? Number(r.durationMinutes) * 60, distanceMeters: r.distanceMeters ?? Number(r.distanceKm) * 1000,
        route: Array.isArray(r.route) ? r.route.map(p => pick(p, ["latitude", "longitude", "altitude", "accuracy", "timestamp"])) : [] };
}

import { z } from "zod";
export const documentMimeSchema = z.enum(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
export const medicalDocumentSchema = z.object({
    id: z.uuid(), profileId: z.uuid(), name: z.string().min(1).max(180),
    mimeType: documentMimeSchema, size: z.number().int().positive().max(DOCUMENT_MAX_BYTES),
    sha256: z.string().regex(/^[a-f0-9]{64}$/), createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }), deletedAt: z.iso.datetime({ offset: true }).nullable(),
    revision: z.string().regex(/^\d+$/),
});
export type MedicalDocument = z.infer<typeof medicalDocumentSchema>;
export type DocumentChanges = {
    records: MedicalDocument[];
    cursor: string;
    hasMore: boolean;
};
export type ReportPeriod = "day" | "week" | "month";
export const reportQuerySchema = z.object({ period: z.enum(["day", "week", "month"]), date: z.iso.date() });
export type TimelineKind = "meal" | "activity" | "weight" | "mood";
export type TimelineCursor = {
    date: string;
    time: string;
    kind: TimelineKind;
    id: string;
};
export type TimelineItem = TimelineCursor & {
    title: string;
    detail: string;
};
export type TimelinePage = {
    records: TimelineItem[];
    nextCursor?: TimelineCursor;
};
export type HealthHistory = {
    water: {
        id: string;
        date: string;
        amountMl: number;
        time?: string;
    }[];
    meals: {
        id: string;
        date: string;
        time?: string;
        name: string;
        calories: number;
        quantity?: number;
        unit?: string;
    }[];
    activities: {
        id: string;
        date: string;
        type: string;
        calories: number;
        durationSeconds: number;
        distanceMeters: number;
        count?: number;
    }[];
    weights: {
        id: string;
        date: string;
        weightKg: number;
    }[];
    steps: {
        date: string;
        steps: number;
    }[];
};
export type DailyMetrics = {
    date: string;
    waterMl: number;
    steps: number;
    weightKg: number | null;
    consumedKcal: number;
    activityKcal: number;
    activityCount: number;
    durationSeconds: number;
    distanceMeters: number;
    hasWater: boolean;
    hasSteps: boolean;
    hasMeals: boolean;
};
export type HealthReport = {
    period: ReportPeriod;
    start: string;
    end: string;
    days: DailyMetrics[];
    totals: {
        waterMl: number;
        steps: number;
        consumedKcal: number;
        activityKcal: number;
        activityCount: number;
        durationSeconds: number;
        distanceMeters: number;
    };
    text: string[];
    expenditure: "registered-activities";
};
const dayDate = (s: string) => new Date(`${z.iso.date().parse(s)}T12:00:00Z`);
const dayString = (d: Date) => d.toISOString().slice(0, 10);
export function reportWindow(period: ReportPeriod, reference: string) {
    const end = dayDate(reference), start = new Date(end);
    if (period === "week")
        start.setUTCDate(start.getUTCDate() - 6);
    if (period === "month") {
        start.setUTCDate(1);
        end.setUTCMonth(end.getUTCMonth() + 1, 0);
    }
    return { start: dayString(start), end: dayString(end) };
}
export function retentionCutoff(reference: string) {
    const d = dayDate(reference), month = d.getUTCMonth();
    d.setUTCFullYear(d.getUTCFullYear() - 1);
    if (d.getUTCMonth() !== month)
        d.setUTCDate(0);
    return dayString(d);
}
export function buildHealthReport(history: HealthHistory, period: ReportPeriod, date: string, goals: {
    waterMl: number;
    steps: number;
}): HealthReport {
    const { start, end } = reportWindow(period, date), points = new Map<string, DailyMetrics>();
    const d = dayDate(start);
    while (dayString(d) <= end) {
        const key = dayString(d);
        points.set(key, { date: key, waterMl: 0, steps: 0, weightKg: null, consumedKcal: 0, activityKcal: 0, activityCount: 0, durationSeconds: 0, distanceMeters: 0, hasWater: false, hasSteps: false, hasMeals: false });
        d.setUTCDate(d.getUTCDate() + 1);
    }
    for (const r of history.water) {
        const p = points.get(r.date);
        if (p) {
            p.waterMl += r.amountMl;
            p.hasWater = true;
        }
    }
    for (const r of history.meals) {
        const p = points.get(r.date);
        if (p) {
            p.consumedKcal += r.calories;
            p.hasMeals = true;
        }
    }
    for (const r of history.activities) {
        const p = points.get(r.date);
        if (p) {
            p.activityKcal += r.calories;
            p.activityCount += r.count ?? 1;
            p.durationSeconds += r.durationSeconds;
            p.distanceMeters += r.distanceMeters;
        }
    }
    for (const r of history.steps) {
        const p = points.get(r.date);
        if (p) {
            p.steps = r.steps;
            p.hasSteps = true;
        }
    }
    const weights = new Map<string, number[]>();
    for (const r of history.weights)
        if (points.has(r.date))
            weights.set(r.date, [...(weights.get(r.date) ?? []), r.weightKg]);
    for (const [date, values] of weights)
        points.get(date)!.weightKg = values.reduce((a, b) => a + b, 0) / values.length;
    const days = [...points.values()], sum = (key: "waterMl" | "steps" | "consumedKcal" | "activityKcal" | "activityCount" | "durationSeconds" | "distanceMeters") => days.reduce((s, p) => s + p[key], 0);
    const totals = { waterMl: sum("waterMl"), steps: sum("steps"), consumedKcal: sum("consumedKcal"), activityKcal: sum("activityKcal"), activityCount: sum("activityCount"), durationSeconds: sum("durationSeconds"), distanceMeters: sum("distanceMeters") };
    const text = ["Gasto energético: somente atividades registradas. Metas atuais usadas como referência."];
    const waterDays = days.filter(p => p.hasWater), stepDays = days.filter(p => p.hasSteps);
    const waterMet = waterDays.filter(p => goals.waterMl > 0 && p.waterMl >= goals.waterMl).length;
    const stepsMet = stepDays.filter(p => goals.steps > 0 && p.steps >= goals.steps).length;
    if (waterDays.length) {
        text.push(`Hidratação: meta atingida em ${waterMet} de ${waterDays.length} ${waterDays.length===1?"dia":"dias"} com registros.`);
        if (waterMet < waterDays.length)
            text.push(`Para acompanhar: ${waterDays.length - waterMet} dias registrados abaixo da meta de água.`);
    }
    else
        text.push("Sem registros de água; não é possível avaliar a hidratação.");
    if (stepDays.length) {
        text.push(`Passos: meta atingida em ${stepsMet} de ${stepDays.length} ${stepDays.length===1?"dia":"dias"} com registros.`);
        if (stepsMet < stepDays.length)
            text.push(`Para acompanhar: ${stepDays.length - stepsMet} dias registrados abaixo da meta de passos.`);
    }
    else
        text.push("Sem registros de passos neste período.");
    if (totals.activityCount)
        text.push(`Destaque: ${totals.activityCount} ${totals.activityCount===1?"atividade registrada":"atividades registradas"} no período.`);
    else
        text.push("Sem atividades registradas neste período.");
    const recorded = days.filter(p => p.hasWater || p.hasMeals || p.hasSteps || p.activityCount || p.weightKg !== null).length;
    if (recorded < days.length)
        text.push(`${days.length - recorded} dias sem registros. Ausência de registro não comprova ausência de consumo ou atividade.`);
    return { period, start, end, days, totals, text, expenditure: "registered-activities" };
}
export const backupBlobSchema = z.object({
    id: z.string(), mimeType: z.string(), size: z.number().int().nonnegative(), sha256: z.string().regex(/^[a-f0-9]{64}$/), base64: z.string(),
}).strict();
export const backupProfileSchema = z.object({
    id: z.uuid(), profile: z.record(z.string(), z.unknown()), settings: z.record(z.string(), z.unknown()),
    water: z.array(z.record(z.string(), z.unknown())), meals: z.array(z.record(z.string(), z.unknown())),
    activities: z.array(z.record(z.string(), z.unknown())), weights: z.array(z.record(z.string(), z.unknown())),
    steps: z.array(z.record(z.string(), z.unknown())), recipes: z.array(z.record(z.string(), z.unknown())),
    wellbeing: z.array(z.record(z.string(), z.unknown())), documents: z.array(medicalDocumentSchema),
}).strict();
export const backupSchema = z.object({
    format: z.literal("VitalisTrack"), version: z.literal(1), exportedAt: z.iso.datetime({ offset: true }),
    userId: z.uuid(), units: z.literal("kg-cm-m-ml"), lastSyncedAt: z.iso.datetime({ offset: true }).nullable(), includesPendingChanges: z.boolean(), profiles: z.array(backupProfileSchema),
    friendships: z.array(z.object({ id: z.uuid(), profileId: z.uuid(), friendProfileId: z.uuid(), status: z.string() }).strict()),
    blobs: z.array(backupBlobSchema),
}).strict();
export type BackupV1 = z.infer<typeof backupSchema>;
export type CleanupCandidate = {
    entity: "water" | "meal" | "activity" | "weight" | "steps" | "wellbeing";
    id: string;
    fingerprint: string;
};
export type CleanupPreview = {
    userId: string;
    profileId: string;
    cutoff: string;
    candidates: CleanupCandidate[];
    counts: Record<string, number>;
};

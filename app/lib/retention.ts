import { calendarDate, deviceTimeZone, retentionCutoff, type CleanupCandidate, type CleanupPreview, type WellbeingRecord } from "@vitalis/contracts";
import { getDatabase, serializeWrite } from "./local-database";
import { projectSnapshot } from "./history-projection";
import { notifyWellbeingChanged } from "./wellbeing-store";
import { newId } from "./health";
import type { AppState, LocalMutation } from "@/state/types";
export function recordFingerprint(value: string) {
    let hash = 14695981039346656037n;
    for (let i = 0; i < value.length; i++)
        hash = BigInt.asUintN(64, (hash ^ BigInt(value.charCodeAt(i))) * 1099511628211n);
    return hash.toString(16);
}
const historical = (record: WellbeingRecord) => ["breathing", "sleep", "mood", "bloodPressure"].includes(record.kind) || (record.kind === "fasting" && record.data.status !== "active");
const recordDay = (r: WellbeingRecord) => r.kind === "sleep" ? r.data.date : calendarDate(deviceTimeZone(), new Date(r.kind === "breathing" ? r.data.completedAt : r.kind === "fasting" ? r.data.endAt : "occurredAt" in r.data ? r.data.occurredAt : "9999-12-31T12:00:00Z"));
export async function previewCleanup(userId: string, profileId: string, date: string): Promise<CleanupPreview> {
    const db = await getDatabase(), cutoff = retentionCutoff(date);
    const rows = await db.getAllAsync<{
        kind: CleanupCandidate["entity"];
        id: string;
        record: string;
    }>("SELECT kind,id,record FROM health_records WHERE user_id=? AND profile_id=? AND day<? ORDER BY kind,id", userId, profileId, cutoff);
    const candidates: CleanupCandidate[] = rows.map(r => ({ entity: r.kind, id: r.id, fingerprint: recordFingerprint(r.record) }));
    const well = await db.getAllAsync<{
        id: string;
        record: string;
    }>("SELECT id,record FROM wellbeing_records WHERE user_id=? AND profile_id=? AND deleted=0", userId, profileId);
    for (const row of well) {
        const r = JSON.parse(row.record) as WellbeingRecord;
        if (historical(r) && recordDay(r) < cutoff)
            candidates.push({ entity: "wellbeing", id: row.id, fingerprint: recordFingerprint(row.record) });
    }
    const counts: Record<string, number> = {};
    for (const c of candidates)
        counts[c.entity] = (counts[c.entity] ?? 0) + 1;
    return { userId, profileId, cutoff, candidates, counts };
}
export async function executeCleanup(preview: CleanupPreview) {
    const { userId, profileId } = preview, db = await getDatabase();
    let removed = 0, skipped = 0;
    await serializeWrite(() => db.withExclusiveTransactionAsync(async (tx) => {
        const key = `${userId}:${profileId === userId ? "" : profileId + ":"}app-state`;
        const row = await tx.getFirstAsync<{
            value: string;
        }>("SELECT value FROM kv WHERE key=?", key);
        if (!row)
            throw new Error("Perfil local ausente");
        const state: AppState = JSON.parse(row.value), approved = new Map<string, Set<string>>();
        for (const c of preview.candidates) {
            const table = c.entity === "wellbeing" ? "wellbeing_records" : "health_records";
            const found = await tx.getFirstAsync<{
                record: string;
            }>(`SELECT record FROM ${table} WHERE user_id=? AND profile_id=? AND id=? ${c.entity === "wellbeing" ? "AND deleted=0" : "AND kind=? AND day<?"}`, userId, profileId, c.id, ...(c.entity === "wellbeing" ? [] : [c.entity, preview.cutoff]));
            if (!found || recordFingerprint(found.record) !== c.fingerprint) {
                skipped++;
                continue;
            }
            const now = new Date().toISOString();
            if (c.entity === "wellbeing") {
                const r = JSON.parse(found.record) as WellbeingRecord;
                if (!historical(r) || recordDay(r) >= preview.cutoff) {
                    skipped++;
                    continue;
                }
                await tx.runAsync("UPDATE wellbeing_records SET record=?,deleted=1 WHERE user_id=? AND profile_id=? AND id=?", JSON.stringify({ ...r, updatedAt: now, deletedAt: now }), userId, profileId, c.id);
            }
            else {
                if (!approved.has(c.entity))
                    approved.set(c.entity, new Set());
                approved.get(c.entity)!.add(c.id);
            }
            const mutation: LocalMutation = { mutationId: newId(), profileId, entity: c.entity, action: "delete", ...(c.entity === "steps" ? { payload: { date: c.id } } : { entityId: c.id }), clientUpdatedAt: now };
            await tx.runAsync("INSERT INTO outbox_v2(user_id,profile_id,mutation_id,mutation) VALUES (?,?,?,?)", userId, profileId, mutation.mutationId, JSON.stringify(mutation));
            removed++;
        }
        for (const [entity, field] of [["water", "water"], ["meal", "meals"], ["activity", "activities"], ["weight", "weights"], ["steps", "dailySteps"]] as const) {
            const ids = approved.get(entity);
            if (ids)
                (state[field] as {
                    id?: string;
                    date: string;
                }[]) = (state[field] ?? []).filter(r => !ids.has("id" in r ? String(r.id) : r.date));
        }
        if (removed)
            state.syncStatus = state.syncStatus === "offline" ? "offline" : "pending";
        const value = JSON.stringify(state);
        await tx.runAsync("UPDATE kv SET value=? WHERE key=?", value, key);
        await projectSnapshot(tx, value);
    }));
    notifyWellbeingChanged("local");
    return { removed, skipped };
}

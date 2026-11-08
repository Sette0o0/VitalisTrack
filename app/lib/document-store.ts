import type { DocumentChanges, MedicalDocument } from "@vitalis/contracts";
import { medicalDocumentSchema } from "@vitalis/contracts";
import { getDatabase, serializeWrite } from "./local-database";
import { newId } from "./health";
import type { LocalMutation } from "@/state/types";
export type StoredDocument = MedicalDocument & {
    localUri: string | null;
};
const listeners = new Set<() => void>();
export const onDocumentsChanged = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const changed = () => { for (const listener of listeners)
    listener(); };
const decode = (r: {
    record: string;
    local_uri: string | null;
}): StoredDocument => ({ ...medicalDocumentSchema.parse(JSON.parse(r.record)), localUri: r.local_uri });
export async function listDocuments(userId: string, profileId: string, cursor?: {
    at: string;
    id: string;
}, limit = 30) {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{
        record: string;
        local_uri: string | null;
    }>(`SELECT record,local_uri FROM medical_documents WHERE user_id=? AND profile_id=? AND deleted=0 ${cursor ? "AND (created_at<? OR (created_at=? AND id<?))" : ""} ORDER BY created_at DESC,id DESC LIMIT ?`, userId, profileId, ...(cursor ? [cursor.at, cursor.at, cursor.id] : []), Math.min(limit, 100) + 1);
    const records = rows.slice(0, Math.min(limit, 100)).map(decode), last = records.at(-1);
    return { records, nextCursor: rows.length > limit && last ? { at: last.createdAt, id: last.id } : undefined };
}
export async function findDocument(userId: string, profileId: string, id: string) {
    const db = await getDatabase(), row = await db.getFirstAsync<{
        record: string;
        local_uri: string | null;
    }>("SELECT record,local_uri FROM medical_documents WHERE user_id=? AND profile_id=? AND id=? AND deleted=0", userId, profileId, id);
    return row ? decode(row) : null;
}
export async function saveDocument(userId: string, profileId: string, record: MedicalDocument, uri: string) {
    const r = medicalDocumentSchema.parse(record);
    if (r.profileId !== profileId)
        throw new Error("Perfil divergente");
    const db = await getDatabase();
    await serializeWrite(() => db.withExclusiveTransactionAsync(async (tx) => {
        await tx.runAsync("INSERT INTO medical_documents(user_id,profile_id,id,record,created_at,local_uri,deleted) VALUES (?,?,?,?,?,?,0)", userId, profileId, r.id, JSON.stringify(r), r.createdAt, uri);
        const m: LocalMutation = { mutationId: newId(), profileId, entity: "document", action: "upsert", payload: { id: r.id, uri, name: r.name, mimeType: r.mimeType }, clientUpdatedAt: r.updatedAt };
        await tx.runAsync("INSERT INTO outbox_v2(user_id,profile_id,mutation_id,mutation) VALUES (?,?,?,?)", userId, profileId, m.mutationId, JSON.stringify(m));
    }));
    changed();
}
export async function deleteDocument(userId: string, profileId: string, id: string) {
    const db = await getDatabase();
    await serializeWrite(() => db.withExclusiveTransactionAsync(async (tx) => {
        const row = await tx.getFirstAsync<{
            record: string;
        }>("SELECT record FROM medical_documents WHERE user_id=? AND profile_id=? AND id=? AND deleted=0", userId, profileId, id);
        if (!row)
            return;
        const now = new Date().toISOString(), record = { ...JSON.parse(row.record), deletedAt: now, updatedAt: now };
        await tx.runAsync("UPDATE medical_documents SET deleted=1,record=? WHERE user_id=? AND profile_id=? AND id=?", JSON.stringify(record), userId, profileId, id);
        const m: LocalMutation = { mutationId: newId(), profileId, entity: "document", action: "delete", entityId: id, clientUpdatedAt: now };
        await tx.runAsync("INSERT INTO outbox_v2(user_id,profile_id,mutation_id,mutation) VALUES (?,?,?,?)", userId, profileId, m.mutationId, JSON.stringify(m));
    }));
    changed();
}
export async function setDocumentUri(userId: string, profileId: string, id: string, uri: string) {
    const db = await getDatabase();
    await serializeWrite(() => db.runAsync("UPDATE medical_documents SET local_uri=? WHERE user_id=? AND profile_id=? AND id=? AND deleted=0", uri, userId, profileId, id));
    changed();
}
export async function acknowledgeDocument(userId: string, profileId: string, record: MedicalDocument) {
    const db = await getDatabase();
    await serializeWrite(() => db.withExclusiveTransactionAsync(async (tx) => {
        const row = await tx.getFirstAsync<{
            record: string;
            deleted: number;
        }>("SELECT record,deleted FROM medical_documents WHERE user_id=? AND profile_id=? AND id=?", userId, profileId, record.id);
        if (!row)
            return;
        const value = row.deleted ? { ...record, deletedAt: JSON.parse(row.record).deletedAt } : record;
        await tx.runAsync("UPDATE medical_documents SET record=?,deleted=? WHERE user_id=? AND profile_id=? AND id=?", JSON.stringify(value), value.deletedAt ? 1 : 0, userId, profileId, record.id);
    }));
    changed();
}
export async function receiveDocuments(userId: string, profileId: string, page: DocumentChanges) {
    const db = await getDatabase();
    await serializeWrite(() => db.withExclusiveTransactionAsync(async (tx) => {
        const mutations = await tx.getAllAsync<{
            mutation: string;
        }>("SELECT mutation FROM outbox_v2 WHERE user_id=? AND profile_id=?", userId, profileId);
        const pending = new Set(mutations.map(r => JSON.parse(r.mutation) as LocalMutation).filter(m => m.entity === "document").map(m => m.entityId ?? m.payload?.id));
        for (const r of page.records) {
            medicalDocumentSchema.parse(r);
            if (r.profileId !== profileId || pending.has(r.id))
                continue;
            await tx.runAsync("INSERT INTO medical_documents(user_id,profile_id,id,record,created_at,deleted) VALUES (?,?,?,?,?,?) ON CONFLICT(user_id,profile_id,id) DO UPDATE SET record=excluded.record,deleted=excluded.deleted", userId, profileId, r.id, JSON.stringify(r), r.createdAt, r.deletedAt ? 1 : 0);
        }
        const key = `${userId}:${profileId === userId ? "" : profileId + ":"}documents-cursor`;
        await tx.runAsync("INSERT INTO kv(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", key, page.cursor);
    }));
    changed();
}

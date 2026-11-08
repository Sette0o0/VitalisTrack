import { initDatabase, getDatabase, pendingMutations, getValue, removeMutations } from "./local-database";
import { saveDocument, deleteDocument, receiveDocuments, findDocument, listDocuments, acknowledgeDocument, setDocumentUri } from "./document-store";
import { startBackgroundRun, finishBackgroundRun } from "./background-diagnostics";
import { mergePull } from "./merge-pull";
import { initialState } from "@/state/reducer";
import type { MedicalDocument, SyncPull } from "@vitalis/contracts";
jest.mock("expo-sqlite", () => jest.requireActual("@/testing/sqlite").sqliteBridge());
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`, owner = id(1), other = id(2);
const doc = (n: number): MedicalDocument => ({ id: id(n), profileId: owner, name: "QA.pdf", mimeType: "application/pdf", size: 3, sha256: "a".repeat(64), createdAt: "2026-11-08T12:00:00Z", updatedAt: "2026-11-08T12:00:00Z", deletedAt: null, revision: "0" });
beforeEach(async () => { await initDatabase(); const db = await getDatabase(); await db.execAsync("DELETE FROM kv;DELETE FROM medical_documents;DELETE FROM outbox_v2;"); });
test("private local metadata and upload mutation commit/rollback together", async () => {
    const db = await getDatabase();
    await db.execAsync("CREATE TEMP TRIGGER fail_doc BEFORE INSERT ON outbox_v2 BEGIN SELECT RAISE(ABORT,'full');END;");
    await expect(saveDocument(owner, owner, doc(10), "file://private/10")).rejects.toThrow("full");
    expect(await findDocument(owner, owner, id(10))).toBeNull();
    await db.execAsync("DROP TRIGGER fail_doc;");
    await saveDocument(owner, owner, doc(10), "file://private/10");
    expect((await pendingMutations(10, owner, owner))[0]).toMatchObject({ entity: "document", action: "upsert", payload: { id: id(10), uri: "file://private/10" } });
    expect(await findDocument(other, owner, id(10))).toBeNull();
    expect(await findDocument(owner, other, id(10))).toBeNull();
    await expect(saveDocument(owner, other, doc(11), "file://private/11")).rejects.toThrow("Perfil");
});
test("remote receipt preserves pending edits, cursors roll back and files stay available across metadata refresh", async () => {
    await saveDocument(owner, owner, doc(10), "file://private/10");
    await receiveDocuments(owner, owner, { records: [{ ...doc(10), name: "Remote.pdf", revision: "1" }], cursor: "1", hasMore: false });
    expect((await findDocument(owner, owner, id(10)))!.name).toBe("QA.pdf");
    await removeMutations((await pendingMutations(10, owner, owner)).map(m => m.mutationId), owner);
    const db = await getDatabase();
    await db.execAsync("CREATE TEMP TRIGGER fail_doc_cursor BEFORE UPDATE ON kv BEGIN SELECT RAISE(ABORT,'interrupted');END;");
    await expect(receiveDocuments(owner, owner, { records: [{ ...doc(10), revision: "2", name: "Remote.pdf" }], cursor: "2", hasMore: false })).rejects.toThrow("interrupted");
    expect(await getValue("documents-cursor", owner, owner)).toBe("1");
    expect((await findDocument(owner, owner, id(10)))!.name).toBe("QA.pdf");
    await db.execAsync("DROP TRIGGER fail_doc_cursor;");
    await receiveDocuments(owner, owner, { records: [{ ...doc(10), revision: "2", name: "Remote.pdf" }], cursor: "2", hasMore: false });
    expect((await findDocument(owner, owner, id(10)))!.localUri).toBe("file://private/10");
});
test("deleting while upload response is in flight never restores the item", async () => {
    await saveDocument(owner, owner, doc(10), "file://private/10");
    await deleteDocument(owner, owner, id(10));
    await acknowledgeDocument(owner, owner, { ...doc(10), revision: "1" });
    expect(await findDocument(owner, owner, id(10))).toBeNull();
    const queue = await pendingMutations(100, owner, owner);
    expect(queue.map(m => m.action)).toEqual(["upsert", "delete"]);
    await deleteDocument(owner, owner, id(10));
    expect(await pendingMutations(100, owner, owner)).toHaveLength(2);
});
test("metadata pages, cached URI, remote tombstones and foreign profile metadata", async () => {
    const records = [doc(10), doc(11), doc(12)].map((r, i) => ({ ...r, revision: String(i + 1) }));
    await receiveDocuments(owner, owner, { records, cursor: "3", hasMore: false });
    const a = await listDocuments(owner, owner, undefined, 2), b = await listDocuments(owner, owner, a.nextCursor, 2);
    expect(new Set([...a.records, ...b.records].map(r => r.id)).size).toBe(3);
    await setDocumentUri(owner, owner, id(10), "file://download.pdf");
    expect((await findDocument(owner, owner, id(10)))!.localUri).toBe("file://download.pdf");
    await receiveDocuments(owner, owner, { records: [{ ...doc(10), deletedAt: new Date().toISOString(), revision: "4" }, { ...doc(20), profileId: other }], cursor: "4", hasMore: false });
    expect(await findDocument(owner, owner, id(10))).toBeNull();
    expect(await findDocument(owner, owner, id(20))).toBeNull();
    await acknowledgeDocument(owner, owner, doc(99)); // missing local row is harmless
});
test("step deletion markers remove old cached counts while pending local edits remain protected", () => {
    const current = { ...initialState, dailySteps: [{ date: "2020-01-01", steps: 1000 }] };
    const pull: SyncPull = { profile: null, goals: null, water: [], meals: [], activities: [], weights: [], steps: [{ date: "2020-01-01", steps: 0, deletedAt: new Date().toISOString() }], cursor: "new" };
    expect(mergePull(current, pull, []).dailySteps).toEqual([]);
    expect(mergePull(current, pull, [{ mutationId: id(10), entity: "steps", action: "upsert", payload: { date: "2020-01-01", steps: 2000 }, clientUpdatedAt: new Date().toISOString() }]).dailySteps).toEqual(current.dailySteps);
});
test("background diagnostic records persist bounded outcomes without account data or tokens", async () => {
    const run = await startBackgroundRun();
    await finishBackgroundRun(run, "deferred", "session-unavailable");
    expect(JSON.parse((await getValue("background-runs", null, null))!)[0]).toMatchObject({ status: "deferred", reason: "session-unavailable", finishedAt: expect.any(String) });
    for (let i = 0; i < 22; i++)
        await startBackgroundRun();
    const rows = JSON.parse((await getValue("background-runs", null, null))!);
    expect(rows).toHaveLength(20);
    expect(JSON.stringify(rows)).not.toMatch(/accessToken|refreshToken|userId|profileId/);
});

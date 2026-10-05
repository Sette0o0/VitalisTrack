import type { SyncMutation } from "@vitalis/contracts";
import { drainOutbox, mergeRows } from "./sync";

const mutation = (id: string): SyncMutation => ({ mutationId: id, entity: "meal", action: "upsert", payload: { id }, clientUpdatedAt: new Date().toISOString() });
test("drena mais de 100 alterações sem perder a ordem", async () => {
	let queue = Array.from({ length: 251 }, (_, i) => mutation(String(i)));
	const push = jest.fn(async (rows: SyncMutation[]) => rows.map((x) => ({ mutationId: x.mutationId, status: "applied" as const })));
	await drainOutbox({ read: async () => queue.slice(0, 100), push, ack: async (ids) => { queue = queue.filter((x) => !ids.includes(x.mutationId)); }, fail: jest.fn() });
	expect(queue).toHaveLength(0); expect(push).toHaveBeenCalledTimes(3);
	expect(push.mock.calls[2][0][0].mutationId).toBe("200");
});
test("falha parcial remove apenas confirmações e permite retry", async () => {
	let queue = [mutation("a"), mutation("b")];
	const io = { read: async () => queue, push: async () => [{ mutationId: "a", status: "applied" as const }, { mutationId: "b", status: "failed" as const, message: "Servidor indisponível" }], ack: async (ids: string[]) => { queue = queue.filter((x) => !ids.includes(x.mutationId)); }, fail: jest.fn() };
	await expect(drainOutbox(io)).rejects.toThrow("Servidor indisponível");
	expect(queue.map((x) => x.mutationId)).toEqual(["b"]);
	await drainOutbox({ ...io, push: async () => [{ mutationId: "b", status: "applied" }] });
	expect(queue).toHaveLength(0);
});
test("erro de transporte preserva todas as alterações", async () => {
	const rows = [mutation("a")], ack = jest.fn(), fail = jest.fn();
	await expect(drainOutbox({ read: async () => rows, push: async () => { throw new Error("Offline"); }, ack, fail })).rejects.toThrow("Offline");
	expect(ack).not.toHaveBeenCalled(); expect(fail).toHaveBeenCalledWith(["a"]);
});
test("pull preserva edições e exclusões pendentes", () => {
	const incoming = [{ id: "a", name: "remoto" }, { id: "b", name: "antigo" }, { id: "c", name: "removido", deletedAt: "today" }];
	const pending = [mutation("a"), { ...mutation("b"), action: "delete" as const, entityId: "b" }];
	expect(mergeRows([{ id: "a", name: "local" }, { id: "c", name: "c" }], incoming, pending, "meal")).toEqual([{ id: "a", name: "local" }]);
});

test("fila intercala JSON e avatar preservando ordem e separação de transporte", () => {
 const { orderedBatch } = jest.requireActual("./sync");
 const avatar = { mutationId: "photo", entity: "avatar", action: "upsert", payload: { uri: "file://photo", mimeType: "image/png" }, clientUpdatedAt: "now" };
 expect(orderedBatch([mutation("a"), avatar, mutation("b")]).map((x: SyncMutation) => x.mutationId)).toEqual(["a"]);
 expect(orderedBatch([avatar, mutation("b")])).toEqual([avatar]);
 expect(orderedBatch([mutation("a"), mutation("b")]).map((x: SyncMutation) => x.mutationId)).toEqual(["a", "b"]);
});

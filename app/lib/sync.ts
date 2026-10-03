import type { SyncMutation, SyncResult } from "@vitalis/contracts";

export async function drainOutbox(io: {
	read: () => Promise<SyncMutation[]>;
	push: (rows: SyncMutation[]) => Promise<SyncResult[]>;
	ack: (ids: string[]) => Promise<void>;
	fail: (ids: string[]) => Promise<void>;
}) {
	for (;;) {
		const rows = await io.read();
		if (!rows.length) return;
		try {
			const result = await io.push(rows);
			const applied = new Set(result.filter((x) => x.status === "applied").map((x) => x.mutationId));
			await io.ack(rows.filter((x) => applied.has(x.mutationId)).map((x) => x.mutationId));
			const failed = rows.filter((x) => !applied.has(x.mutationId));
			if (failed.length) throw new Error(result.find((x) => x.status === "failed")?.message ?? "Alterações aguardam nova tentativa de sincronização.");
		} catch (error) {
			await io.fail(rows.map((x) => x.mutationId));
			throw error;
		}
	}
}

export function mergeRows<T extends { id: string }>(current: T[], incoming: (T & { deletedAt?: string | null })[], pending: SyncMutation[], entity: SyncMutation["entity"]) {
	const protectedIds = new Set(pending.filter((x) => x.entity === entity).map((x) => x.entityId ?? x.payload?.id));
	const map = new Map(current.map((row) => [row.id, row]));
	for (const row of incoming) {
		if (protectedIds.has(row.id)) continue;
		if (row.deletedAt) map.delete(row.id); else map.set(row.id, row);
	}
	return [...map.values()];
}

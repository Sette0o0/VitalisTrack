import * as SQLite from "expo-sqlite";
import type { AppState } from "@/state/types";
import type { SyncMutation } from "@vitalis/contracts";

let database: ReturnType<typeof SQLite.openDatabaseAsync> | null = null;
let activeUser: string | null = null;
let writes: Promise<void> = Promise.resolve();
// Exclusive Expo transactions can reject other connections' concurrent writes.
// Keep workout/cursor/acknowledgement writes outside those transactions as well.
const serializeWrite = <T>(operation: () => Promise<T>): Promise<T> => {
	const result = writes.then(operation);
	writes = result.then(
		() => undefined,
		() => undefined,
	);
	return result;
};
const getDatabase = () => (database ??= SQLite.openDatabaseAsync("vitalis.db"));
export const setActiveUser = (userId: string | null) => {
	activeUser = userId;
};
const scope = (key: string, userId = activeUser) =>
	`${userId ?? "public"}:${key}`;
const writeValue = (
	db: Pick<SQLite.SQLiteDatabase, "runAsync">,
	key: string,
	value: string,
) =>
	db.runAsync(
		"INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
		key,
		value,
	);

export async function initDatabase() {
	const db = await getDatabase();
	await serializeWrite(() =>
		db.execAsync(`PRAGMA journal_mode = WAL;
 CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS outbox (mutation_id TEXT PRIMARY KEY NOT NULL, mutation TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS outbox_v2 (sequence INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, mutation_id TEXT UNIQUE NOT NULL, mutation TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0);
 CREATE INDEX IF NOT EXISTS outbox_user_sequence ON outbox_v2(user_id, sequence);
 PRAGMA user_version = 2;`),
	);
}
export async function setValue(
	key: string,
	value: string,
	userId = activeUser,
) {
	const db = await getDatabase();
	await serializeWrite(() => writeValue(db, scope(key, userId), value));
}
export async function getValue(key: string, userId = activeUser) {
	const db = await getDatabase();
	return (
		(
			await db.getFirstAsync<{ value: string }>(
				"SELECT value FROM kv WHERE key = ?",
				scope(key, userId),
			)
		)?.value ?? null
	);
}
export async function migrateLegacyAccount(userId: string, email: string) {
	const db = await getDatabase();
	const row = await db.getFirstAsync<{ value: string }>(
		"SELECT value FROM kv WHERE key = 'app-state'",
	);
	if (!row) return;
	let old: AppState;
	try {
		old = JSON.parse(row.value);
	} catch {
		return;
	}
	if (old.profile?.email?.toLowerCase() !== email.toLowerCase()) return;
	await serializeWrite(() =>
		db.withExclusiveTransactionAsync(async (tx) => {
			if (
				!(await tx.getFirstAsync(
					"SELECT key FROM kv WHERE key = ?",
					scope("app-state", userId),
				))
			)
				await writeValue(
					tx,
					scope("app-state", userId),
					JSON.stringify({ ...old, userId }),
				);
			const pending = await tx.getAllAsync<{
				mutation_id: string;
				mutation: string;
				attempts: number;
			}>("SELECT * FROM outbox ORDER BY created_at, rowid");
			for (const item of pending)
				await tx.runAsync(
					"INSERT OR IGNORE INTO outbox_v2(user_id, mutation_id, mutation, attempts) VALUES (?, ?, ?, ?)",
					userId,
					item.mutation_id,
					item.mutation,
					item.attempts,
				);
			for (const key of ["sync-cursor", "active-workout"]) {
				const value = await tx.getFirstAsync<{ value: string }>(
					"SELECT value FROM kv WHERE key = ?",
					key,
				);
				if (value) await writeValue(tx, scope(key, userId), value.value);
			}
			await tx.execAsync(
				"DELETE FROM kv WHERE key IN ('app-state', 'sync-cursor', 'active-workout'); DELETE FROM outbox;",
			);
		}),
	);
}
export async function saveState(
	state: AppState,
	mutation?: SyncMutation | null,
) {
	if (!state.userId) return;
	const db = await getDatabase();
	await serializeWrite(() =>
		db.withExclusiveTransactionAsync(async (tx) => {
			await writeValue(
				tx,
				scope("app-state", state.userId),
				JSON.stringify(state),
			);
			if (mutation)
				await tx.runAsync(
					"INSERT OR IGNORE INTO outbox_v2(user_id, mutation_id, mutation) VALUES (?, ?, ?)",
					state.userId!,
					mutation.mutationId,
					JSON.stringify(mutation),
				);
		}),
	);
}
export async function loadState(userId = activeUser) {
	const value = await getValue("app-state", userId);
	return value ? (JSON.parse(value) as AppState) : null;
}
export async function pendingMutations(limit = 100, userId = activeUser) {
	const db = await getDatabase();
	const rows = await db.getAllAsync<{ mutation: string }>(
		"SELECT mutation FROM outbox_v2 WHERE user_id = ? ORDER BY sequence LIMIT ?",
		userId ?? "",
		limit,
	);
	return rows.map((row) => JSON.parse(row.mutation) as SyncMutation);
}
export async function pendingCount(userId = activeUser) {
	const db = await getDatabase();
	return (
		(
			await db.getFirstAsync<{ total: number }>(
				"SELECT COUNT(*) AS total FROM outbox_v2 WHERE user_id = ?",
				userId ?? "",
			)
		)?.total ?? 0
	);
}
export async function removeMutations(ids: string[], userId = activeUser) {
	if (!ids.length) return;
	const db = await getDatabase();
	await serializeWrite(() =>
		db.runAsync(
			`DELETE FROM outbox_v2 WHERE user_id = ? AND mutation_id IN (${ids.map(() => "?").join(",")})`,
			userId ?? "",
			...ids,
		),
	);
}
export async function markAttempt(ids: string[], userId = activeUser) {
	if (!ids.length) return;
	const db = await getDatabase();
	await serializeWrite(() =>
		db.runAsync(
			`UPDATE outbox_v2 SET attempts = attempts + 1 WHERE user_id = ? AND mutation_id IN (${ids.map(() => "?").join(",")})`,
			userId ?? "",
			...ids,
		),
	);
}

export async function loadLegacyState(): Promise<AppState | null> {
	const db = await getDatabase();
	const row = await db.getFirstAsync<{ value: string }>(
		"SELECT value FROM kv WHERE key = 'app-state'",
	);
	try {
		return row ? JSON.parse(row.value) : null;
	} catch {
		return null;
	}
}

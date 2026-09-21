import * as SQLite from "expo-sqlite";
import type { AppState } from "@/state/types";
import type { SyncMutation } from "@vitalis/contracts";

let database: ReturnType<typeof SQLite.openDatabaseAsync> | null = null;
const getDatabase = () => (database ??= SQLite.openDatabaseAsync("vitalis.db"));

export async function initDatabase() {
	const db = await getDatabase();
	await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS outbox (
      mutation_id TEXT PRIMARY KEY NOT NULL,
      mutation TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);
}

export async function setValue(key: string, value: string) {
	const db = await getDatabase();
	await db.runAsync(
		"INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
		key,
		value,
	);
}
export async function getValue(key: string) {
	const db = await getDatabase();
	const row = await db.getFirstAsync<{ value: string }>(
		"SELECT value FROM kv WHERE key = ?",
		key,
	);
	return row?.value ?? null;
}
export const saveState = (state: AppState) =>
	setValue("app-state", JSON.stringify(state));
export async function loadState() {
	const value = await getValue("app-state");
	return value ? (JSON.parse(value) as AppState) : null;
}
export async function enqueueMutation(mutation: SyncMutation) {
	const db = await getDatabase();
	await db.runAsync(
		"INSERT OR IGNORE INTO outbox (mutation_id, mutation, created_at) VALUES (?, ?, ?)",
		mutation.mutationId,
		JSON.stringify(mutation),
		new Date().toISOString(),
	);
}
export async function pendingMutations(limit = 100) {
	const db = await getDatabase();
	const rows = await db.getAllAsync<{ mutation: string }>(
		"SELECT mutation FROM outbox ORDER BY created_at ASC LIMIT ?",
		limit,
	);
	return rows.map((row) => JSON.parse(row.mutation) as SyncMutation);
}
export async function removeMutations(ids: string[]) {
	if (!ids.length) return;
	const db = await getDatabase();
	const placeholders = ids.map(() => "?").join(",");
	await db.runAsync(
		`DELETE FROM outbox WHERE mutation_id IN (${placeholders})`,
		...ids,
	);
}
export async function markAttempt(ids: string[]) {
	if (!ids.length) return;
	const db = await getDatabase();
	const placeholders = ids.map(() => "?").join(",");
	await db.runAsync(
		`UPDATE outbox SET attempts = attempts + 1 WHERE mutation_id IN (${placeholders})`,
		...ids,
	);
}
export async function clearLocalData() {
	const db = await getDatabase();
	await db.execAsync("DELETE FROM kv; DELETE FROM outbox;");
}

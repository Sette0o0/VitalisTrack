import { projectSnapshot, notifyHistoryChanged } from "./history-projection";
import * as SQLite from "expo-sqlite";
import type { AppState, LocalMutation } from "@/state/types";

let database: ReturnType<typeof SQLite.openDatabaseAsync> | null = null;
let activeUser: string | null = null;
let activeProfile: string | null = null;
let writes: Promise<void> = Promise.resolve();
// Exclusive Expo transactions can reject other connections' concurrent writes.
// Keep workout/cursor/acknowledgement writes outside those transactions as well.
export const serializeWrite = <T>(operation: () => Promise<T>): Promise<T> => {
	const result = writes.then(operation);
	writes = result.then(
		() => undefined,
		() => undefined,
	);
	return result;
};
export const getDatabase = () => (database ??= SQLite.openDatabaseAsync("vitalis.db"));
export const setActiveUser = (userId: string | null, profileId: string | null = userId) => {
	activeUser = userId;
	activeProfile = profileId;
};
export const setActiveProfile = (profileId: string) => {
	activeProfile = profileId;
};
const profileFor = (userId: string | null) =>
	userId === activeUser ? (activeProfile ?? userId) : userId;
const scope = (key: string, userId = activeUser, profileId = profileFor(userId)) =>
	`${userId ?? "public"}:${profileId && profileId !== userId ? profileId + ":" : ""}${key}`;
const writeValue = async (db: Pick<SQLite.SQLiteDatabase, "runAsync">, key: string, value: string) => {
 await db.runAsync("INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",key,value);
 if(key.endsWith(":app-state")) await projectSnapshot(db,value);
};

export async function initDatabase() {
	const db = await getDatabase();
	await serializeWrite(async () => {
		await db.execAsync("PRAGMA journal_mode = WAL;");
		await db.withExclusiveTransactionAsync(async (tx) => {
			const prior = await tx.getFirstAsync<{user_version:number}>("PRAGMA user_version");
 await tx.execAsync(`
    CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS outbox (mutation_id TEXT PRIMARY KEY NOT NULL, mutation TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS outbox_v2 (sequence INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, mutation_id TEXT UNIQUE NOT NULL, mutation TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0);
    CREATE INDEX IF NOT EXISTS outbox_user_sequence ON outbox_v2(user_id,sequence);
   `);
			const columns = await tx.getAllAsync<{ name: string }>("PRAGMA table_info(outbox_v2)");
			if (!columns.some((c) => c.name === "profile_id"))
				await tx.execAsync("ALTER TABLE outbox_v2 ADD COLUMN profile_id TEXT NOT NULL DEFAULT '';");
			await tx.runAsync("UPDATE outbox_v2 SET profile_id=user_id WHERE profile_id=''");
			await tx.execAsync(
				`CREATE INDEX IF NOT EXISTS outbox_profile_sequence ON outbox_v2(user_id,profile_id,sequence); CREATE TABLE IF NOT EXISTS wellbeing_records (user_id TEXT NOT NULL, profile_id TEXT NOT NULL, id TEXT NOT NULL, kind TEXT NOT NULL, record TEXT NOT NULL, sort_at TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(user_id,profile_id,id)); CREATE INDEX IF NOT EXISTS wellbeing_page ON wellbeing_records(user_id,profile_id,kind,deleted,sort_at DESC,id DESC); CREATE TABLE IF NOT EXISTS health_records(user_id TEXT NOT NULL,profile_id TEXT NOT NULL,kind TEXT NOT NULL,id TEXT NOT NULL,day TEXT NOT NULL,time TEXT NOT NULL,record TEXT NOT NULL,PRIMARY KEY(user_id,profile_id,kind,id));
 CREATE INDEX IF NOT EXISTS health_page ON health_records(user_id,profile_id,day DESC,time DESC,kind DESC,id DESC);
 CREATE TABLE IF NOT EXISTS medical_documents(user_id TEXT NOT NULL,profile_id TEXT NOT NULL,id TEXT NOT NULL,record TEXT NOT NULL,created_at TEXT NOT NULL,local_uri TEXT,deleted INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(user_id,profile_id,id));
 CREATE INDEX IF NOT EXISTS documents_page ON medical_documents(user_id,profile_id,deleted,created_at DESC,id DESC);
 PRAGMA user_version=5;`,
			);
 if((prior?.user_version??0)<5){
  const snapshots=await tx.getAllAsync<{value:string}>("SELECT value FROM kv WHERE key LIKE '%:app-state' AND json_valid(value)");
  for(const row of snapshots) await projectSnapshot(tx,row.value);
 }
		});
	});
}

export async function setValue(
	key: string,
	value: string,
	userId = activeUser,
	profileId = profileFor(userId),
) {
	const db = await getDatabase();
	await serializeWrite(() => writeValue(db, scope(key, userId, profileId), value));
}
export async function getValue(key: string, userId = activeUser, profileId = profileFor(userId)) {
	const db = await getDatabase();
	return (
		(
			await db.getFirstAsync<{ value: string }>(
				"SELECT value FROM kv WHERE key = ?",
				scope(key, userId, profileId),
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
					scope("app-state", userId, userId),
				))
			)
				await writeValue(
					tx,
					scope("app-state", userId, userId),
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
				if (value) await writeValue(tx, scope(key, userId, userId), value.value);
			}
			await tx.execAsync(
				"DELETE FROM kv WHERE key IN ('app-state', 'sync-cursor', 'active-workout'); DELETE FROM outbox;",
			);
		}),
	);
}
export async function saveState(state: AppState, mutation?: LocalMutation | null, cursor?: string) {
	if (!state.userId) return;
	const db = await getDatabase();
	await serializeWrite(() =>
		db.withExclusiveTransactionAsync(async (tx) => {
			await writeValue(
				tx,
				scope("app-state", state.userId, state.profileId ?? state.userId),
				JSON.stringify(state),
			);
			if (mutation)
				await tx.runAsync(
					"INSERT OR IGNORE INTO outbox_v2(user_id, profile_id, mutation_id, mutation) VALUES (?, ?, ?, ?)",
					state.userId!,
					state.profileId ?? state.userId!,
					mutation.mutationId,
					JSON.stringify({ ...mutation, profileId: state.profileId ?? state.userId }),
				);
			if (cursor !== undefined)
				await writeValue(
					tx,
					scope("sync-cursor", state.userId, state.profileId ?? state.userId),
					cursor,
				);
		}),
	);
 notifyHistoryChanged();
}
export async function loadState(userId = activeUser, profileId = profileFor(userId)) {
	const value = await getValue("app-state", userId, profileId);
	return value ? (JSON.parse(value) as AppState) : null;
}
export async function pendingMutations(
	limit = 100,
	userId = activeUser,
	profileId = profileFor(userId),
) {
	const db = await getDatabase();
	const rows = await db.getAllAsync<{ mutation: string }>(
		"SELECT mutation FROM outbox_v2 WHERE user_id = ? AND COALESCE(NULLIF(profile_id,''),user_id) = ? ORDER BY sequence LIMIT ?",
		userId ?? "",
		profileId ?? "",
		limit,
	);
	return rows.map((row) => JSON.parse(row.mutation) as LocalMutation);
}
export async function pendingCount(userId = activeUser, profileId = profileFor(userId)) {
	const db = await getDatabase();
	return (
		(
			await db.getFirstAsync<{ total: number }>(
				"SELECT COUNT(*) AS total FROM outbox_v2 WHERE user_id = ? AND COALESCE(NULLIF(profile_id,''),user_id) = ?",
				userId ?? "",
				profileId ?? "",
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

// Read-modify-write and cursor share the same transaction and write queue as UI saves.
export async function updateStoredState(
	userId: string,
	profileId: string,
	update: (state: AppState) => AppState | Promise<AppState>,
	cursor?: string,
) {
	const db = await getDatabase();
	const operation=serializeWrite(() =>
		db.withExclusiveTransactionAsync(async (tx) => {
			const row = await tx.getFirstAsync<{ value: string }>(
				"SELECT value FROM kv WHERE key = ?",
				scope("app-state", userId, profileId),
			);
			if (!row) throw new Error("Perfil local ausente");
			const state = await update(JSON.parse(row.value));
			await writeValue(tx, scope("app-state", userId, profileId), JSON.stringify(state));
			if (cursor !== undefined)
				await writeValue(tx, scope("sync-cursor", userId, profileId), cursor);
		}),
	);
 await operation;notifyHistoryChanged();return operation;
}
export async function storedProfiles(userId: string) {
	const value = await getValue("profiles", userId, userId);
	return value ? (JSON.parse(value) as import("@vitalis/contracts").HealthProfile[]) : [];
}
// Called only after authentication/unlock and legacy migration. Repair metadata,
// never health snapshots, cursors or the outbox; serialize with profile creation.
export async function restoreProfileCatalog(userId: string, fallbackName?: string) {
 const db = await getDatabase();
 let result!: { profiles: import("@vitalis/contracts").HealthProfile[]; selected: string };
 await serializeWrite(() => db.withExclusiveTransactionAsync(async tx => {
  const read = async (key: string, profileId = userId) =>
   (await tx.getFirstAsync<{value:string}>("SELECT value FROM kv WHERE key = ?", scope(key,userId,profileId)))?.value;
  const raw = await read("profiles");
  const profiles: import("@vitalis/contracts").HealthProfile[] = raw ? JSON.parse(raw) : [];
  const cached = await read("app-state");
  const primaryState: AppState | null = cached ? JSON.parse(cached) : null;
  const existing = profiles.find(p => p.id === userId);
  const primary = existing ? {...existing, isPrimary:true} : {
   id:userId, isPrimary:true,
   name:(primaryState && (!primaryState.userId || primaryState.userId === userId) ? primaryState.profile?.name : undefined)?.trim() || fallbackName?.trim() || "Perfil principal",
   updatedAt:new Date().toISOString(),
  };
  const repaired = [primary,...profiles.filter(p => p.id !== userId)];
  const encoded = JSON.stringify(repaired);
  if (encoded !== raw) await writeValue(tx,scope("profiles",userId,userId),encoded);
  const requested = await read("selected-profile");
  const selected = requested && repaired.some(p => p.id === requested) &&
   (requested === userId || await read("app-state",requested)) ? requested : userId;
  if (requested !== selected) await writeValue(tx,scope("selected-profile",userId,userId),selected);
  result = {profiles:repaired,selected};
 }));
 return result;
}

export async function rememberProfiles(
	userId: string,
	profiles: import("@vitalis/contracts").HealthProfile[],
) {
	const db = await getDatabase();
	await serializeWrite(() =>
		db.withExclusiveTransactionAsync(async (tx) => {
			const row = await tx.getFirstAsync<{ value: string }>(
				"SELECT value FROM kv WHERE key = ?",
				scope("profiles", userId, userId),
			);
			const current = row
				? (JSON.parse(row.value) as import("@vitalis/contracts").HealthProfile[])
				: [];
			await writeValue(
				tx,
				scope("profiles", userId, userId),
				JSON.stringify([...new Map([...current, ...profiles].map((p) => [p.id, p])).values()]),
			);
		}),
	);
}

export async function createStoredProfile(
	state: AppState,
	profile: import("@vitalis/contracts").HealthProfile,
	mutation: LocalMutation,
) {
	if (!state.userId) throw new Error("Conta ausente");
	const db = await getDatabase(),
		userId = state.userId;
	await serializeWrite(() =>
		db.withExclusiveTransactionAsync(async (tx) => {
			const row = await tx.getFirstAsync<{ value: string }>(
				"SELECT value FROM kv WHERE key = ?",
				scope("profiles", userId, userId),
			);
			const profiles = row
				? (JSON.parse(row.value) as import("@vitalis/contracts").HealthProfile[])
				: [];
			await writeValue(
				tx,
				scope("profiles", userId, userId),
				JSON.stringify([...profiles.filter((p) => p.id !== profile.id), profile]),
			);
			await writeValue(tx, scope("app-state", userId, profile.id), JSON.stringify(state));
			await tx.runAsync(
				"INSERT INTO outbox_v2(user_id,profile_id,mutation_id,mutation) VALUES (?,?,?,?)",
				userId,
				profile.id,
				mutation.mutationId,
				JSON.stringify(mutation),
			);
		}),
	);
}

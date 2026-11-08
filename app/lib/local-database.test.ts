import * as SQLite from "expo-sqlite";
import {
	initDatabase,
	restoreProfileCatalog,
	storedProfiles,
	updateStoredState,
	loadState,
	saveState,
	setActiveUser,
	pendingMutations,
	pendingCount,
	removeMutations,
	markAttempt,
	getValue,
	setValue,
	migrateLegacyAccount,
} from "./local-database";
import { initialState } from "@/state/reducer";
import type { SyncMutation } from "@vitalis/contracts";

jest.mock("expo-sqlite", () => jest.requireActual("@/testing/sqlite").sqliteBridge());
const mutation: SyncMutation = {
	mutationId: "m1",
	entity: "water",
	action: "upsert",
	payload: { id: "w1", amountMl: 500 },
	clientUpdatedAt: "2026-10-03T12:00:00Z",
};
beforeEach(async () => {
	await initDatabase();
	const db = await SQLite.openDatabaseAsync("test");
	await db.execAsync("DELETE FROM kv; DELETE FROM outbox; DELETE FROM outbox_v2;");
	setActiveUser("a");
});
test("snapshot e fila são confirmados ou revertidos juntos", async () => {
	const state = {
		...initialState,
		userId: "a",
		water: [{ id: "w1", amountMl: 500, date: "2026-10-03", time: "12:00" }],
	};
	await saveState(state, mutation);
	expect((await loadState())?.water).toEqual(state.water);
	expect(await pendingCount()).toBe(1);
	const db = await SQLite.openDatabaseAsync("test");
	await db.execAsync(
		"CREATE TEMP TRIGGER fail_queue BEFORE INSERT ON outbox_v2 BEGIN SELECT RAISE(ABORT, 'disk full'); END;",
	);
	await expect(
		saveState({ ...state, water: [] }, { ...mutation, mutationId: "m2" }),
	).rejects.toThrow("disk full");
	expect((await loadState())?.water).toEqual(state.water);
	expect(await pendingCount()).toBe(1);
	await db.execAsync("DROP TRIGGER fail_queue;");
});
test("cache, retries, acknowledgements e treino ficam isolados por conta", async () => {
	await saveState({ ...initialState, userId: "a" }, mutation);
	await setValue("active-workout", "treino-a");
	await saveState({ ...initialState, userId: "b" }, { ...mutation, mutationId: "m2" });
	setActiveUser("b");
	expect(await getValue("active-workout")).toBeNull();
	expect(await pendingMutations()).toMatchObject([{ mutationId: "m2" }]);
	await removeMutations(["m1"]);
	expect(await pendingCount("a")).toBe(1);
	await markAttempt(["m1"], "a");
	const db = await SQLite.openDatabaseAsync("test");
	expect(
		await db.getFirstAsync("SELECT attempts FROM outbox_v2 WHERE mutation_id = 'm1'"),
	).toMatchObject({ attempts: 1 });
	setActiveUser("a");
	expect(await getValue("active-workout")).toBe("treino-a");
	await removeMutations(["m1"]);
	expect(await pendingCount()).toBe(0);
});
test("migra dados legados somente após confirmar o e-mail da conta", async () => {
	const db = await SQLite.openDatabaseAsync("test");
	await db.runAsync(
		"INSERT INTO kv VALUES ('app-state', ?)",
		JSON.stringify({
			...initialState,
			profile: { ...initialState.profile, email: "a@example.com" },
		}),
	);
	await db.runAsync(
		"INSERT INTO outbox VALUES (?, ?, 2, ?)",
		"m1",
		JSON.stringify(mutation),
		"2026-10-03",
	);
	await migrateLegacyAccount("b", "b@example.com");
	expect(await loadState("b")).toBeNull();
	await migrateLegacyAccount("a", "A@example.com");
	expect((await loadState("a"))?.profile.email).toBe("a@example.com");
	expect(await pendingCount("a")).toBe(1);
	await migrateLegacyAccount("a", "a@example.com");
	expect(await pendingCount("a")).toBe(1);
});
test("rollback da fila não perde a gravação concorrente do treino", async () => {
	const db = await SQLite.openDatabaseAsync("test");
	const transaction = db.withExclusiveTransactionAsync.bind(db);
	let release!: () => void, started!: () => void;
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	const entered = new Promise<void>((resolve) => {
		started = resolve;
	});
	const spy = jest.spyOn(db, "withExclusiveTransactionAsync").mockImplementationOnce((work) =>
		transaction(async (tx) => {
			await work(tx);
			started();
			await gate;
			throw new Error("falha no commit");
		}),
	);
	const failed = saveState({ ...initialState, userId: "a" }, mutation).catch((error) => error);
	await entered;
	const workout = setValue("active-workout", "rota-preservada", "a");
	// A gravação independente pode chegar ao banco enquanto a transação está em aberto.
	for (let i = 0; i < 8; i++) await Promise.resolve();
	release();
	expect(await failed).toBeInstanceOf(Error);
	await workout;
	expect(await loadState("a")).toBeNull();
	expect(await pendingCount("a")).toBe(0);
	expect(await getValue("active-workout", "a")).toBe("rota-preservada");
	spy.mockRestore();
});

test("migração v2 preserva snapshots, fotos, treino, cursor e mutationIds", async () => {
	const db = await SQLite.openDatabaseAsync("test");
	await saveState(
		{
			...initialState,
			userId: "a",
			profile: { ...initialState.profile, avatar: "file://saved.jpg" },
		},
		mutation,
	);
	await setValue("active-workout", "rota");
	await setValue("sync-cursor", "cursor-antigo");
	await db.execAsync(
		"DROP INDEX IF EXISTS outbox_profile_sequence; ALTER TABLE outbox_v2 DROP COLUMN profile_id; PRAGMA user_version=2;",
	);
	await initDatabase();
	await initDatabase();
	expect((await loadState("a"))?.profile.avatar).toBe("file://saved.jpg");
	expect(await getValue("active-workout")).toBe("rota");
	expect(await getValue("sync-cursor")).toBe("cursor-antigo");
	expect((await pendingMutations())[0].mutationId).toBe("m1");
	expect(await pendingCount()).toBe(1);
});
test("cursor e snapshot são revertidos juntos quando a gravação falha", async () => {
	await saveState({ ...initialState, userId: "a", profileId: "a" });
	await setValue("sync-cursor", "antigo");
	const db = await SQLite.openDatabaseAsync("test");
	await db.execAsync(
		"CREATE TEMP TRIGGER fail_cursor BEFORE INSERT ON kv WHEN NEW.key = 'a:sync-cursor' BEGIN SELECT RAISE(ABORT, 'cursor failure'); END;",
	);
	try {
		await expect(updateStoredState("a", "a", (s) => ({ ...s, steps: 99 }), "novo")).rejects.toThrow(
			"cursor failure",
		);
		expect((await loadState())?.steps).toBe(0);
		expect(await getValue("sync-cursor")).toBe("antigo");
	} finally {
		await db.execAsync("DROP TRIGGER fail_cursor;");
	}
});

test("reparo de catálogo é transacional, idempotente e preserva cache/fila/cursor", async () => {
 await saveState({...initialState,userId:"a",profile:{...initialState.profile,name:"Principal"}},mutation,"cursor-original");
 await setValue("selected-profile","perfil-inexistente","a","a");
 const before=await loadState("a","a");
 const db=await SQLite.openDatabaseAsync("test");
 await db.execAsync("CREATE TEMP TRIGGER fail_catalog BEFORE INSERT ON kv WHEN NEW.key='a:profiles' BEGIN SELECT RAISE(ABORT,'disk full'); END;");
 await expect(restoreProfileCatalog("a")).rejects.toThrow("disk full");
 expect(await storedProfiles("a")).toEqual([]);
 expect(await getValue("selected-profile","a","a")).toBe("perfil-inexistente");
 await db.execAsync("DROP TRIGGER fail_catalog;");
 const first=await restoreProfileCatalog("a");
 expect(first.selected).toBe("a");
 expect(await restoreProfileCatalog("a")).toEqual(first);
 expect(await loadState("a","a")).toEqual(before);
 expect(await getValue("sync-cursor","a","a")).toBe("cursor-original");
 expect(await pendingCount("a","a")).toBe(1);
 expect((await restoreProfileCatalog("b")).profiles[0]).toMatchObject({id:"b",name:"Perfil principal"});
});

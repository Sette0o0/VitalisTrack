import * as SQLite from "expo-sqlite";
import {
  initDatabase,
  getValue,
  pendingMutations,
  removeMutations,
} from "./local-database";
import {
  saveWellbeing,
  listWellbeing,
  getWellbeing,
  receiveWellbeing,
  wellbeingCursor,
  pressureSeries,
  reminderRecords,
} from "./wellbeing-store";
import { claimStepAlert } from "./step-alert";
import {
  advanceTimer,
  addHeartRate,
  breathingPhase,
  formatCountdown,
} from "./wellbeing-timers";
import { projectReminder } from "./reminders";
import type { WellbeingInput, WellbeingRecord } from "@vitalis/contracts";
jest.mock("expo-sqlite", () =>
  jest.requireActual("@/testing/sqlite").sqliteBridge(),
);
jest.mock("./wellbeing-native", () => ({ wellbeingNative: null }));
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const sleep = (n: number): WellbeingInput => ({
  id: id(n),
  kind: "sleep",
  data: { date: "2026-11-07", durationMinutes: 480 },
});
beforeEach(async () => {
  await initDatabase();
  const db = await SQLite.openDatabaseAsync("test");
  await db.execAsync(
    "DELETE FROM wellbeing_records;DELETE FROM outbox_v2;DELETE FROM kv;",
  );
});
test("new table migration is repeatable and preserves existing values and outbox", async () => {
  const db = await SQLite.openDatabaseAsync("test");
  await db.runAsync(
    "INSERT INTO kv(key,value) VALUES (?,?)",
    "a:active-workout",
    "retained",
  );
  await saveWellbeing("a", "a", sleep(1));
  await initDatabase();
  expect(await getValue("active-workout", "a", "a")).toBe("retained");
  expect(await pendingMutations(100, "a", "a")).toHaveLength(1);
  expect((await listWellbeing("a", "a", "sleep")).records).toHaveLength(1);
});
test("record and mutation roll back atomically, plus foreign account/profile isolation", async () => {
  const db = await SQLite.openDatabaseAsync("test");
  await db.execAsync(
    "CREATE TEMP TRIGGER fail_well_queue BEFORE INSERT ON outbox_v2 BEGIN SELECT RAISE(ABORT,'disk full');END;",
  );
  await expect(saveWellbeing("a", "a", sleep(2))).rejects.toThrow("disk full");
  expect(await getWellbeing("a", "a", id(2))).toBeNull();
  await db.execAsync("DROP TRIGGER fail_well_queue");
  await saveWellbeing("a", "a", sleep(2));
  expect((await listWellbeing("b", "b", "sleep")).records).toHaveLength(0);
  expect((await listWellbeing("a", "other", "sleep")).records).toHaveLength(0);
});
test("remote receipt and cursor share rollback, pending local writes survive in-flight requests", async () => {
  await saveWellbeing("a", "a", sleep(3));
  const current = (await getWellbeing("a", "a", id(3)))!;
  const incoming = {
    ...current,
    data: { date: "2026-11-07", durationMinutes: 1 },
    revision: "9",
  } as WellbeingRecord;
  await receiveWellbeing("a", "a", {
    records: [incoming],
    cursor: "9",
    hasMore: false,
  });
  expect((await getWellbeing("a", "a", id(3)))!.data).toEqual(sleep(3).data);
  expect(await wellbeingCursor("a", "a")).toBe("9");
  await removeMutations(
    (await pendingMutations(100, "a", "a")).map((m) => m.mutationId),
    "a",
  );
  const db = await SQLite.openDatabaseAsync("test");
  await db.execAsync(
    "CREATE TEMP TRIGGER fail_cursor BEFORE UPDATE ON kv BEGIN SELECT RAISE(ABORT,'interrupted');END;",
  );
  await expect(
    receiveWellbeing("a", "a", {
      records: [incoming],
      cursor: "10",
      hasMore: false,
    }),
  ).rejects.toThrow();
  expect((await getWellbeing("a", "a", id(3)))!.data).toEqual(sleep(3).data);
  expect(await wellbeingCursor("a", "a")).toBe("9");
  await db.execAsync("DROP TRIGGER fail_cursor");
  await receiveWellbeing("a", "a", {
    records: [{ ...incoming, deletedAt: new Date().toISOString() }],
    cursor: "10",
    hasMore: false,
  });
  expect(await getWellbeing("a", "a", id(3))).toBeNull();
});
test("keyset pagination and blood pressure series remain scoped and bounded", async () => {
  for (let i = 10; i < 15; i++) await saveWellbeing("a", "a", sleep(i));
  const p = await listWellbeing("a", "a", "sleep", undefined, 2),
    q = await listWellbeing("a", "a", "sleep", p.nextCursor, 2);
  expect(new Set([...p.records, ...q.records].map((r) => r.id)).size).toBe(4);
  await saveWellbeing("a", "a", {
    id: id(20),
    kind: "bloodPressure",
    data: { occurredAt: "2026-11-07T10:00:00Z", systolic: 120, diastolic: 80 },
  });
  expect(await pressureSeries("a", "a", "2026-11-01")).toHaveLength(1);
  expect(await pressureSeries("a", "other", "2026-11-01")).toHaveLength(0);
});
test("one active fasting, editing same session and expired sessions", async () => {
  const startAt = new Date().toISOString(),
    endAt = new Date(Date.now() + 3600000).toISOString();
  const v: WellbeingInput = {
    id: id(30),
    kind: "fasting",
    data: { startAt, endAt, status: "active" },
  };
  await saveWellbeing("a", "a", v);
  await saveWellbeing("a", "a", v);
  await expect(saveWellbeing("a", "a", { ...v, id: id(31) })).rejects.toThrow(
    "Já existe",
  );
  await saveWellbeing("a", "a", {
    ...v,
    data: { ...v.data, status: "cancelled" },
  });
  await saveWellbeing("a", "a", { ...v, id: id(31) });
});
test("step threshold claim survives restarts, goal changes and duplicate concurrent evaluation", async () => {
  expect(await claimStepAlert("a", "a", "2026-11-07", 8, 10)).toBe(false);
  expect(
    await Promise.all([
      claimStepAlert("a", "a", "2026-11-07", 9, 10),
      claimStepAlert("a", "a", "2026-11-07", 10, 10),
    ]),
  ).toEqual([true, false]);
  expect(await claimStepAlert("a", "a", "2026-11-07", 10, 5)).toBe(false);
  expect(await claimStepAlert("a", "other", "2026-11-07", 9, 10)).toBe(true);
  expect(await claimStepAlert("a", "a", "2026-11-08", 9, 10)).toBe(true);
});
test("reminder projection contains neither names nor dosage; inactive reminders omitted", async () => {
  const m: WellbeingInput = {
    id: id(50),
    kind: "medication",
    data: {
      name: "Synthetic private name",
      dosage: "Synthetic private dose",
      weekdays: [1, 3],
      times: ["08:00"],
      enabled: true,
    },
  };
  await saveWellbeing("a", "a", m);
  const r = (await reminderRecords("a"))[0];
  const projected = projectReminder("a", r.profileId, r.record);
  expect(JSON.stringify(projected)).not.toMatch(/Synthetic|dosage|name/);
  expect(
    projectReminder("a", "a", {
      ...r.record,
      data: { ...m.data, enabled: false },
    } as WellbeingRecord),
  ).toEqual([]);
});
test("monotonic active timer excludes pauses and cardiac aggregation excludes gaps/duplicates", () => {
  let t = advanceTimer({ elapsedMs: 0, running: true, lastTick: 10 }, 1010);
  expect(t.elapsedMs).toBe(1000);
  t = advanceTimer({ ...t, running: false }, 99999);
  expect(t.elapsedMs).toBe(1000);
  expect(advanceTimer({ ...t, running: true }, 999999).elapsedMs).toBe(180000);
  expect(breathingPhase(0)).toBe("Inspire");
  expect(breathingPhase(4000)).toBe("Expire");
  expect(breathingPhase(180000)).toBe("Concluído");
  expect(formatCountdown(3661)).toBe("01:01:01");
  let h = { sum: 0, count: 0, lastSecond: -1 };
  h = addHeartRate(h, 100, 1, false);
  expect(addHeartRate(h, 150, 1, false)).toBe(h);
  expect(addHeartRate(h, 150, 2, true)).toBe(h);
  h = addHeartRate(h, 150, 8, false);
  expect(h.sum / h.count).toBe(125);
});

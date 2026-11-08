import * as SQLite from "expo-sqlite";
import { initDatabase, saveState, getValue, getDatabase, pendingMutations } from "./local-database";
import { initialState } from "@/state/reducer";
import { listTimeline, readReport, healthCsvRow } from "./report-store";
import { saveWellbeing } from "./wellbeing-store";
import { previewCleanup, executeCleanup } from "./retention";
import { backupHealthRow, backupProfileDetails, reportHtml } from "./export-format";
import { dailyReportExtras } from "./report-extras";
import type { AppState } from "@/state/types";
import { buildHealthReport } from "@vitalis/contracts";
jest.mock("expo-sqlite", () => jest.requireActual("@/testing/sqlite").sqliteBridge());
const owner = "00000000-0000-4000-8000-000000000001", other = "00000000-0000-4000-8000-000000000002", id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const state = (): AppState => ({ ...initialState, userId: owner, profileId: owner, authenticated: true, profile: { ...initialState.profile, avatar: "file://photo.jpg" }, water: [{ id: id(10), date: "2026-11-08", time: "12:00", amountMl: 1000 }], meals: [{ id: id(11), date: "2026-11-08", time: "12:00", name: "QA", calories: 500, quantity: 100, unit: "g" }], activities: [{ id: id(12), type: "walk", date: "2026-11-08", durationMinutes: 10, distanceKm: 1, calories: 100 }], weights: [{ id: id(13), date: "2026-11-08", weightKg: 70 }], dailySteps: [{ date: "2026-11-08", steps: 9000 }] });
beforeEach(async () => { await initDatabase(); const db = await getDatabase(); await db.execAsync("DELETE FROM kv;DELETE FROM health_records;DELETE FROM wellbeing_records;DELETE FROM medical_documents;DELETE FROM outbox_v2;"); });
test("v4 upgrade backfills an indexed history and preserves photo, cursors, pending and workout", async () => {
    const db = await getDatabase(), s = state();
    await db.execAsync("DROP TABLE health_records;PRAGMA user_version=4;");
    await db.runAsync("INSERT INTO kv(key,value) VALUES (?,?)", owner + ":app-state", JSON.stringify(s));
    for (const key of ["active-workout", "sync-cursor", "wellbeing-cursor"])
        await db.runAsync("INSERT INTO kv(key,value) VALUES (?,?)", owner + ":" + key, "retained");
    await initDatabase();
    await initDatabase();
    expect((await db.getAllAsync("SELECT * FROM health_records"))).toHaveLength(5);
    expect(await getValue("active-workout", owner, owner)).toBe("retained");
    expect(JSON.parse((await getValue("app-state", owner, owner))!).profile.avatar).toBe("file://photo.jpg");
    expect((await db.getFirstAsync<{
        user_version: number;
    }>("PRAGMA user_version"))!.user_version).toBe(5);
});
test("projection, outbox and snapshot rollback together; editing and deletion update the read model", async () => {
    const db = await getDatabase(), s = state();
    await saveState(s);
    await db.execAsync("CREATE TEMP TRIGGER fail_projection BEFORE UPDATE ON health_records BEGIN SELECT RAISE(ABORT,'projection');END;");
    await expect(saveState({ ...s, meals: [{ ...s.meals[0], name: "changed" }] })).rejects.toThrow("projection");
    expect(JSON.parse((await getValue("app-state", owner, owner))!).meals[0].name).toBe("QA");
    await db.execAsync("DROP TRIGGER fail_projection;");
    await saveState({ ...s, meals: [] });
    expect((await listTimeline(owner, owner, "meal")).records).toHaveLength(0);
});
test("mixed timeline paginates ties, filters and never exposes another profile", async () => {
    await saveState(state());
    await saveState({ ...state(), profileId: other });
    await saveWellbeing(owner, owner, { id: id(14), kind: "mood", data: { occurredAt: "2026-11-08T13:00:00Z", score: 4, notes: "QA", symptoms: [], mealIds: [], activityIds: [] } });
    const a = await listTimeline(owner, owner, undefined, undefined, 2), b = await listTimeline(owner, owner, undefined, a.nextCursor, 2);
    expect(a.records.concat(b.records)).toHaveLength(4);
    expect(new Set(a.records.concat(b.records).map(r => r.kind + r.id)).size).toBe(4);
    expect((await listTimeline(other, owner)).records).toHaveLength(0);
    expect((await listTimeline(owner, owner, "weight", undefined, 30, "imperial")).records[0].detail).toContain("lb");
    expect((await listTimeline(owner, owner, "activity")).records[0].time).toBe("");
});
test("SQL report aggregation matches shared calculations and daily extras remain scoped", async () => {
    const s = state();
    s.weights.push({ id: id(15), date: "2026-11-08", weightKg: 72 });
    s.activities.push({ ...s.activities[0], id: id(16) });
    await saveState(s);
    await saveWellbeing(owner, owner, { id: id(17), kind: "sleep", data: { date: "2026-11-08", durationMinutes: 480 } });
    await saveWellbeing(owner, owner, { id: id(18), kind: "bloodPressure", data: { occurredAt: "2026-11-08T12:00:00Z", systolic: 120, diastolic: 80 } });
    const report = await readReport(owner, owner, "day", "2026-11-08", s.goals);
    expect(report.totals).toMatchObject({ waterMl: 1000, consumedKcal: 500, activityKcal: 200, activityCount: 2, steps: 9000, distanceMeters: 2000 });
    expect(report.days[0].weightKg).toBe(71);
    expect((await dailyReportExtras(owner, owner, "2026-11-08")).join(" ")).toMatch(/8 h 0 min.*120\/80/);
    expect(await dailyReportExtras(owner, other, "2026-11-08")).toEqual([]);
});
test("cleanup preserves cutoff boundary, edited candidates, plans and active fasting; queues tombstones", async () => {
    const s = state();
    s.water[0].date = "2025-11-07";
    s.meals[0].date = "2025-11-07";
    s.activities[0].date = "2025-11-08";
    s.dailySteps![0].date = "2025-11-07";
    await saveState(s);
    await saveWellbeing(owner, owner, { id: id(20), kind: "sleep", data: { date: "2025-11-07", durationMinutes: 480 } });
    await saveWellbeing(owner, owner, { id: id(21), kind: "fasting", data: { startAt: "2024-01-01T10:00:00Z", endAt: "2024-01-02T10:00:00Z", status: "active" } });
    const preview = await previewCleanup(owner, owner, "2026-11-08");
    expect(preview.candidates).toHaveLength(4);
    await saveState({ ...s, meals: [{ ...s.meals[0], name: "edited" }] });
    expect(await executeCleanup(preview)).toEqual({ removed: 3, skipped: 1 });
    const current = JSON.parse((await getValue("app-state", owner, owner))!);
    expect(current.water).toEqual([]);
    expect(current.meals).toHaveLength(1);
    expect(current.activities).toHaveLength(1);
    expect(current.dailySteps).toEqual([]);
    expect(current.profile.avatar).toBe("file://photo.jpg");
    const pending = await pendingMutations(100, owner, owner);
    expect(pending.some(m => m.entity === "steps" && m.action === "delete" && m.payload?.date === "2025-11-07")).toBe(true);
    expect((await (await getDatabase()).getFirstAsync<{
        deleted: number;
    }>("SELECT deleted FROM wellbeing_records WHERE id=?", id(20)))!.deleted).toBe(1);
});
test("cleanup interruption rolls back all deleted data and queued operations", async () => {
    const s = state();
    s.water[0].date = "2020-01-01";
    await saveState(s);
    const db = await getDatabase(), preview = await previewCleanup(owner, owner, "2026-11-08");
    await db.execAsync("CREATE TEMP TRIGGER fail_clean BEFORE INSERT ON outbox_v2 BEGIN SELECT RAISE(ABORT,'disk full');END;");
    await expect(executeCleanup(preview)).rejects.toThrow("disk full");
    expect(JSON.parse((await getValue("app-state", owner, owner))!).water).toHaveLength(1);
    await db.execAsync("DROP TRIGGER fail_clean");
});
test("CSV escapes quotes/newlines and formulas, canonical exports remove session/internal fields", () => {
    expect(healthCsvRow("meal", owner, { id: id(1), date: "2026-11-08", name: '=SUM(1,2)\n"QA"', quantity: 1, calories: 2, unit: "g" })).toContain('"\'=SUM(1,2)\n""QA"""');
    expect(backupHealthRow("activity", { id: id(1), date: "2026-11-08", durationMinutes: 10, distanceKm: 1, accessToken: "SECRET", route: [{ latitude: 1, longitude: 2, token: "SECRET" }] })).toEqual({ id: id(1), date: "2026-11-08", durationSeconds: 600, distanceMeters: 1000, route: [{ latitude: 1, longitude: 2 }] });
    expect(JSON.stringify(backupProfileDetails({ ...state().profile, avatarRemoteUrl: "SECRET" }))).not.toContain("SECRET");
    const report = buildHealthReport({ water: [], meals: [], activities: [], weights: [], steps: [] }, "day", "2026-11-08", state().goals);
    expect(reportHtml(report, '<script>"QA"</script>', "imperial", true)).toContain("&lt;script&gt;&quot;QA&quot;&lt;/script&gt;");
    expect(reportHtml(report, "QA", "imperial", true)).toContain("Peso lb");
});

test("a failed v4 migration rolls back its new tables and version without losing cached data", async()=>{
 const db=await getDatabase(),s=state();await saveState(s);
 await db.execAsync('DROP TABLE health_records;DROP TABLE medical_documents;PRAGMA user_version=4;CREATE TABLE medical_documents(user_id TEXT,profile_id TEXT,id TEXT);');
 try{
  await expect(initDatabase()).rejects.toThrow();
  expect((await db.getFirstAsync<{user_version:number}>('PRAGMA user_version'))!.user_version).toBe(4);
  expect(await db.getAllAsync("SELECT name FROM sqlite_master WHERE type='table' AND name='health_records'")).toHaveLength(0);
  expect(JSON.parse((await getValue('app-state',owner,owner))!)).toEqual(s);
 }finally{await db.execAsync('DROP TABLE medical_documents;');await initDatabase();}
});

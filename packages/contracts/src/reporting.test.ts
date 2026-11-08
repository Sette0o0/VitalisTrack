import { test, expect } from "vitest";
import { reportWindow, retentionCutoff, buildHealthReport, medicalDocumentSchema, backupSchema, type HealthHistory } from "./reporting";
const empty: HealthHistory = { water: [], meals: [], activities: [], weights: [], steps: [] };
test("calendar month and rolling week are distinct; leap years and year boundaries", () => {
    expect(reportWindow("week", "2026-01-03")).toEqual({ start: "2025-12-28", end: "2026-01-03" });
    expect(reportWindow("month", "2024-02-10")).toEqual({ start: "2024-02-01", end: "2024-02-29" });
    expect(retentionCutoff("2024-02-29")).toBe("2023-02-28");
    expect(retentionCutoff("2026-11-08")).toBe("2025-11-08");
    expect(() => reportWindow("day", "2026-02-30")).toThrow();
});
test("reports sum registered calories only, weight averages and missing-data flags", () => {
    const report = buildHealthReport({ ...empty, water: [{ id: "1", date: "2026-11-08", amountMl: 2500 }], meals: [{ id: "m", date: "2026-11-08", name: "QA", calories: 500 }], activities: [{ id: "a", date: "2026-11-08", type: "run", durationSeconds: 600, distanceMeters: 1000, calories: 100 }], weights: [{ id: "w", date: "2026-11-08", weightKg: 70 }, { id: "w2", date: "2026-11-08", weightKg: 72 }], steps: [{ date: "2026-11-08", steps: 9000 }] }, "week", "2026-11-08", { waterMl: 2500, steps: 10000 });
    expect(report.days).toHaveLength(7);
    expect(report.days.at(-1)?.weightKg).toBe(71);
    expect(report.days[0]?.hasWater).toBe(false);
    expect(report.totals.activityKcal).toBe(100);
    expect(report.totals.consumedKcal).toBe(500);
    expect(report.text.join(" ")).toContain("1 de 1 dia");
    expect(report.text.join(" ")).toContain("6 dias sem registros");
    expect(report.text.join(" ")).not.toMatch(/diagnóstico|tratamento/);
});
test("empty periods do not pretend hydration and grouped activity counts are preserved", () => {
    const report = buildHealthReport(empty, "month", "2026-11-08", { waterMl: 2500, steps: 10000 });
    expect(report.days).toHaveLength(30);
    expect(report.text.join(" ")).toContain("não é possível avaliar");
    expect(buildHealthReport({ ...empty, activities: [{ id: "s", date: "2026-11-08", type: "summary", durationSeconds: 100, distanceMeters: 0, calories: 20, count: 3 }] }, "day", "2026-11-08", { waterMl: 1, steps: 1 }).totals.activityCount).toBe(3);
});
test("document metadata and backup envelopes validate versions, limits and secrets at root", () => {
    expect(medicalDocumentSchema.safeParse({ id: crypto.randomUUID(), profileId: crypto.randomUUID(), name: "exame.pdf", mimeType: "text/html", size: 1, sha256: "a".repeat(64), revision: "0", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), deletedAt: null }).success).toBe(false);
    const backup = { format: "VitalisTrack", version: 1, exportedAt: new Date().toISOString(), userId: crypto.randomUUID(), units: "kg-cm-m-ml", lastSyncedAt: null, includesPendingChanges: false, profiles: [], friendships: [], blobs: [] };
    expect(backupSchema.safeParse(backup).success).toBe(true);
    expect(backupSchema.safeParse({ ...backup, version: 2 }).success).toBe(false);
    expect(backupSchema.safeParse({ ...backup, accessToken: "secret" }).success).toBe(false);
});

import { test, expect } from "vitest";
import {
  wellbeingInputSchema,
  heartRateSummarySchema,
  sleepMessage,
  fastingRemaining,
  canInteractWithActivity,
  activityInputSchema,
} from "./index.js";
const id = crypto.randomUUID();
test("wellbeing validates all kinds and rejects invalid clinical/scheduling input", () => {
  const cases = [
    ["workoutPlan", { days: [{ weekday: 1, type: "run", time: "08:00" }] }],
    [
      "medication",
      {
        name: "QA",
        dosage: "Informada",
        weekdays: [1],
        times: ["08:00", "20:00"],
        enabled: true,
      },
    ],
    ["breathingReminder", { time: "20:00", enabled: true }],
    [
      "breathing",
      {
        startedAt: "2026-11-07T10:00:00Z",
        completedAt: "2026-11-07T10:03:00Z",
        activeSeconds: 180,
      },
    ],
    ["sleep", { date: "2026-11-07", durationMinutes: 480 }],
    [
      "mood",
      {
        occurredAt: "2026-11-07T10:00:00Z",
        score: 3,
        notes: "",
        symptoms: ["Fadiga"],
        mealIds: [],
        activityIds: [],
      },
    ],
    [
      "fasting",
      {
        startAt: "2026-11-07T23:00:00-03:00",
        endAt: "2026-11-08T01:00:00-03:00",
        status: "active",
      },
    ],
    [
      "bloodPressure",
      { occurredAt: "2026-11-07T10:00:00Z", systolic: 120, diastolic: 80 },
    ],
  ];
  for (const [kind, data] of cases)
    expect(wellbeingInputSchema.safeParse({ id, kind, data }).success).toBe(
      true,
    );
  for (const [kind, data] of [
    [
      "medication",
      {
        name: "QA",
        dosage: "QA",
        weekdays: [1, 1],
        times: ["25:00"],
        enabled: true,
      },
    ],
    ["sleep", { date: "2026-11-07", durationMinutes: 0 }],
    [
      "bloodPressure",
      { occurredAt: "2026-11-07T10:00:00Z", systolic: 80, diastolic: 120 },
    ],
    [
      "breathing",
      {
        startedAt: "2026-11-07T10:00:00Z",
        completedAt: "2026-11-07T10:01:00Z",
        activeSeconds: 180,
      },
    ],
    [
      "fasting",
      {
        startAt: "2026-11-08T00:00:00Z",
        endAt: "2026-11-07T00:00:00Z",
        status: "active",
      },
    ],
  ])
    expect(wellbeingInputSchema.safeParse({ id, kind, data }).success).toBe(
      false,
    );
});
test("optional activity fields preserve legacy clients, explicit null clears heart rate", () => {
  const legacy = {
    id,
    type: "run",
    date: "2026-11-07",
    durationSeconds: 60,
    distanceMeters: 100,
  };
  const p = activityInputSchema.parse(legacy);
  expect(p.visibility).toBeUndefined();
  expect(p.heartRate).toBeUndefined();
  expect(
    activityInputSchema.parse({ ...legacy, heartRate: null }).heartRate,
  ).toBeNull();
  expect(
    heartRateSummarySchema.safeParse({
      source: "ble",
      sum: 300,
      count: 2,
      averageBpm: 150,
    }).success,
  ).toBe(true);
  expect(
    heartRateSummarySchema.safeParse({
      source: "ble",
      sum: 300,
      count: 2,
      averageBpm: 140,
    }).success,
  ).toBe(false);
});
test("eight hour reference, overnight countdown and future interaction authorization", () => {
  expect(sleepMessage(479)).toContain("menos");
  expect(sleepMessage(480)).toBe("Você registrou 8 horas de sono.");
  expect(sleepMessage(481)).toContain("mais");
  expect(
    fastingRemaining(
      "2026-11-08T01:00:00Z",
      Date.parse("2026-11-07T23:59:59Z"),
    ),
  ).toBe(3601);
  expect(fastingRemaining("2026-01-01T00:00:00Z", Date.now())).toBe(0);
  expect(canInteractWithActivity("private", true)).toBe(false);
  expect(canInteractWithActivity("friends", false)).toBe(false);
  expect(canInteractWithActivity("friends", true)).toBe(true);
});

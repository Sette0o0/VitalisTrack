import { z } from "zod";
const id = z.uuid(),
  date = z.iso.date(),
  instant = z.iso.datetime({ offset: true });
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm");
const weekdays = z
  .array(z.number().int().min(0).max(6))
  .min(1)
  .max(7)
  .refine((v) => new Set(v).size === v.length, "Dias repetidos");
export const wellbeingKinds = [
  "workoutPlan",
  "medication",
  "breathingReminder",
  "breathing",
  "sleep",
  "mood",
  "fasting",
  "bloodPressure",
] as const;
export const wellbeingKindSchema = z.enum(wellbeingKinds);
export const visibilitySchema = z.enum(["private", "friends"]);
export const heartRateSummarySchema = z.discriminatedUnion("source", [
  z
    .object({
      source: z.literal("manual"),
      averageBpm: z.number().int().positive().max(65535),
    })
    .strict(),
  z
    .object({
      source: z.literal("ble"),
      averageBpm: z.number().positive().max(65535),
      sum: z.number().int().positive().safe(),
      count: z.number().int().positive().max(86400),
    })
    .strict()
    .refine(
      (v) => Math.abs(v.averageBpm - v.sum / v.count) < 0.051,
      "Média cardíaca divergente",
    ),
]);
const schemas = {
  workoutPlan: z.object({
    days: z
      .array(
        z.object({
          weekday: z.number().int().min(0).max(6),
          type: z.enum(["walk", "run", "cycling"]),
          time,
        }),
      )
      .min(1)
      .max(7)
      .refine(
        (v) => new Set(v.map((d) => d.weekday)).size === v.length,
        "Dias repetidos",
      ),
  }),
  medication: z.object({
    name: z.string().trim().min(1).max(120),
    dosage: z.string().trim().min(1).max(120),
    weekdays,
    times: z
      .array(time)
      .min(1)
      .max(24)
      .refine((v) => new Set(v).size === v.length, "Horários repetidos"),
    enabled: z.boolean(),
  }),
  breathingReminder: z.object({ time, enabled: z.boolean() }),
  breathing: z
    .object({
      startedAt: instant,
      completedAt: instant,
      activeSeconds: z.literal(180),
    })
    .refine(
      (v) => Date.parse(v.completedAt) - Date.parse(v.startedAt) >= 180000,
      "Duração incompleta",
    ),
  sleep: z.object({ date, durationMinutes: z.number().int().min(1).max(1440) }),
  mood: z.object({
    occurredAt: instant,
    score: z.number().int().min(1).max(5),
    notes: z.string().max(2000),
    symptoms: z.array(z.string().trim().min(1).max(120)).max(50),
    mealIds: z.array(id).max(100),
    activityIds: z.array(id).max(100),
  }),
  fasting: z
    .object({
      startAt: instant,
      endAt: instant,
      status: z.enum(["active", "completed", "cancelled"]),
    })
    .refine(
      (v) => Date.parse(v.endAt) > Date.parse(v.startAt),
      "O término deve ser posterior ao início",
    ),
  bloodPressure: z
    .object({
      occurredAt: instant,
      systolic: z.number().int().positive().max(1000),
      diastolic: z.number().int().positive().max(1000),
    })
    .refine(
      (v) => v.systolic > v.diastolic,
      "A sistólica deve ser maior que a diastólica",
    ),
};
export const wellbeingInputSchema = z.discriminatedUnion("kind", [
  z.object({ id, kind: z.literal("workoutPlan"), data: schemas.workoutPlan }),
  z.object({ id, kind: z.literal("medication"), data: schemas.medication }),
  z.object({
    id,
    kind: z.literal("breathingReminder"),
    data: schemas.breathingReminder,
  }),
  z.object({ id, kind: z.literal("breathing"), data: schemas.breathing }),
  z.object({ id, kind: z.literal("sleep"), data: schemas.sleep }),
  z.object({ id, kind: z.literal("mood"), data: schemas.mood }),
  z.object({ id, kind: z.literal("fasting"), data: schemas.fasting }),
  z.object({
    id,
    kind: z.literal("bloodPressure"),
    data: schemas.bloodPressure,
  }),
]);
export type WellbeingInput = z.infer<typeof wellbeingInputSchema>;
export type WellbeingKind = z.infer<typeof wellbeingKindSchema>;
export type WellbeingRecord = WellbeingInput & {
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  revision: string;
};
export const wellbeingChangesQuerySchema = z.object({
  cursor: z.string().regex(/^\d+$/).default("0"),
  limit: z.coerce.number().int().min(1).max(100).default(100),
});
export type WellbeingChanges = {
  records: WellbeingRecord[];
  cursor: string;
  hasMore: boolean;
};
export const wellbeingPaths: Record<WellbeingKind, string> = {
  workoutPlan: "workout-plans",
  medication: "medications",
  breathingReminder: "breathing-reminders",
  breathing: "breathing-sessions",
  sleep: "sleep",
  mood: "mood",
  fasting: "fasting",
  bloodPressure: "blood-pressure",
};
export type Friendship = {
  id: string;
  status: "pending" | "accepted" | "rejected" | "revoked";
  incoming: boolean;
  other: { id: string; name: string };
};
export type SharedActivity = {
  id: string;
  date: string;
  type: "walk" | "run" | "cycling";
  durationSeconds: number;
  distanceMeters: number;
  calories: number;
};
export const sleepMessage = (minutes: number) =>
  minutes < 480
    ? "Você registrou menos de 8 horas de sono."
    : minutes === 480
      ? "Você registrou 8 horas de sono."
      : "Você registrou mais de 8 horas de sono.";
export const fastingRemaining = (endAt: string, now = Date.now()) =>
  Math.max(0, Math.ceil((Date.parse(endAt) - now) / 1000));
export const canInteractWithActivity = (
  visibility: string,
  acceptedFriend: boolean,
) => visibility === "friends" && acceptedFriend;

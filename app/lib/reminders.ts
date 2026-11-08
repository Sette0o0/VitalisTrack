import type { WellbeingRecord } from "@vitalis/contracts";
import { getValue, setValue } from "./local-database";
import { reminderRecords } from "./wellbeing-store";
import { wellbeingNative } from "./wellbeing-native";
export type ReminderProjection = {
  key: string;
  userId: string;
  profileId: string;
  kind: string;
  weekdays: number[];
  times: string[];
};
export function projectReminder(
  userId: string,
  profileId: string,
  r: WellbeingRecord,
): ReminderProjection[] {
  const base = { userId, profileId, kind: r.kind };
  if (r.deletedAt) return [];
  if (r.kind === "workoutPlan")
    return r.data.days.map((d) => ({
      ...base,
      key: `${userId}:${profileId}:${r.id}:${d.weekday}`,
      weekdays: [d.weekday],
      times: [d.time],
    }));
  if (r.kind === "medication" && r.data.enabled)
    return [
      {
        ...base,
        key: `${userId}:${profileId}:${r.id}`,
        weekdays: r.data.weekdays,
        times: r.data.times,
      },
    ];
  if (r.kind === "breathingReminder" && r.data.enabled)
    return [
      {
        ...base,
        key: `${userId}:${profileId}:${r.id}`,
        weekdays: [0, 1, 2, 3, 4, 5, 6],
        times: [r.data.time],
      },
    ];
  return [];
}
let generation = 0;
let queue = Promise.resolve();
export const reminderEnabled = async (userId: string, profileId: string) =>
  (await getValue("reminders-enabled", userId, profileId)) === "true";
export async function setReminderEnabled(
  userId: string,
  profileId: string,
  enabled: boolean,
) {
  await setValue("reminders-enabled", String(enabled), userId, profileId);
}
// Serialize projection writes so a slow rebuild cannot re-enable an account after logout.
export function reconcileReminders(userId: string) {
  const epoch = generation;
  const operation = queue
    .catch(() => {})
    .then(async () => {
      if (!wellbeingNative || epoch !== generation) return;
      const rows = await reminderRecords(userId);
      const enabled = new Map<string, boolean>();
      const plans: ReminderProjection[] = [];
      for (const row of rows) {
        if (!enabled.has(row.profileId))
          enabled.set(
            row.profileId,
            await reminderEnabled(userId, row.profileId),
          );
        if (enabled.get(row.profileId))
          plans.push(...projectReminder(userId, row.profileId, row.record));
      }
      if (epoch === generation)
        await wellbeingNative.configure(userId, JSON.stringify(plans));
    });
  queue = operation;
  return operation;
}
export function clearNativeAccount() {
  generation++;
  const op = queue
    .catch(() => {})
    .then(async () => {
      await wellbeingNative?.clearAccount();
    });
  queue = op;
  return op;
}

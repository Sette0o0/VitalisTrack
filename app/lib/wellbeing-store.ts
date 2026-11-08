import {
  wellbeingInputSchema,
  type WellbeingInput,
  type WellbeingRecord,
  type WellbeingKind,
  type WellbeingChanges,
} from "@vitalis/contracts";
import { getDatabase, serializeWrite, getValue } from "./local-database";
import { newId } from "./health";
import { UserFacingError } from "./user-error";
import type { LocalMutation } from "@/state/types";
const listeners = new Set<(reason: "local" | "remote") => void>();
export const onWellbeingChanged = (
  fn: (reason: "local" | "remote") => void,
) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
export const notifyWellbeingChanged = (reason: "local" | "remote") => {
  for (const fn of listeners) fn(reason);
};
const sortAt = (r: WellbeingRecord) =>
  "occurredAt" in r.data
    ? r.data.occurredAt
    : "date" in r.data
      ? r.data.date
      : "startAt" in r.data
        ? r.data.startAt
        : "startedAt" in r.data
          ? r.data.startedAt
          : r.createdAt;
async function put(
  tx: Pick<import("expo-sqlite").SQLiteDatabase, "runAsync">,
  userId: string,
  profileId: string,
  r: WellbeingRecord,
) {
  await tx.runAsync(
    "INSERT INTO wellbeing_records(user_id,profile_id,id,kind,record,sort_at,deleted) VALUES (?,?,?,?,?,?,?) ON CONFLICT(user_id,profile_id,id) DO UPDATE SET record=excluded.record,kind=excluded.kind,sort_at=excluded.sort_at,deleted=excluded.deleted",
    userId,
    profileId,
    r.id,
    r.kind,
    JSON.stringify(r),
    sortAt(r),
    r.deletedAt ? 1 : 0,
  );
}
export async function saveWellbeing(
  userId: string,
  profileId: string,
  value: WellbeingInput,
  remove = false,
) {
  const input = wellbeingInputSchema.safeParse(value);
  if (!input.success)
    throw new UserFacingError(
      input.error.issues[0]?.message ?? "Revise os dados informados.",
    );
  const db = await getDatabase();
  await serializeWrite(() =>
    db.withExclusiveTransactionAsync(async (tx) => {
      const found = await tx.getFirstAsync<{ record: string }>(
        "SELECT record FROM wellbeing_records WHERE user_id=? AND profile_id=? AND id=?",
        userId,
        profileId,
        value.id,
      );
      const old = found ? (JSON.parse(found.record) as WellbeingRecord) : null;
      if (old && old.kind !== value.kind)
        throw new UserFacingError("O tipo do registro não pode ser alterado.");
      if (
        !remove &&
        value.kind === "fasting" &&
        value.data.status === "active" &&
        Date.parse(value.data.endAt) > Date.now()
      ) {
        const rows = await tx.getAllAsync<{ record: string }>(
          "SELECT record FROM wellbeing_records WHERE user_id=? AND profile_id=? AND kind=? AND deleted=0 AND id<>?",
          userId,
          profileId,
          "fasting",
          value.id,
        );
        if (
          rows.some((r) => {
            const v = JSON.parse(r.record) as Extract<
              WellbeingRecord,
              { kind: "fasting" }
            >;
            return (
              v.data.status === "active" &&
              Date.parse(v.data.endAt) > Date.now()
            );
          })
        )
          throw new UserFacingError("Já existe um jejum ativo neste perfil.");
      }
      const now = new Date().toISOString();
      const r = {
        ...input.data,
        createdAt: old?.createdAt ?? now,
        updatedAt: now,
        deletedAt: remove ? now : null,
        revision: old?.revision ?? "0",
      } as WellbeingRecord;
      const mutation: LocalMutation = {
        mutationId: newId(),
        profileId,
        entity: "wellbeing",
        action: remove ? "delete" : "upsert",
        ...(remove ? { entityId: value.id } : { payload: input.data }),
        clientUpdatedAt: now,
      };
      await put(tx, userId, profileId, r);
      await tx.runAsync(
        "INSERT INTO outbox_v2(user_id,profile_id,mutation_id,mutation) VALUES (?,?,?,?)",
        userId,
        profileId,
        mutation.mutationId,
        JSON.stringify(mutation),
      );
    }),
  );
  notifyWellbeingChanged("local");
}
export async function getWellbeing(
  userId: string,
  profileId: string,
  id: string,
) {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ record: string }>(
    "SELECT record FROM wellbeing_records WHERE user_id=? AND profile_id=? AND id=? AND deleted=0",
    userId,
    profileId,
    id,
  );
  return row ? (JSON.parse(row.record) as WellbeingRecord) : null;
}
export async function listWellbeing(
  userId: string,
  profileId: string,
  kind: WellbeingKind,
  cursor?: { at: string; id: string },
  limit = 30,
) {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    record: string;
    sort_at: string;
    id: string;
  }>(
    `SELECT record,sort_at,id FROM wellbeing_records WHERE user_id=? AND profile_id=? AND kind=? AND deleted=0 ${cursor ? "AND (sort_at < ? OR (sort_at = ? AND id < ?))" : ""} ORDER BY sort_at DESC,id DESC LIMIT ?`,
    userId,
    profileId,
    kind,
    ...(cursor ? [cursor.at, cursor.at, cursor.id] : []),
    Math.min(100, limit) + 1,
  );
  const page = rows.slice(0, limit);
  return {
    records: page.map((r) => JSON.parse(r.record) as WellbeingRecord),
    nextCursor:
      rows.length > limit && page.length
        ? { at: page[page.length - 1].sort_at, id: page[page.length - 1].id }
        : undefined,
  };
}
export const wellbeingCursor = (userId: string, profileId: string) =>
  getValue("wellbeing-cursor", userId, profileId);
export async function receiveWellbeing(
  userId: string,
  profileId: string,
  page: WellbeingChanges,
) {
  const db = await getDatabase();
  await serializeWrite(() =>
    db.withExclusiveTransactionAsync(async (tx) => {
      // Read pending IDs inside this transaction, so edits made while the request was in flight win locally.
      const pending = await tx.getAllAsync<{ mutation: string }>(
        "SELECT mutation FROM outbox_v2 WHERE user_id=? AND profile_id=?",
        userId,
        profileId,
      );
      const protectedIds = new Set(
        pending
          .map((r) => JSON.parse(r.mutation) as LocalMutation)
          .filter((m) => m.entity === "wellbeing")
          .map((m) => m.entityId ?? m.payload?.id),
      );
      for (const r of page.records) {
        if (!protectedIds.has(r.id)) await put(tx, userId, profileId, r);
      }
      const key = `${userId}:${profileId === userId ? "" : profileId + ":"}wellbeing-cursor`;
      await tx.runAsync(
        "INSERT INTO kv(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        key,
        page.cursor,
      );
    }),
  );
  notifyWellbeingChanged("remote");
}
// Only scheduling configuration is read across profiles, never full clinical histories.
export async function reminderRecords(userId: string) {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ profile_id: string; record: string }>(
    "SELECT profile_id,record FROM wellbeing_records WHERE user_id=? AND deleted=0 AND kind IN (?,?,?)",
    userId,
    "workoutPlan",
    "medication",
    "breathingReminder",
  );
  return rows.map((r) => ({
    profileId: r.profile_id,
    record: JSON.parse(r.record) as WellbeingRecord,
  }));
}
export async function pressureSeries(
  userId: string,
  profileId: string,
  from: string,
) {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ record: string }>(
    "SELECT record FROM wellbeing_records WHERE user_id=? AND profile_id=? AND kind=? AND deleted=0 AND sort_at>=? ORDER BY sort_at DESC,id DESC LIMIT 100",
    userId,
    profileId,
    "bloodPressure",
    from,
  );
  return rows
    .map(
      (r) =>
        JSON.parse(r.record) as Extract<
          WellbeingRecord,
          { kind: "bloodPressure" }
        >,
    )
    .reverse();
}

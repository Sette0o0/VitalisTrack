import type { SQLiteDatabase } from "expo-sqlite";
type Tx = Pick<SQLiteDatabase, "runAsync">;
export const historySources = [
    ["water", "water"], ["meal", "meals"], ["activity", "activities"], ["weight", "weights"], ["steps", "dailySteps"],
] as const;
// This indexed read model is maintained in the same transaction as the existing snapshot.
// JSON1 does the projection in SQLite; no second full history is allocated in JavaScript.
export async function projectSnapshot(tx: Tx, value: string) {
    for (const [kind, array] of historySources) {
        await tx.runAsync(`INSERT INTO health_records(user_id,profile_id,kind,id,day,time,record)
      SELECT json_extract(?, '$.userId'), COALESCE(json_extract(?, '$.profileId'),json_extract(?, '$.userId')), ?,
        COALESCE(json_extract(e.value,'$.id'),json_extract(e.value,'$.date')), json_extract(e.value,'$.date'), COALESCE(json_extract(e.value,'$.time'),''), e.value
      FROM json_each(?, '$.${array}') e WHERE json_extract(?, '$.userId') IS NOT NULL AND json_extract(e.value,'$.date') IS NOT NULL
      ON CONFLICT(user_id,profile_id,kind,id) DO UPDATE SET day=excluded.day,time=excluded.time,record=excluded.record WHERE health_records.record<>excluded.record`, value, value, value, kind, value, value);
        await tx.runAsync(`DELETE FROM health_records WHERE user_id=json_extract(?,'$.userId') AND profile_id=COALESCE(json_extract(?,'$.profileId'),json_extract(?,'$.userId')) AND kind=?
      AND id NOT IN (SELECT COALESCE(json_extract(value,'$.id'),json_extract(value,'$.date')) FROM json_each(?,'$.${array}'))`, value, value, value, kind, value);
    }
}
const listeners = new Set<() => void>();
export const onHistoryChanged = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const notifyHistoryChanged = () => { for (const listener of listeners)
    listener(); };

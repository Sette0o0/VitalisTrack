import { getDatabase, serializeWrite } from "./local-database";
export async function claimStepAlert(
  userId: string,
  profileId: string,
  date: string,
  steps: number,
  goal: number,
) {
  if (!Number.isInteger(goal) || goal <= 0 || steps < Math.ceil(goal * 0.9))
    return false;
  const db = await getDatabase();
  let claimed = false;
  await serializeWrite(() =>
    db.withExclusiveTransactionAsync(async (tx) => {
      const key = `${userId}:${profileId}:step-alert:${date}`;
      const result = await tx.runAsync(
        "INSERT OR IGNORE INTO kv(key,value) VALUES (?,?)",
        key,
        "shown",
      );
      claimed = result.changes > 0;
    }),
  );
  return claimed;
}

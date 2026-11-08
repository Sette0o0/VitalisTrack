import {
  wellbeingInputSchema,
  type WellbeingRecord as WireRecord,
} from "@vitalis/contracts";
import { Prisma, type WellbeingRecord } from "../../generated/prisma/client.js";
import { AppError } from "./errors.js";
export const wellbeingJson = (r: WellbeingRecord): WireRecord =>
  ({
    id: r.id,
    kind: r.kind,
    data: r.data,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    deletedAt: r.deletedAt?.toISOString() ?? null,
    revision: String(r.revision),
  }) as WireRecord;
export async function writeWellbeing(
  tx: Prisma.TransactionClient,
  userId: string,
  profileId: string,
  payload: unknown,
  deleteId?: string,
) {
  // Also used by sync: one profile lock orders commits before assigning revisions.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"sync-profile:" + profileId}))`;
  const p = deleteId ? null : wellbeingInputSchema.parse(payload);
  const id = deleteId ?? p!.id;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"wellbeing:" + id}))`;
  const existing = await tx.wellbeingRecord.findUnique({ where: { id } });
  if (
    existing &&
    (existing.userId !== userId || existing.profileId !== profileId)
  )
    throw new AppError(403, "FORBIDDEN", "Registro indisponível");
  if (deleteId) {
    if (!existing || existing.deletedAt) return existing;
    const [rev] = await tx.$queryRaw<
      { revision: bigint }[]
    >`SELECT nextval('"WellbeingRecord_revision_seq"') AS revision`;
    return tx.wellbeingRecord.update({
      where: { id },
      data: { deletedAt: new Date(), revision: rev!.revision },
    });
  }
  if (existing && existing.kind !== p!.kind)
    throw new AppError(409, "CONFLICT", "Tipo imutável");
  if (p!.kind === "mood") {
    const old = existing?.data as
      | { mealIds?: string[]; activityIds?: string[] }
      | undefined;
    for (const [ids, prior, table] of [
      [p!.data.mealIds, old?.mealIds ?? [], "meal"],
      [p!.data.activityIds, old?.activityIds ?? [], "activity"],
    ] as const) {
      const added = ids.filter((id) => !prior.includes(id));
      const count =
        table === "meal"
          ? await tx.meal.count({
              where: { id: { in: added }, profileId, userId, deletedAt: null },
            })
          : await tx.activity.count({
              where: { id: { in: added }, profileId, userId, deletedAt: null },
            });
      if (count !== new Set(added).size)
        throw new AppError(400, "INVALID_REFERENCE", "Associação indisponível");
    }
  }
  if (
    p!.kind === "fasting" &&
    p!.data.status === "active" &&
    Date.parse(p!.data.endAt) > Date.now()
  ) {
    const active = await tx.wellbeingRecord.findMany({
      where: {
        profileId,
        kind: "fasting",
        deletedAt: null,
        id: { not: id },
        data: { path: ["status"], equals: "active" },
      },
    });
    if (
      active.some(
        (r) => Date.parse((r.data as { endAt: string }).endAt) > Date.now(),
      )
    )
      throw new AppError(409, "ACTIVE_FASTING", "Já existe um jejum ativo");
  }
  const [rev] = await tx.$queryRaw<
    { revision: bigint }[]
  >`SELECT nextval('"WellbeingRecord_revision_seq"') AS revision`;
  return tx.wellbeingRecord.upsert({
    where: { id },
    create: {
      id,
      userId,
      profileId,
      kind: p!.kind,
      data: p!.data as Prisma.InputJsonValue,
      revision: rev!.revision,
    },
    update: {
      data: p!.data as Prisma.InputJsonValue,
      deletedAt: null,
      revision: rev!.revision,
    },
  });
}

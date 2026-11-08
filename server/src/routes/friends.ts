import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { idSchema, canInteractWithActivity } from "@vitalis/contracts";
import { requireAuth } from "../lib/auth.js";
import { requireProfile } from "../lib/profile-scope.js";
import { prisma } from "../lib/prisma.js";
import { AppError, notFound } from "../lib/errors.js";
const shared = (r: {
  id: string;
  type: string;
  date: Date;
  durationSeconds: number;
  distanceMeters: number;
  calories: number;
}) => ({
  id: r.id,
  type: r.type,
  date: r.date.toISOString().slice(0, 10),
  durationSeconds: r.durationSeconds,
  distanceMeters: r.distanceMeters,
  calories: r.calories,
});
export async function friendRoutes(raw: FastifyInstance) {
  const app = raw.withTypeProvider<ZodTypeProvider>();
  app.addHook("preHandler", requireAuth);
  app.addHook("preHandler", requireProfile);
  app.post("/friend-invites", async (req) => {
    const invite = await prisma.friendInvite.create({
      data: {
        code: randomBytes(24).toString("base64url"),
        profileId: req.profileId,
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    });
    return {
      data: { code: invite.code, expiresAt: invite.expiresAt.toISOString() },
    };
  });
  app.post(
    "/friend-requests",
    { schema: { body: z.object({ code: z.string().min(32).max(64) }) } },
    async (req) => {
      const row = await prisma.$transaction(async (tx) => {
        const invite = await tx.friendInvite.findUnique({
          where: { code: req.body.code },
        });
        if (
          !invite ||
          invite.used ||
          invite.expiresAt.getTime() < Date.now() ||
          invite.profileId === req.profileId
        )
          throw new AppError(400, "INVALID_INVITE", "Convite indisponível");
        const pair = [invite.profileId, req.profileId].sort();
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"friend:" + pair.join(":")}))`;
        const claimed = await tx.friendInvite.updateMany({
          where: {
            code: invite.code,
            used: false,
            expiresAt: { gt: new Date() },
          },
          data: { used: true },
        });
        if (!claimed.count)
          throw new AppError(400, "INVALID_INVITE", "Convite indisponível");
        const old = await tx.friendship.findUnique({
          where: { aId_bId: { aId: pair[0]!, bId: pair[1]! } },
        });
        if (old && ["accepted", "pending"].includes(old.status)) return old;
        return tx.friendship.upsert({
          where: { aId_bId: { aId: pair[0]!, bId: pair[1]! } },
          create: { aId: pair[0]!, bId: pair[1]!, requestedBy: req.profileId },
          update: { requestedBy: req.profileId, status: "pending" },
        });
      });
      return { data: { id: row.id, status: row.status } };
    },
  );
  app.get("/friendships", async (req) => {
    const rows = await prisma.friendship.findMany({
      where: {
        OR: [{ aId: req.profileId }, { bId: req.profileId }],
        status: { in: ["pending", "accepted"] },
      },
      include: {
        a: { select: { id: true, name: true } },
        b: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
    return {
      data: rows.map((r) => ({
        id: r.id,
        status: r.status,
        incoming: r.requestedBy !== req.profileId,
        other: r.aId === req.profileId ? r.b : r.a,
      })),
    };
  });
  app.patch(
    "/friendships/:id",
    {
      schema: {
        params: z.object({ id: idSchema }),
        body: z.object({ action: z.enum(["accept", "reject", "remove"]) }),
      },
    },
    async (req) => {
      const row = await prisma.$transaction(async (tx) => {
        const r = await tx.friendship.findFirst({
          where: {
            id: req.params.id,
            OR: [{ aId: req.profileId }, { bId: req.profileId }],
          },
        });
        if (!r) throw notFound();
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"friend:" + [r.aId, r.bId].join(":")}))`;
        const current = await tx.friendship.findUniqueOrThrow({
          where: { id: r.id },
        });
        if (
          req.body.action !== "remove" &&
          (current.status !== "pending" ||
            current.requestedBy === req.profileId)
        )
          throw new AppError(409, "CONFLICT", "Solicitação indisponível");
        return tx.friendship.update({
          where: { id: r.id },
          data: {
            status:
              req.body.action === "accept"
                ? "accepted"
                : req.body.action === "reject"
                  ? "rejected"
                  : "revoked",
          },
        });
      });
      return { data: { id: row.id, status: row.status } };
    },
  );
  app.get(
    "/friends/:profileId/activities",
    {
      schema: {
        params: z.object({ profileId: idSchema }),
        querystring: z.object({
          cursor: idSchema.optional(),
          limit: z.coerce.number().int().min(1).max(100).default(30),
        }),
      },
    },
    async (req) => {
      const pair = [req.profileId, req.params.profileId].sort();
      const friendship = await prisma.friendship.findUnique({
        where: { aId_bId: { aId: pair[0]!, bId: pair[1]! } },
      });
      if (
        !canInteractWithActivity("friends", friendship?.status === "accepted")
      )
        throw new AppError(403, "FORBIDDEN", "Atividades indisponíveis");
      const where = {
        profileId: req.params.profileId,
        visibility: "friends",
        deletedAt: null,
      };
      if (
        req.query.cursor &&
        !(await prisma.activity.findFirst({
          where: { ...where, id: req.query.cursor },
        }))
      )
        throw notFound();
      const rows = await prisma.activity.findMany({
        where,
        select: {
          id: true,
          type: true,
          date: true,
          durationSeconds: true,
          distanceMeters: true,
          calories: true,
        },
        orderBy: [{ date: "desc" }, { id: "desc" }],
        take: req.query.limit + 1,
        ...(req.query.cursor
          ? { cursor: { id: req.query.cursor }, skip: 1 }
          : {}),
      });
      return {
        data: rows.slice(0, req.query.limit).map(shared),
        meta: {
          nextCursor:
            rows.length > req.query.limit
              ? rows[req.query.limit - 1]!.id
              : null,
        },
      };
    },
  );
  app.get(
    "/friends/:profileId/activities/:id",
    { schema: { params: z.object({ profileId: idSchema, id: idSchema }) } },
    async (req) => {
      const pair = [req.profileId, req.params.profileId].sort();
      const friendship = await prisma.friendship.findUnique({
        where: { aId_bId: { aId: pair[0]!, bId: pair[1]! } },
      });
      const r = await prisma.activity.findFirst({
        where: {
          id: req.params.id,
          profileId: req.params.profileId,
          deletedAt: null,
        },
      });
      if (
        !r ||
        !canInteractWithActivity(
          r.visibility,
          friendship?.status === "accepted",
        )
      )
        throw notFound();
      return { data: shared(r) };
    },
  );
}

import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  wellbeingPaths,
  wellbeingInputSchema,
  wellbeingChangesQuerySchema,
  idSchema,
} from "@vitalis/contracts";
import { requireAuth } from "../lib/auth.js";
import { requireProfile } from "../lib/profile-scope.js";
import { prisma } from "../lib/prisma.js";
import { AppError, notFound } from "../lib/errors.js";
import { writeWellbeing, wellbeingJson } from "../lib/wellbeing.js";
export async function wellbeingRoutes(raw: FastifyInstance) {
  const app = raw.withTypeProvider<ZodTypeProvider>();
  app.addHook("preHandler", requireAuth);
  app.addHook("preHandler", requireProfile);
  app.get(
    "/wellbeing/sync",
    { schema: { querystring: wellbeingChangesQuerySchema } },
    async (req) => {
      const rows = await prisma.wellbeingRecord.findMany({
        where: {
          profileId: req.profileId,
          userId: req.user.sub,
          revision: { gt: BigInt(req.query.cursor) },
        },
        orderBy: { revision: "asc" },
        take: req.query.limit + 1,
      });
      const records = rows.slice(0, req.query.limit);
      return {
        data: {
          records: records.map(wellbeingJson),
          cursor: records.length
            ? String(records.at(-1)!.revision)
            : req.query.cursor,
          hasMore: rows.length > req.query.limit,
        },
      };
    },
  );
  for (const [kind, path] of Object.entries(wellbeingPaths)) {
    app.get(
      "/" + path,
      {
        schema: {
          querystring: z.object({
            cursor: idSchema.optional(),
            limit: z.coerce.number().int().min(1).max(100).default(30),
          }),
        },
      },
      async (req) => {
        if (
          req.query.cursor &&
          !(await prisma.wellbeingRecord.findFirst({
            where: {
              id: req.query.cursor,
              profileId: req.profileId,
              userId: req.user.sub,
              kind,
            },
          }))
        )
          throw notFound();
        const rows = await prisma.wellbeingRecord.findMany({
          where: {
            profileId: req.profileId,
            userId: req.user.sub,
            kind,
            deletedAt: null,
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: req.query.limit + 1,
          ...(req.query.cursor
            ? { cursor: { id: req.query.cursor }, skip: 1 }
            : {}),
        });
        return {
          data: rows.slice(0, req.query.limit).map(wellbeingJson),
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
      "/" + path + "/:id",
      { schema: { params: z.object({ id: idSchema }) } },
      async (req) => {
        const row = await prisma.wellbeingRecord.findFirst({
          where: {
            id: req.params.id,
            profileId: req.profileId,
            userId: req.user.sub,
            kind,
            deletedAt: null,
          },
        });
        if (!row) throw notFound();
        return { data: wellbeingJson(row) };
      },
    );
    app.put(
      "/" + path + "/:id",
      {
        schema: {
          params: z.object({ id: idSchema }),
          body: z.object({ data: z.unknown() }),
        },
      },
      async (req) => {
        const input = wellbeingInputSchema.parse({
          id: req.params.id,
          kind,
          data: req.body.data,
        });
        const row = await prisma.$transaction((tx) =>
          writeWellbeing(tx, req.user.sub, req.profileId, input),
        );
        return { data: wellbeingJson(row!) };
      },
    );
    app.post(
      "/" + path,
      { schema: { body: z.object({ id: idSchema, data: z.unknown() }) } },
      async (req, reply) => {
        const input = wellbeingInputSchema.parse({ ...req.body, kind });
        const row = await prisma.$transaction((tx) =>
          writeWellbeing(tx, req.user.sub, req.profileId, input),
        );
        return reply.code(201).send({ data: wellbeingJson(row!) });
      },
    );
    app.delete(
      "/" + path + "/:id",
      { schema: { params: z.object({ id: idSchema }) } },
      async (req, reply) => {
        const row = await prisma.wellbeingRecord.findFirst({
          where: {
            id: req.params.id,
            profileId: req.profileId,
            userId: req.user.sub,
            kind,
          },
        });
        if (!row) throw notFound();
        await prisma.$transaction((tx) =>
          writeWellbeing(tx, req.user.sub, req.profileId, {}, row.id),
        );
        return reply.code(204).send();
      },
    );
  }
  // Unknown kinds never fall through to an unscoped query.
  app.setNotFoundHandler(() => {
    throw new AppError(404, "NOT_FOUND", "Registro não encontrado");
  });
}

import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
	dateSchema,
	idSchema,
	listQuerySchema,
	stepsInputSchema,
	weightInputSchema,
	weightUpdateSchema,
} from "@vitalis/contracts";
import { z } from "zod";
import { requireAuth } from "../lib/auth.js";
import { notFound } from "../lib/errors.js";
import { parseDate } from "../lib/dates.js";
import { prisma } from "../lib/prisma.js";
import { serializeWeight } from "../lib/serializers.js";

const params = z.object({ id: idSchema });
const dateParams = z.object({ date: dateSchema });
export async function weightRoutes(raw: FastifyInstance) {
	const app = raw.withTypeProvider<ZodTypeProvider>();
	app.addHook("preHandler", requireAuth);
	app.get(
		"/weights",
		{ schema: { querystring: listQuerySchema } },
		async (request) => {
			const rows = await prisma.weightEntry.findMany({
				where: { userId: request.user.sub, deletedAt: null },
				orderBy: { date: "desc" },
				take: request.query.limit + 1,
				...(request.query.cursor
					? { cursor: { id: request.query.cursor }, skip: 1 }
					: {}),
			});
			const hasMore = rows.length > request.query.limit;
			const data = rows.slice(0, request.query.limit).map(serializeWeight);
			return { data, meta: { nextCursor: hasMore ? data.at(-1)?.id : null } };
		},
	);
	app.post(
		"/weights",
		{ schema: { body: weightInputSchema } },
		async (request, reply) => {
			const row = await prisma.$transaction(async (tx) => {
				const weight = await tx.weightEntry.create({
					data: {
						...request.body,
						date: parseDate(request.body.date),
						userId: request.user.sub,
					},
				});
				await tx.profile.update({
					where: { userId: request.user.sub },
					data: { weightKg: request.body.weightKg },
				});
				return weight;
			});
			return reply.code(201).send({ data: serializeWeight(row) });
		},
	);
	app.patch(
		"/weights/:id",
		{ schema: { params, body: weightUpdateSchema } },
		async (request) => {
			const found = await prisma.weightEntry.findFirst({
				where: {
					id: request.params.id,
					userId: request.user.sub,
					deletedAt: null,
				},
			});
			if (!found) throw notFound();
			const { date, ...data } = request.body;
			return {
				data: serializeWeight(
					await prisma.weightEntry.update({
						where: { id: found.id },
						data: { ...data, ...(date ? { date: parseDate(date) } : {}) },
					}),
				),
			};
		},
	);
	app.delete("/weights/:id", { schema: { params } }, async (request, reply) => {
		const result = await prisma.weightEntry.updateMany({
			where: {
				id: request.params.id,
				userId: request.user.sub,
				deletedAt: null,
			},
			data: { deletedAt: new Date() },
		});
		if (!result.count) throw notFound();
		return reply.code(204).send();
	});
	app.put(
		"/steps/:date",
		{ schema: { params: dateParams, body: stepsInputSchema } },
		async (request) => ({
			data: await prisma.dailySteps
				.upsert({
					where: {
						userId_date: {
							userId: request.user.sub,
							date: parseDate(request.params.date),
						},
					},
					create: {
						userId: request.user.sub,
						date: parseDate(request.params.date),
						steps: request.body.steps,
					},
					update: { steps: request.body.steps },
				})
				.then((row) => ({
					date: row.date.toISOString().slice(0, 10),
					steps: row.steps,
					updatedAt: row.updatedAt.toISOString(),
				})),
		}),
	);
}

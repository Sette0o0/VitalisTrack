import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
	idSchema,
	listQuerySchema,
	mealInputSchema,
	mealUpdateSchema,
} from "@vitalis/contracts";
import { z } from "zod";
import { requireAuth } from "../lib/auth.js";
import { notFound } from "../lib/errors.js";
import { parseDate } from "../lib/dates.js";
import { prisma } from "../lib/prisma.js";
import { serializeMeal } from "../lib/serializers.js";

const params = z.object({ id: idSchema });
export async function mealRoutes(raw: FastifyInstance) {
	const app = raw.withTypeProvider<ZodTypeProvider>();
	app.addHook("preHandler", requireAuth);
	app.get(
		"/",
		{ schema: { querystring: listQuerySchema } },
		async (request) => {
			const rows = await prisma.meal.findMany({
				where: {
					userId: request.user.sub,
					deletedAt: null,
					...(request.query.date
						? { date: parseDate(request.query.date) }
						: {}),
				},
				orderBy: [{ date: "desc" }, { time: "desc" }],
				take: request.query.limit + 1,
				...(request.query.cursor
					? { cursor: { id: request.query.cursor }, skip: 1 }
					: {}),
			});
			const hasMore = rows.length > request.query.limit;
			const data = rows.slice(0, request.query.limit).map(serializeMeal);
			return { data, meta: { nextCursor: hasMore ? data.at(-1)?.id : null } };
		},
	);
	app.post("/", { schema: { body: mealInputSchema } }, async (request, reply) =>
		reply.code(201).send({
			data: serializeMeal(
				await prisma.meal.create({
					data: {
						...request.body,
						date: parseDate(request.body.date),
						userId: request.user.sub,
					},
				}),
			),
		}),
	);
	app.patch(
		"/:id",
		{ schema: { params, body: mealUpdateSchema } },
		async (request) => {
			const found = await prisma.meal.findFirst({
				where: {
					id: request.params.id,
					userId: request.user.sub,
					deletedAt: null,
				},
			});
			if (!found) throw notFound();
			const { date, ...data } = request.body;
			return {
				data: serializeMeal(
					await prisma.meal.update({
						where: { id: found.id },
						data: { ...data, ...(date ? { date: parseDate(date) } : {}) },
					}),
				),
			};
		},
	);
	app.delete("/:id", { schema: { params } }, async (request, reply) => {
		const result = await prisma.meal.updateMany({
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
}

import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
	activityInputSchema,
	activityListQuerySchema,
	activityUpdateSchema,
	idSchema,
	routePointSchema,
} from "@vitalis/contracts";
import { z } from "zod";
import { requireAuth } from "../lib/auth.js";
import { notFound } from "../lib/errors.js";
import { parseDate } from "../lib/dates.js";
import {
	calculateActivityCalories,
	calculatePaceSeconds,
} from "../lib/health.js";
import { prisma } from "../lib/prisma.js";
import { serializeActivity } from "../lib/serializers.js";

const params = z.object({ id: idSchema });
const routeCreate = (route: Array<z.infer<typeof routePointSchema>>) => ({
	create: route.map((point, sequence) => ({
		sequence,
		latitude: point.latitude,
		longitude: point.longitude,
		altitude: point.altitude ?? null,
		accuracy: point.accuracy ?? null,
		timestamp: new Date(point.timestamp),
	})),
});
async function weightFor(userId: string) {
	const profile = await prisma.profile.findUnique({ where: { userId } });
	return profile?.weightKg ?? 70;
}

export async function activityRoutes(raw: FastifyInstance) {
	const app = raw.withTypeProvider<ZodTypeProvider>();
	app.addHook("preHandler", requireAuth);
	app.get(
		"/",
		{ schema: { querystring: activityListQuerySchema } },
		async (request) => {
			const rows = await prisma.activity.findMany({
				where: {
					userId: request.user.sub,
					deletedAt: null,
					...(request.query.date
						? { date: parseDate(request.query.date) }
						: {}),
					...(request.query.type ? { type: request.query.type } : {}),
				},
				include: { route: { orderBy: { sequence: "asc" } } },
				orderBy:
					request.query.sort === "type"
						? [{ type: "asc" }, { date: "desc" }]
						: [{ date: "desc" }, { createdAt: "desc" }],
				take: request.query.limit + 1,
				...(request.query.cursor
					? { cursor: { id: request.query.cursor }, skip: 1 }
					: {}),
			});
			const hasMore = rows.length > request.query.limit;
			const data = rows.slice(0, request.query.limit).map(serializeActivity);
			return { data, meta: { nextCursor: hasMore ? data.at(-1)?.id : null } };
		},
	);
	app.post(
		"/",
		{ schema: { body: activityInputSchema } },
		async (request, reply) => {
			const { route, ...input } = request.body;
			const row = await prisma.activity.create({
				data: {
					...input,
					date: parseDate(input.date),
					userId: request.user.sub,
					calories: calculateActivityCalories(
						input.type,
						await weightFor(request.user.sub),
						input.durationSeconds,
					),
					paceSecondsPerKm:
						input.type === "run"
							? calculatePaceSeconds(
									input.distanceMeters,
									input.durationSeconds,
								)
							: null,
					route: routeCreate(route),
				},
				include: { route: { orderBy: { sequence: "asc" } } },
			});
			return reply.code(201).send({ data: serializeActivity(row) });
		},
	);
	app.patch(
		"/:id",
		{ schema: { params, body: activityUpdateSchema } },
		async (request) => {
			const found = await prisma.activity.findFirst({
				where: {
					id: request.params.id,
					userId: request.user.sub,
					deletedAt: null,
				},
				include: { route: true },
			});
			if (!found) throw notFound();
			const merged = { ...found, ...request.body };
			const { route, date, ...data } = request.body;
			const row = await prisma.activity.update({
				where: { id: found.id },
				data: {
					...data,
					...(date ? { date: parseDate(date) } : {}),
					calories: calculateActivityCalories(
						merged.type as "walk" | "run" | "cycling",
						await weightFor(request.user.sub),
						merged.durationSeconds,
					),
					paceSecondsPerKm:
						merged.type === "run"
							? calculatePaceSeconds(
									merged.distanceMeters,
									merged.durationSeconds,
								)
							: null,
					...(route
						? { route: { deleteMany: {}, ...routeCreate(route) } }
						: {}),
				},
				include: { route: { orderBy: { sequence: "asc" } } },
			});
			return { data: serializeActivity(row) };
		},
	);
	app.delete("/:id", { schema: { params } }, async (request, reply) => {
		const result = await prisma.activity.updateMany({
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

import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
	activityInputSchema,
	goalsUpdateSchema,
	mealInputSchema,
	profileUpdateSchema,
	routePointSchema,
	syncPullQuerySchema,
	syncPushSchema,
	waterInputSchema,
	weightInputSchema,
} from "@vitalis/contracts";
import { z } from "zod";
import { requireAuth } from "../lib/auth.js";
import { AppError } from "../lib/errors.js";
import { parseDate } from "../lib/dates.js";
import {
	calculateActivityCalories,
	calculatePaceSeconds,
} from "../lib/health.js";
import { prisma } from "../lib/prisma.js";
import {
	serializeActivity,
	serializeGoals,
	serializeMeal,
	serializeWater,
	serializeWeight,
} from "../lib/serializers.js";

const stepsPayload = z.object({
	date: z.iso.date(),
	steps: z.number().int().nonnegative(),
});
const routeCreate = (route: Array<z.infer<typeof routePointSchema>>) =>
	route.map((point, sequence) => ({
		sequence,
		latitude: point.latitude,
		longitude: point.longitude,
		altitude: point.altitude ?? null,
		accuracy: point.accuracy ?? null,
		timestamp: new Date(point.timestamp),
	}));

async function applyMutation(
	userId: string,
	mutation: z.infer<typeof syncPushSchema>["mutations"][number],
) {
	const existing = await prisma.processedMutation.findUnique({
		where: { userId_mutationId: { userId, mutationId: mutation.mutationId } },
	});
	if (existing) return existing.result;
	const result = await prisma.$transaction(async (tx) => {
		if (mutation.action === "delete") {
			if (
				!mutation.entityId ||
				!["water", "meal", "activity", "weight"].includes(mutation.entity)
			) {
				throw new AppError(
					400,
					"INVALID_SYNC_DELETE",
					"Exclusão não permitida para esta entidade",
				);
			}
			const where = { id: mutation.entityId, userId, deletedAt: null };
			if (mutation.entity === "water")
				await tx.waterEntry.updateMany({
					where,
					data: { deletedAt: new Date() },
				});
			if (mutation.entity === "meal")
				await tx.meal.updateMany({ where, data: { deletedAt: new Date() } });
			if (mutation.entity === "activity")
				await tx.activity.updateMany({
					where,
					data: { deletedAt: new Date() },
				});
			if (mutation.entity === "weight")
				await tx.weightEntry.updateMany({
					where,
					data: { deletedAt: new Date() },
				});
			return {
				mutationId: mutation.mutationId,
				status: "applied",
				entityId: mutation.entityId,
			};
		}

		const payload = mutation.payload ?? {};
		if (mutation.entity === "profile") {
			const data = profileUpdateSchema.parse(payload);
			const { birthDate, ...rest } = data;
			await tx.profile.update({
				where: { userId },
				data: {
					...rest,
					...(birthDate ? { birthDate: parseDate(birthDate) } : {}),
				},
			});
		} else if (mutation.entity === "goals") {
			await tx.goals.update({
				where: { userId },
				data: goalsUpdateSchema.parse(payload),
			});
		} else if (mutation.entity === "water") {
			const data = waterInputSchema.parse(payload);
			await tx.waterEntry.upsert({
				where: { id: data.id },
				create: { ...data, date: parseDate(data.date), userId },
				update: {
					amountMl: data.amountMl,
					date: parseDate(data.date),
					time: data.time,
					deletedAt: null,
				},
			});
		} else if (mutation.entity === "meal") {
			const data = mealInputSchema.parse(payload);
			await tx.meal.upsert({
				where: { id: data.id },
				create: { ...data, date: parseDate(data.date), userId },
				update: { ...data, date: parseDate(data.date), deletedAt: null },
			});
		} else if (mutation.entity === "weight") {
			const data = weightInputSchema.parse(payload);
			await tx.weightEntry.upsert({
				where: { id: data.id },
				create: { ...data, date: parseDate(data.date), userId },
				update: {
					date: parseDate(data.date),
					weightKg: data.weightKg,
					deletedAt: null,
				},
			});
			await tx.profile.update({
				where: { userId },
				data: { weightKg: data.weightKg },
			});
		} else if (mutation.entity === "steps") {
			const data = stepsPayload.parse(payload);
			await tx.dailySteps.upsert({
				where: { userId_date: { userId, date: parseDate(data.date) } },
				create: { userId, date: parseDate(data.date), steps: data.steps },
				update: { steps: data.steps },
			});
		} else if (mutation.entity === "activity") {
			const data = activityInputSchema.parse(payload);
			const profile = await tx.profile.findUnique({ where: { userId } });
			const calories = calculateActivityCalories(
				data.type,
				profile?.weightKg ?? 70,
				data.durationSeconds,
			);
			const paceSecondsPerKm =
				data.type === "run"
					? calculatePaceSeconds(data.distanceMeters, data.durationSeconds)
					: null;
			await tx.activity.upsert({
				where: { id: data.id },
				create: {
					id: data.id,
					userId,
					type: data.type,
					date: parseDate(data.date),
					durationSeconds: data.durationSeconds,
					distanceMeters: data.distanceMeters,
					calories,
					paceSecondsPerKm,
					route: { create: routeCreate(data.route) },
				},
				update: {
					type: data.type,
					date: parseDate(data.date),
					durationSeconds: data.durationSeconds,
					distanceMeters: data.distanceMeters,
					calories,
					paceSecondsPerKm,
					deletedAt: null,
					route: { deleteMany: {}, create: routeCreate(data.route) },
				},
			});
		}
		return {
			mutationId: mutation.mutationId,
			status: "applied",
			entityId: mutation.entityId ?? (payload.id as string | undefined),
		};
	});
	await prisma.processedMutation.create({
		data: { userId, mutationId: mutation.mutationId, result },
	});
	return result;
}

export async function syncRoutes(raw: FastifyInstance) {
	const app = raw.withTypeProvider<ZodTypeProvider>();
	app.addHook("preHandler", requireAuth);
	app.post("/", { schema: { body: syncPushSchema } }, async (request) => {
		const results = [];
		for (const mutation of request.body.mutations) {
			try {
				results.push(await applyMutation(request.user.sub, mutation));
			} catch (error) {
				results.push({
					mutationId: mutation.mutationId,
					status: "failed",
					message:
						error instanceof Error ? error.message : "Falha desconhecida",
				});
			}
		}
		return { data: results };
	});

	app.get(
		"/",
		{ schema: { querystring: syncPullQuerySchema } },
		async (request) => {
			const since = request.query.cursor
				? new Date(request.query.cursor)
				: new Date(0);
			if (Number.isNaN(since.getTime()))
				throw new AppError(400, "INVALID_CURSOR", "Cursor inválido");
			const cursor = new Date();
			const [water, meals, activities, weights, steps, profile, goals] =
				await Promise.all([
					prisma.waterEntry.findMany({
						where: { userId: request.user.sub, updatedAt: { gt: since } },
					}),
					prisma.meal.findMany({
						where: { userId: request.user.sub, updatedAt: { gt: since } },
					}),
					prisma.activity.findMany({
						where: { userId: request.user.sub, updatedAt: { gt: since } },
						include: { route: { orderBy: { sequence: "asc" } } },
					}),
					prisma.weightEntry.findMany({
						where: { userId: request.user.sub, updatedAt: { gt: since } },
					}),
					prisma.dailySteps.findMany({
						where: { userId: request.user.sub, updatedAt: { gt: since } },
					}),
					prisma.profile.findUnique({ where: { userId: request.user.sub } }),
					prisma.goals.findUnique({ where: { userId: request.user.sub } }),
				]);
			return {
				data: {
					water: water.map(serializeWater),
					meals: meals.map(serializeMeal),
					activities: activities.map(serializeActivity),
					weights: weights.map(serializeWeight),
					steps: steps.map((x) => ({
						date: x.date.toISOString().slice(0, 10),
						steps: x.steps,
						updatedAt: x.updatedAt.toISOString(),
					})),
					profile:
						profile && profile.updatedAt > since
							? {
									name: profile.name,
									birthDate:
										profile.birthDate?.toISOString().slice(0, 10) ?? null,
									weightKg: profile.weightKg,
									heightCm: profile.heightCm,
									gender: profile.gender,
									updatedAt: profile.updatedAt.toISOString(),
								}
							: null,
					goals:
						goals && goals.updatedAt > since ? serializeGoals(goals) : null,
					cursor: cursor.toISOString(),
				},
			};
		},
	);
}

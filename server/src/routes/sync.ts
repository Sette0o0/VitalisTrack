import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
	activityInputSchema,
	goalsUpdateSchema,
	mealInputSchema,
	createProfileUpdateSchema,
	healthProfileCreateSchema,
	nutritionProfileInputSchema,
	recipeInputSchema,
	unitSystemSchema,
	syncPullQuerySchema,
	syncPushSchema,
	waterInputSchema,
	weightInputSchema,
	type SyncMutation,
} from "@vitalis/contracts";
import { z } from "zod";
import { Prisma } from "../../generated/prisma/client.js";
import { createLimiter } from "../lib/concurrency.js";
import { requireAuth } from "../lib/auth.js";
import { requireProfile, resolveProfile } from "../lib/profile-scope.js";
import { AppError } from "../lib/errors.js";
import { parseDate } from "../lib/dates.js";
import { isIanaTimeZone, clientTimeZone } from "../lib/client-time-zone.js";
import { calculateActivityCalories, calculatePaceSeconds } from "../lib/health.js";
import { prisma } from "../lib/prisma.js";
import {
	serializeActivity,
	serializeGoals,
	serializeMeal,
	serializeWater,
	serializeWeight,
} from "../lib/serializers.js";
import { config } from "../config.js";
import { writeWellbeing } from "../lib/wellbeing.js";
import { recipeJson } from "./sprint2.js";
const syncRequestSchema = syncPushSchema.superRefine((value, ctx) => {
	value.mutations.forEach((m, index) => {
		if (m.clientTimeZone && !isIanaTimeZone(m.clientTimeZone))
			ctx.addIssue({
				code: "custom",
				path: ["mutations", index, "clientTimeZone"],
				message: "Use um identificador IANA de fuso horário",
			});
	});
});
const withSyncSlot = createLimiter(8);
const stepsPayload = z.object({ date: z.iso.date(), steps: z.number().int().nonnegative() });
async function applyMutation(userId: string, m: SyncMutation, timeZone: string, header?: string) {
	const creating = m.entity === "healthProfile";
	const profileId = creating
		? healthProfileCreateSchema.parse(m.payload).id
		: await resolveProfile(userId, m.profileId ?? header);
	if (creating && m.profileId && m.profileId !== profileId)
		throw new AppError(400, "INVALID_PROFILE", "Perfil divergente");
	return prisma.$transaction(async (tx) => {
		await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId + ":" + m.mutationId}))`;
		const replay = await tx.processedMutation.findUnique({
			where: { userId_mutationId: { userId, mutationId: m.mutationId } },
		});
		if (replay) {
			if (
				replay.profileId !== profileId ||
				(replay.result && typeof replay.result === "object" && "kind" in replay.result)
			)
				throw new AppError(
					409,
					"IDEMPOTENCY_CONFLICT",
					"Identificador utilizado por outra operação",
				);
			return replay.result;
		}
		await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"sync-profile:" + profileId}))`;
		const payload = m.payload ?? {};
		const id = m.action === "delete" ? m.entityId : payload.id;
		// IDs are immutable across accounts and profiles, even for upserts and tombstones.
		if (typeof id === "string") {
			const where = { id };
			const found =
				m.entity === "water"
					? await tx.waterEntry.findUnique({ where })
					: m.entity === "meal"
						? await tx.meal.findUnique({ where })
						: m.entity === "activity"
							? await tx.activity.findUnique({ where })
							: m.entity === "weight"
								? await tx.weightEntry.findUnique({ where })
								: m.entity === "recipe"
									? await tx.recipe.findUnique({ where })
									: null;
			if (found && found.profileId !== profileId)
				throw new AppError(403, "FORBIDDEN", "Registro pertence a outro perfil");
		}
		if (m.entity === "wellbeing") {
 if(m.action === "delete" && !m.entityId) throw new AppError(400,"INVALID_SYNC_DELETE","Registro ausente");
 await writeWellbeing(tx,userId,profileId,payload,m.action === "delete" ? m.entityId : undefined);
 } else if (m.entity === "steps" && m.action === "delete") {
 const p = z.object({date: z.iso.date()}).parse(payload);
 await tx.dailySteps.upsert({where:{profileId_date:{profileId,date:parseDate(p.date)}},create:{userId,profileId,date:parseDate(p.date),steps:0,deletedAt:new Date()},update:{steps:0,deletedAt:new Date()}});
 } else if (m.entity === "document") {
 throw new AppError(400,"DOCUMENT_ENDPOINT_REQUIRED","Use a rota de documentos");
 } else if (m.action === "delete") {
			if (!m.entityId || !["water", "meal", "activity", "weight", "recipe"].includes(m.entity))
				throw new AppError(400, "INVALID_SYNC_DELETE", "Exclusão não permitida");
			const where = { id: m.entityId, profileId, deletedAt: null };
			const data = { deletedAt: new Date() };
			if (m.entity === "water") await tx.waterEntry.updateMany({ where, data });
			if (m.entity === "meal") await tx.meal.updateMany({ where, data });
			if (m.entity === "activity") await tx.activity.updateMany({ where, data });
			if (m.entity === "weight") await tx.weightEntry.updateMany({ where, data });
			if (m.entity === "recipe") await tx.recipe.updateMany({ where, data });
		} else if (creating) {
			const p = healthProfileCreateSchema.parse(payload);
			await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"profile:" + p.id}))`;
			const found = await tx.profile.findUnique({ where: { id: p.id } });
			if (found && found.userId !== userId)
				throw new AppError(403, "FORBIDDEN", "Perfil indisponível");
			if (!found)
				await tx.profile.create({ data: { ...p, userId, goals: { create: { userId } } } });
		} else if (m.entity === "profile") {
			const { birthDate, ...data } = createProfileUpdateSchema(m.clientTimeZone ?? timeZone).parse(
				payload,
			);
			await tx.profile.update({
				where: { id: profileId },
				data: { ...data, ...(birthDate ? { birthDate: parseDate(birthDate) } : {}) },
			});
		} else if (m.entity === "goals") {
			await tx.goals.update({ where: { profileId }, data: goalsUpdateSchema.parse(payload) });
		} else if (m.entity === "preferences") {
			await tx.profile.update({
				where: { id: profileId },
				data: z.object({ unitSystem: unitSystemSchema }).parse(payload),
			});
		} else if (m.entity === "nutrition") {
			const data = nutritionProfileInputSchema.parse(payload);
			await tx.nutritionProfile.upsert({
				where: { profileId },
				create: { ...data, profileId },
				update: data,
			});
		} else if (m.entity === "recipe") {
			const parsed = recipeInputSchema.parse(payload);
			const data = { ...parsed, nutrition: parsed.nutrition ?? Prisma.DbNull };
			await tx.recipe.upsert({
				where: { id: data.id },
				create: { ...data, profileId },
				update: { ...data, deletedAt: null },
			});
		} else if (m.entity === "water") {
			const p = waterInputSchema.parse(payload);
			const data = { ...p, date: parseDate(p.date) };
			await tx.waterEntry.upsert({
				where: { id: p.id },
				create: { ...data, userId, profileId },
				update: { ...data, deletedAt: null },
			});
		} else if (m.entity === "meal") {
			const p = mealInputSchema.parse(payload);
			const data = { ...p, date: parseDate(p.date), nutrition: p.nutrition ?? Prisma.DbNull };
			await tx.meal.upsert({
				where: { id: p.id },
				create: { ...data, userId, profileId },
				update: { ...data, deletedAt: null },
			});
		} else if (m.entity === "weight") {
			const p = weightInputSchema.parse(payload);
			const data = { ...p, date: parseDate(p.date) };
			await tx.weightEntry.upsert({
				where: { id: p.id },
				create: { ...data, userId, profileId },
				update: { ...data, deletedAt: null },
			});
			await tx.profile.update({ where: { id: profileId }, data: { weightKg: p.weightKg } });
		} else if (m.entity === "steps") {
			const p = stepsPayload.parse(payload);
			const date = parseDate(p.date);
			await tx.dailySteps.upsert({
				where: { profileId_date: { profileId, date } },
				create: { userId, profileId, date, steps: p.steps },
				update: { steps: p.steps, deletedAt: null },
			});
		} else if (m.entity === "activity") {
			const p = activityInputSchema.parse(payload);
			const profile = await tx.profile.findUniqueOrThrow({ where: { id: profileId } });
			const route = p.route.map((x, sequence) => ({
				...x,
				sequence,
				timestamp: new Date(x.timestamp),
			}));
			const { route: _, heartRate, ...input } = p;
			void _;
			const data = {
				...input,
 ...(heartRate === undefined ? {} : {heartRate:heartRate === null ? Prisma.DbNull : heartRate}),
				date: parseDate(p.date),
				calories: calculateActivityCalories(p.type, profile.weightKg ?? 70, p.durationSeconds),
				paceSecondsPerKm:
					p.type === "run" ? calculatePaceSeconds(p.distanceMeters, p.durationSeconds) : null,
			};
			await tx.activity.upsert({
				where: { id: p.id },
				create: { ...data, userId, profileId, route: { create: route } },
				update: { ...data, deletedAt: null, route: { deleteMany: {}, create: route } },
			});
		}
		const result = {
			mutationId: m.mutationId,
			status: "applied",
			entityId: m.entityId ?? (typeof id === "string" ? id : undefined),
		};
		// JSON must not contain undefined.
		const stored = JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue;
		await tx.processedMutation.create({
			data: { userId, profileId, mutationId: m.mutationId, result: stored },
		});
		return result;
	});
}
export async function syncRoutes(raw: FastifyInstance) {
	const app = raw.withTypeProvider<ZodTypeProvider>();
	app.addHook("preHandler", requireAuth);
	app.post("/", { schema: { body: syncRequestSchema } }, async (req) => {
		const results = [];
		const header = req.headers["x-profile-id"];
		if (header !== undefined && typeof header !== "string")
			throw new AppError(400, "INVALID_PROFILE", "Perfil inválido");
		for (const m of req.body.mutations) {
			try {
				results.push(
					await withSyncSlot(() => applyMutation(req.user.sub, m, clientTimeZone(req), header)),
				);
			} catch (e) {
				results.push({
					mutationId: m.mutationId,
					status: "failed",
					message: e instanceof Error ? e.message : "Falha desconhecida",
				});
			}
		}
		return { data: results };
	});
	app.get(
		"/",
		{ preHandler: requireProfile, schema: { querystring: syncPullQuerySchema } },
		async (req) => {
			if (req.query.cursor && Number.isNaN(new Date(req.query.cursor).getTime()))
				throw new AppError(400, "INVALID_CURSOR", "Cursor inválido");
			// Complete snapshots include tombstones. This avoids missing commits whose timestamp
			// predates a cursor but became visible only after the preceding snapshot.
			const data = await prisma.$transaction(
				async (tx) => {
					const scope = { userId: req.user.sub, profileId: req.profileId };
					const [water, meals, activities, weights, steps, profile, goals, nutrition, recipes] =
						await Promise.all([
							tx.waterEntry.findMany({ where: scope }),
							tx.meal.findMany({ where: scope }),
							tx.activity.findMany({
								where: scope,
								include: { route: { orderBy: { sequence: "asc" } } },
							}),
							tx.weightEntry.findMany({ where: scope }),
							tx.dailySteps.findMany({ where: scope }),
							tx.profile.findUniqueOrThrow({ where: { id: req.profileId } }),
							tx.goals.findUniqueOrThrow({ where: { profileId: req.profileId } }),
							tx.nutritionProfile.findUnique({ where: { profileId: req.profileId } }),
							tx.recipe.findMany({ where: { profileId: req.profileId } }),
						]);
					return {
 wellbeingVersion: 1 as const,
 documentsVersion: 1 as const,
						water: water.map(serializeWater),
						meals: meals.map(serializeMeal),
						activities: activities.map(serializeActivity),
						weights: weights.map(serializeWeight),
						steps: steps.map((x) => ({
							date: x.date.toISOString().slice(0, 10),
							steps: x.deletedAt ? 0 : x.steps,
 deletedAt: x.deletedAt?.toISOString() ?? null,
							updatedAt: x.updatedAt.toISOString(),
						})),
						profile: {
							name: profile.name,
							birthDate: profile.birthDate?.toISOString().slice(0, 10) ?? null,
							weightKg: profile.weightKg,
							heightCm: profile.heightCm,
							gender: profile.gender,
							avatarUrl: profile.avatarPath ? config.PUBLIC_BASE_URL + profile.avatarPath : null,
							updatedAt: profile.updatedAt.toISOString(),
						},
						goals: serializeGoals(goals),
						unitSystem: profile.unitSystem,
						nutrition: nutrition
							? { ...nutrition, updatedAt: nutrition.updatedAt.toISOString() }
							: null,
						recipes: recipes.map(recipeJson),
						cursor: new Date().toISOString(),
					};
				},
				{ isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
			);
			return { data };
		},
	);
}

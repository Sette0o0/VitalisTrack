import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
	healthProfileCreateSchema,
	nutritionProfileInputSchema,
	recipeInputSchema,
	unitSystemSchema,
	basalCalories,
} from "@vitalis/contracts";
import { z } from "zod";
import { Prisma } from "../../generated/prisma/client.js";
import { requireAuth } from "../lib/auth.js";
import { requireProfile } from "../lib/profile-scope.js";
import { createHealthProfile, profileSummary } from "../lib/profiles.js";
import { prisma } from "../lib/prisma.js";
import { calculateAge } from "../lib/dates.js";
import { clientTimeZone } from "../lib/client-time-zone.js";
import { notFound } from "../lib/errors.js";
export const recipeJson = (row: { createdAt: Date; updatedAt: Date; deletedAt: Date | null }) => ({
	...row,
	createdAt: row.createdAt.toISOString(),
	updatedAt: row.updatedAt.toISOString(),
	deletedAt: row.deletedAt?.toISOString() ?? null,
});
export async function healthProfilesRoutes(raw: FastifyInstance) {
	const app = raw.withTypeProvider<ZodTypeProvider>();
	app.addHook("preHandler", requireAuth);
	app.get("/profiles", async (req) => ({
		data: (
			await prisma.profile.findMany({
				where: { userId: req.user.sub },
				orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
			})
		).map(profileSummary),
	}));
	app.post("/profiles", { schema: { body: healthProfileCreateSchema } }, async (req, reply) =>
		reply
			.code(201)
			.send({ data: profileSummary(await createHealthProfile(req.user.sub, req.body)) }),
	);
}
export async function sprint2Routes(raw: FastifyInstance) {
	const app = raw.withTypeProvider<ZodTypeProvider>();
	app.addHook("preHandler", requireAuth);
	app.addHook("preHandler", requireProfile);
	app.get("/nutrition-profile", async (req) => {
		const row = await prisma.nutritionProfile.findUnique({ where: { profileId: req.profileId } });
		return { data: row ? { ...row, updatedAt: row.updatedAt.toISOString() } : null };
	});
	app.put("/nutrition-profile", { schema: { body: nutritionProfileInputSchema } }, async (req) => {
		const row = await prisma.nutritionProfile.upsert({
			where: { profileId: req.profileId },
			create: { ...req.body, profileId: req.profileId },
			update: req.body,
		});
		return { data: { ...row, updatedAt: row.updatedAt.toISOString() } };
	});
	app.put(
		"/preferences",
		{ schema: { body: z.object({ unitSystem: unitSystemSchema }) } },
		async (req) => ({
			data: await prisma.profile.update({
				where: { id: req.profileId },
				data: req.body,
				select: { unitSystem: true },
			}),
		}),
	);
	app.get("/goals/basal", async (req) => {
		const p = await prisma.profile.findUniqueOrThrow({ where: { id: req.profileId } });
		return {
			data: {
				calories: basalCalories({
					...p,
					age: calculateAge(p.birthDate, new Date(), clientTimeZone(req)),
				}),
			},
		};
	});
	app.get("/recipes", async (req) => ({
		data: (
			await prisma.recipe.findMany({
				where: { profileId: req.profileId, deletedAt: null },
				orderBy: [{ createdAt: "desc" }, { id: "asc" }],
			})
		).map(recipeJson),
	}));
	app.get("/recipes/:id", { schema: { params: z.object({ id: z.uuid() }) } }, async (req) => {
		const row = await prisma.recipe.findFirst({
			where: { id: req.params.id, profileId: req.profileId, deletedAt: null },
		});
		if (!row) throw notFound();
		return { data: recipeJson(row) };
	});
	app.post("/recipes", { schema: { body: recipeInputSchema } }, async (req, reply) => {
		const row = await prisma.recipe.create({
			data: {
				...req.body,
				nutrition: req.body.nutrition ?? Prisma.DbNull,
				profileId: req.profileId,
			},
		});
		return reply.code(201).send({ data: recipeJson(row) });
	});
}

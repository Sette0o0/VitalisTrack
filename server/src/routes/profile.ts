import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
	goalsUpdateSchema,
	profileUpdateInputSchema,
	createProfileUpdateSchema,
} from "@vitalis/contracts";
import { config } from "../config.js";
import { requireProfile } from "../lib/profile-scope.js";
import { requireAuth } from "../lib/auth.js";
import { notFound } from "../lib/errors.js";
import { parseDate } from "../lib/dates.js";
import { prisma } from "../lib/prisma.js";
import { serializeGoals, serializeProfile } from "../lib/serializers.js";
import { clientTimeZone } from "../lib/client-time-zone.js";
import { uploadAvatar } from "../lib/avatar-upload.js";

async function getUser(userId: string, profileId: string) {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		include: { profile: { where: { id: profileId } } },
	});
	if (!user) throw notFound("Usuário não encontrado");
	return { ...user, profile: user.profile.map((p) => ({ ...p, isPrimary: true })) };
}

export async function profileRoutes(raw: FastifyInstance) {
	const app = raw.withTypeProvider<ZodTypeProvider>();
	app.addHook("preHandler", requireAuth);
	app.addHook("preHandler", requireProfile);

	app.get("/profile", async (request) => ({
		data: serializeProfile(
			await getUser(request.user.sub, request.profileId),
			config.PUBLIC_BASE_URL,
			clientTimeZone(request),
		),
	}));

	app.patch("/profile", { schema: { body: profileUpdateInputSchema } }, async (request) => {
		const { birthDate, ...data } = createProfileUpdateSchema(clientTimeZone(request)).parse(
			request.body,
		);
		await prisma.profile.update({
			where: { id: request.profileId },
			data: {
				...data,
				...(birthDate ? { birthDate: parseDate(birthDate) } : {}),
			},
		});
		return {
			data: serializeProfile(
				await getUser(request.user.sub, request.profileId),
				config.PUBLIC_BASE_URL,
				clientTimeZone(request),
			),
		};
	});

	app.post("/profile/avatar", async (request) => {
		await uploadAvatar(request);
		return {
			data: serializeProfile(
				await getUser(request.user.sub, request.profileId),
				config.PUBLIC_BASE_URL,
				clientTimeZone(request),
			),
		};
	});

	app.get("/goals", async (request) => {
		const goals = await prisma.goals.findUnique({
			where: { profileId: request.profileId },
		});
		if (!goals) throw notFound("Metas não encontradas");
		return { data: serializeGoals(goals) };
	});

	app.patch("/goals", { schema: { body: goalsUpdateSchema } }, async (request) => ({
		data: serializeGoals(
			await prisma.goals.update({
				where: { profileId: request.profileId },
				data: request.body,
			}),
		),
	}));
}

import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { goalsUpdateSchema, profileUpdateSchema } from "@vitalis/contracts";
import { config } from "../config.js";
import { requireAuth } from "../lib/auth.js";
import { AppError, notFound } from "../lib/errors.js";
import { parseDate } from "../lib/dates.js";
import { prisma } from "../lib/prisma.js";
import { serializeGoals, serializeProfile } from "../lib/serializers.js";

async function getUser(userId: string) {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		include: { profile: true },
	});
	if (!user) throw notFound("Usuário não encontrado");
	return user;
}

export async function profileRoutes(raw: FastifyInstance) {
	const app = raw.withTypeProvider<ZodTypeProvider>();
	app.addHook("preHandler", requireAuth);

	app.get("/profile", async (request) => ({
		data: serializeProfile(
			await getUser(request.user.sub),
			config.PUBLIC_BASE_URL,
		),
	}));

	app.patch(
		"/profile",
		{ schema: { body: profileUpdateSchema } },
		async (request) => {
			const { birthDate, ...data } = request.body;
			await prisma.profile.update({
				where: { userId: request.user.sub },
				data: {
					...data,
					...(birthDate ? { birthDate: parseDate(birthDate) } : {}),
				},
			});
			return {
				data: serializeProfile(
					await getUser(request.user.sub),
					config.PUBLIC_BASE_URL,
				),
			};
		},
	);

	app.post("/profile/avatar", async (request) => {
		const file = await request.file();
		if (!file) throw new AppError(400, "FILE_REQUIRED", "Envie uma imagem");
		const allowed = new Map([
			["image/jpeg", ".jpg"],
			["image/png", ".png"],
			["image/webp", ".webp"],
		]);
		if (!allowed.has(file.mimetype))
			throw new AppError(415, "INVALID_FILE_TYPE", "Use JPEG, PNG ou WebP");
		const directory = join(process.cwd(), "storage", "avatars");
		await mkdir(directory, { recursive: true });
		const extension = allowed.get(file.mimetype) ?? extname(file.filename);
		const filename = `${request.user.sub}-${Date.now()}${extension}`;
		await pipeline(file.file, createWriteStream(join(directory, filename)));
		if (file.file.truncated)
			throw new AppError(
				413,
				"FILE_TOO_LARGE",
				"A imagem deve ter no máximo 5 MB",
			);
		await prisma.profile.update({
			where: { userId: request.user.sub },
			data: { avatarPath: `/uploads/avatars/${filename}` },
		});
		return {
			data: serializeProfile(
				await getUser(request.user.sub),
				config.PUBLIC_BASE_URL,
			),
		};
	});

	app.get("/goals", async (request) => {
		const goals = await prisma.goals.findUnique({
			where: { userId: request.user.sub },
		});
		if (!goals) throw notFound("Metas não encontradas");
		return { data: serializeGoals(goals) };
	});

	app.patch(
		"/goals",
		{ schema: { body: goalsUpdateSchema } },
		async (request) => ({
			data: serializeGoals(
				await prisma.goals.update({
					where: { userId: request.user.sub },
					data: request.body,
				}),
			),
		}),
	);
}

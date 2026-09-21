import argon2 from "argon2";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { loginSchema, refreshSchema, registerSchema } from "@vitalis/contracts";
import { AppError } from "../lib/errors.js";
import {
	issueTokens,
	revokeRefreshToken,
	rotateRefreshToken,
} from "../lib/auth.js";
import { prisma } from "../lib/prisma.js";
import { serializeProfile } from "../lib/serializers.js";
import { config } from "../config.js";

export async function authRoutes(raw: FastifyInstance) {
	const app = raw.withTypeProvider<ZodTypeProvider>();
	app.post(
		"/register",
		{ schema: { body: registerSchema } },
		async (request, reply) => {
			const existing = await prisma.user.findUnique({
				where: { email: request.body.email },
			});
			if (existing)
				throw new AppError(
					409,
					"EMAIL_IN_USE",
					"Este e-mail já está cadastrado",
				);
			const passwordHash = await argon2.hash(request.body.password, {
				type: argon2.argon2id,
			});
			const user = await prisma.user.create({
				data: {
					email: request.body.email,
					passwordHash,
					profile: { create: { name: request.body.name } },
					goals: { create: {} },
				},
				include: { profile: true },
			});
			const tokens = await issueTokens(raw, user.id);
			return reply
				.code(201)
				.send({
					data: {
						profile: serializeProfile(user, config.PUBLIC_BASE_URL),
						tokens,
					},
				});
		},
	);

	app.post("/login", { schema: { body: loginSchema } }, async (request) => {
		const user = await prisma.user.findUnique({
			where: { email: request.body.email },
			include: { profile: true },
		});
		if (
			!user ||
			!(await argon2.verify(user.passwordHash, request.body.password))
		) {
			throw new AppError(
				401,
				"INVALID_CREDENTIALS",
				"E-mail ou senha inválidos",
			);
		}
		const tokens = await issueTokens(raw, user.id);
		return {
			data: { profile: serializeProfile(user, config.PUBLIC_BASE_URL), tokens },
		};
	});

	app.post(
		"/refresh",
		{ schema: { body: refreshSchema } },
		async (request) => ({
			data: await rotateRefreshToken(raw, request.body.refreshToken),
		}),
	);

	app.post(
		"/logout",
		{ schema: { body: refreshSchema } },
		async (request, reply) => {
			await revokeRefreshToken(request.body.refreshToken);
			return reply.code(204).send();
		},
	);
}

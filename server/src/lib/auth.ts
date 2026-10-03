import { createHash, randomBytes } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { AppError } from "./errors.js";
import { prisma } from "./prisma.js";

const REFRESH_DAYS = 30;
export const ACCESS_SECONDS = 15 * 60;
const hashToken = (token: string) =>
	createHash("sha256").update(token).digest("hex");

export async function requireAuth(request: FastifyRequest) {
	try {
		await request.jwtVerify();
	} catch {
		throw new AppError(401, "UNAUTHORIZED", "Sessão inválida ou expirada");
	}
}

export async function issueTokens(
	app: FastifyInstance,
	userId: string,
	replaceId?: string,
) {
	const refreshToken = randomBytes(48).toString("base64url");
	const expiresAt = new Date(Date.now() + REFRESH_DAYS * 86_400_000);
	const session = await prisma.refreshSession.create({
		data: { userId, tokenHash: hashToken(refreshToken), expiresAt },
	});
	if (replaceId) {
		await prisma.refreshSession.update({
			where: { id: replaceId },
			data: { revokedAt: new Date(), replacedById: session.id },
		});
	}
	return {
		accessToken: app.jwt.sign({ sub: userId }, { expiresIn: ACCESS_SECONDS }),
		refreshToken,
		expiresIn: ACCESS_SECONDS,
	};
}

export async function rotateRefreshToken(app: FastifyInstance, token: string) {
	const session = await prisma.refreshSession.findUnique({
		where: { tokenHash: hashToken(token) },
	});
	if (!session || session.expiresAt <= new Date()) {
		throw new AppError(
			401,
			"INVALID_REFRESH_TOKEN",
			"Refresh token inválido ou expirado",
		);
	}
	if (session.revokedAt) {
		await prisma.refreshSession.updateMany({
			where: { userId: session.userId, revokedAt: null },
			data: { revokedAt: new Date() },
		});
		throw new AppError(
			401,
			"REFRESH_TOKEN_REUSED",
			"Sessão revogada por reutilização de token",
		);
	}
	return prisma.$transaction(async (tx) => {
 const revoked = await tx.refreshSession.updateMany({ where: { id: session.id, revokedAt: null }, data: { revokedAt: new Date() } });
 if (revoked.count !== 1) throw new AppError(401, "REFRESH_TOKEN_REUSED", "Refresh token já utilizado");
 const refreshToken = randomBytes(48).toString("base64url");
 const replacement = await tx.refreshSession.create({ data: { userId: session.userId, tokenHash: hashToken(refreshToken), expiresAt: new Date(Date.now() + REFRESH_DAYS * 86_400_000) } });
 await tx.refreshSession.update({ where: { id: session.id }, data: { replacedById: replacement.id } });
 return { accessToken: app.jwt.sign({ sub: session.userId }, { expiresIn: ACCESS_SECONDS }), refreshToken, expiresIn: ACCESS_SECONDS };
});
}

export async function revokeRefreshToken(token: string) {
	await prisma.refreshSession.updateMany({
		where: { tokenHash: hashToken(token), revokedAt: null },
		data: { revokedAt: new Date() },
	});
}

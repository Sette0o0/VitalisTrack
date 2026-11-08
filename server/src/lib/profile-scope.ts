import type { FastifyRequest } from "fastify";
import { idSchema } from "@vitalis/contracts";
import { prisma } from "./prisma.js";
import { AppError } from "./errors.js";
export async function resolveProfile(userId: string, requested?: string) {
	if (requested !== undefined && !idSchema.safeParse(requested).success)
		throw new AppError(400, "INVALID_PROFILE", "Perfil inválido");
	const profile = await prisma.profile.findFirst({
		where: requested ? { id: requested, userId } : { userId, isPrimary: true },
	});
	if (!profile) throw new AppError(404, "PROFILE_NOT_FOUND", "Perfil não encontrado");
	return profile.id;
}
export async function requireProfile(request: FastifyRequest) {
	const header = request.headers["x-profile-id"];
	if (Array.isArray(header)) throw new AppError(400, "INVALID_PROFILE", "Perfil inválido");
	request.profileId = await resolveProfile(request.user.sub, header);
}

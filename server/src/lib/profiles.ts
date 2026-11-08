import { healthProfileCreateSchema } from "@vitalis/contracts";
import { prisma } from "./prisma.js";
import { AppError } from "./errors.js";
export async function createHealthProfile(userId: string, input: unknown) {
	const { id, name } = healthProfileCreateSchema.parse(input);
	return prisma.$transaction(async (tx) => {
		await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"profile:" + id}))`;
		const existing = await tx.profile.findUnique({ where: { id } });
		if (existing) {
			if (existing.userId !== userId)
				throw new AppError(409, "PROFILE_CONFLICT", "Identificador de perfil indisponível");
			return existing;
		}
		return tx.profile.create({ data: { id, userId, name, goals: { create: { userId } } } });
	});
}
export const profileSummary = (p: {
	id: string;
	name: string;
	isPrimary: boolean;
	updatedAt: Date;
}) => ({ id: p.id, name: p.name, isPrimary: p.isPrimary, updatedAt: p.updatedAt.toISOString() });

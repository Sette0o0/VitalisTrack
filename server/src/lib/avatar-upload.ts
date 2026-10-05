import { createWriteStream } from "node:fs";
import { mkdir, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import type { FastifyRequest } from "fastify";
import { idSchema } from "@vitalis/contracts";
import { AppError } from "./errors.js";
import { prisma } from "./prisma.js";

export async function uploadAvatar(request: FastifyRequest) {
	const header = request.headers["idempotency-key"];
	const parsed = idSchema.safeParse(header);
	if (header !== undefined && !parsed.success)
		throw new AppError(400, "INVALID_IDEMPOTENCY_KEY", "Identificador de envio inválido");
	const mutationId = parsed.success ? parsed.data : crypto.randomUUID();
	const userId = request.user.sub;
	const file = await request.file();
	if (!file) throw new AppError(400, "FILE_REQUIRED", "Envie uma imagem");
	const extension = new Map([["image/jpeg", ".jpg"], ["image/png", ".png"], ["image/webp", ".webp"]]).get(file.mimetype);
	if (!extension) {
		file.file.resume();
		throw new AppError(415, "INVALID_FILE_TYPE", "Use JPEG, PNG ou WebP");
	}
	const directory = join(process.cwd(), "storage", "avatars");
	await mkdir(directory, { recursive: true });
	const temporary = join(directory, `.upload-${crypto.randomUUID()}`);
	const filename = `${userId}-${mutationId}${extension}`;
	const target = join(directory, filename);
	try {
		await pipeline(file.file, createWriteStream(temporary, { flags: "wx" }));
		if (file.file.truncated) throw new AppError(413, "FILE_TOO_LARGE", "A imagem deve ter no máximo 5 MB");
		await prisma.$transaction(async (tx) => {
			await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId + ":" + mutationId}))`;
			const replay = await tx.processedMutation.findUnique({ where: { userId_mutationId: { userId, mutationId } } });
			if (replay) {
				if (!(replay.result && typeof replay.result === "object" && "kind" in replay.result && replay.result.kind === "avatar"))
					throw new AppError(409, "IDEMPOTENCY_CONFLICT", "Identificador utilizado por outra operação");
				return;
			}
			await rename(temporary, target);
			try {
				const avatarPath = `/uploads/avatars/${filename}`;
				await tx.profile.update({ where: { userId }, data: { avatarPath } });
				await tx.processedMutation.create({ data: { userId, mutationId, result: { kind: "avatar", avatarPath } } });
			} catch (error) {
				// Cleanup while holding the lock: another retry cannot replace this file yet.
				await unlink(target).catch(() => {});
				throw error;
			}
		});
	} finally { await unlink(temporary).catch(() => {}); }
}

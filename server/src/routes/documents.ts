import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rename, unlink, stat } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { createHash } from "node:crypto";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { DOCUMENT_MAX_BYTES, documentMimeSchema, idSchema, type MedicalDocument as WireDocument } from "@vitalis/contracts";
import type { MedicalDocument } from "../../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { config } from "../config.js";
import { requireAuth } from "../lib/auth.js";
import { requireProfile } from "../lib/profile-scope.js";
import { AppError } from "../lib/errors.js";
export const documentJson = (r: MedicalDocument): WireDocument => ({
    id: r.id, profileId: r.profileId, name: r.name, mimeType: documentMimeSchema.parse(r.mimeType),
    size: r.size, sha256: r.sha256, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
    deletedAt: r.deletedAt?.toISOString() ?? null, revision: String(r.revision),
});
export function documentSignature(bytes: Buffer, mime: string) {
    if (mime === "application/pdf")
        return bytes.subarray(0, 5).equals(Buffer.from("%PDF-"));
    if (mime === "image/png")
        return bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"));
    if (mime === "image/jpeg")
        return bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    return mime === "image/webp" && bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP";
}
export const safeDocumentName = (s: string) => s.normalize("NFKC").split(/[\\/]/).pop()!.split("").filter(c => c.charCodeAt(0) >= 32 && c.charCodeAt(0) !== 127).join("").trim().slice(0, 180) || "Documento";
export const privateDocumentDirectory = () => {
    const root = resolve(config.PRIVATE_STORAGE_DIR), publicRoot = resolve(process.cwd(), "storage");
    if (root === publicRoot || root.startsWith(publicRoot + sep))
        throw new Error("PRIVATE_STORAGE_DIR must be outside public uploads");
    return join(root, "documents");
};
export async function documentRoutes(app: FastifyInstance) {
    app.addHook("preHandler", requireAuth);
    app.addHook("preHandler", requireProfile);
    app.get("/documents/sync", async (req) => {
        const q = z.object({ cursor: z.string().regex(/^\d{1,18}$/).default("0"), limit: z.coerce.number().int().min(1).max(100).default(100) }).parse(req.query);
        const rows = await prisma.medicalDocument.findMany({ where: { userId: req.user.sub, profileId: req.profileId, revision: { gt: BigInt(q.cursor) } }, orderBy: { revision: "asc" }, take: q.limit + 1 });
        const page = rows.slice(0, q.limit);
        return { data: { records: page.map(documentJson), cursor: String(page.at(-1)?.revision ?? q.cursor), hasMore: rows.length > q.limit } };
    });
    app.get("/documents", async (req) => {
        const q = z.object({ limit: z.coerce.number().int().min(1).max(100).default(30), before: z.iso.datetime().optional(), id: z.uuid().optional() }).parse(req.query);
        const rows = await prisma.medicalDocument.findMany({
            where: { userId: req.user.sub, profileId: req.profileId, deletedAt: null, ...(q.before ? { OR: [{ createdAt: { lt: new Date(q.before) } }, { createdAt: new Date(q.before), id: { lt: q.id ?? "ffffffff-ffff-ffff-ffff-ffffffffffff" } }] } : {}) },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: q.limit + 1,
        });
        const page = rows.slice(0, q.limit), last = page.at(-1);
        return { data: { records: page.map(documentJson), nextCursor: rows.length > q.limit && last ? { before: last.createdAt.toISOString(), id: last.id } : null } };
    });
    app.get("/documents/:id/file", async (req, reply) => {
        const { id } = z.object({ id: idSchema }).parse(req.params);
        const r = await prisma.medicalDocument.findFirst({ where: { id, userId: req.user.sub, profileId: req.profileId, deletedAt: null } });
        if (!r)
            throw new AppError(404, "NOT_FOUND", "Documento não encontrado");
        const path = join(privateDocumentDirectory(), r.storageName);
        if (!(await stat(path).catch(() => null)))
            throw new AppError(404, "FILE_UNAVAILABLE", "Arquivo indisponível");
        return reply.type(r.mimeType).header("cache-control", "private, no-store").header("x-content-type-options", "nosniff")
            .header("content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent(r.name)}`).send(createReadStream(path));
    });
    app.post("/documents", async (req, reply) => {
        const id = idSchema.parse(req.headers["x-document-id"]), mutationId = idSchema.parse(req.headers["idempotency-key"]);
        const file = await req.file({ limits: { fileSize: DOCUMENT_MAX_BYTES, files: 1 } });
        if (!file)
            throw new AppError(400, "FILE_REQUIRED", "Escolha um documento");
        const mime = documentMimeSchema.safeParse(file.mimetype);
        if (!mime.success) {
            file.file.resume();
            throw new AppError(415, "INVALID_FILE_TYPE", "Use PDF, JPEG, PNG ou WebP");
        }
        const directory = privateDocumentDirectory();
        await mkdir(directory, { recursive: true });
        const temporary = join(directory, `.upload-${crypto.randomUUID()}`), storageName = `${id}-${mutationId}.bin`, target = join(directory, storageName);
        let size = 0, signature = Buffer.alloc(0), published = false;
        const hash = createHash("sha256");
        try {
            await pipeline(file.file, new Transform({ transform(chunk: Buffer, _encoding, done) {
                    size += chunk.length;
                    hash.update(chunk);
                    if (signature.length < 16)
                        signature = Buffer.concat([signature, chunk.subarray(0, 16 - signature.length)]);
                    done(null, chunk);
                } }), createWriteStream(temporary, { flags: "wx" }));
            if (file.file.truncated || size > DOCUMENT_MAX_BYTES)
                throw new AppError(413, "FILE_TOO_LARGE", "O documento deve ter no máximo 10 MiB");
            if (!size || !documentSignature(signature, mime.data))
                throw new AppError(415, "INVALID_FILE_TYPE", "O conteúdo não corresponde ao tipo do documento");
            const displayName = file.fields.name;
            const requestedName = displayName && !Array.isArray(displayName) && displayName.type === "field"
                ? z.string().min(1).max(180).parse(displayName.value) : file.filename;
            const sha256 = hash.digest("hex"), name = safeDocumentName(requestedName);
            const value = await prisma.$transaction(async (tx) => {
                await tx.$executeRaw `SELECT pg_advisory_xact_lock(hashtext(${req.user.sub + ":" + mutationId}))`;
                await tx.$executeRaw `SELECT pg_advisory_xact_lock(hashtext(${"sync-profile:" + req.profileId}))`;
                await tx.$executeRaw `SELECT pg_advisory_xact_lock(hashtext(${"document:" + id}))`;
                const replay = await tx.processedMutation.findUnique({ where: { userId_mutationId: { userId: req.user.sub, mutationId } } });
                const existing = await tx.medicalDocument.findUnique({ where: { id } });
                if (existing && (existing.userId !== req.user.sub || existing.profileId !== req.profileId))
                    throw new AppError(403, "FORBIDDEN", "Documento indisponível");
                if (replay) {
                    const r = replay.result as {
                        kind?: string;
                        id?: string;
                        sha256?: string;
                    };
                    if (replay.profileId !== req.profileId || r.kind !== "document" || r.id !== id || r.sha256 !== sha256 || !existing)
                        throw new AppError(409, "IDEMPOTENCY_CONFLICT", "Identificador de envio já utilizado");
                    return existing;
                }
                if (existing && (existing.sha256 !== sha256 || existing.deletedAt))
                    throw new AppError(409, "CONFLICT", "Documento já registrado; escolha um novo arquivo");
                let result = existing;
                if (!result) {
                    await rename(temporary, target);
                    published = true;
                    result = await tx.medicalDocument.create({ data: { id, userId: req.user.sub, profileId: req.profileId, name, mimeType: mime.data, size, sha256, storageName } });
                }
                await tx.processedMutation.create({ data: { userId: req.user.sub, profileId: req.profileId, mutationId, result: { kind: "document", id, sha256 } } });
                return result;
            });
            published = false;
            return reply.code(201).send({ data: documentJson(value) });
        }
        finally {
            await unlink(temporary).catch(() => { });
            if (published)
                await unlink(target).catch(() => { });
        }
    });
    app.delete("/documents/:id", async (req, reply) => {
        const { id } = z.object({ id: idSchema }).parse(req.params);
        const mutationId = req.headers["idempotency-key"] === undefined ? crypto.randomUUID() : idSchema.parse(req.headers["idempotency-key"]);
        const path = await prisma.$transaction(async (tx) => {
            await tx.$executeRaw `SELECT pg_advisory_xact_lock(hashtext(${req.user.sub + ":" + mutationId}))`;
            await tx.$executeRaw `SELECT pg_advisory_xact_lock(hashtext(${"sync-profile:" + req.profileId}))`;
            const replay = await tx.processedMutation.findUnique({ where: { userId_mutationId: { userId: req.user.sub, mutationId } } });
            if (replay) {
                const result = replay.result as {
                    kind?: string;
                    id?: string;
                };
                if (replay.profileId !== req.profileId || result.kind !== "document-delete" || result.id !== id)
                    throw new AppError(409, "IDEMPOTENCY_CONFLICT", "Identificador já utilizado");
                return null;
            }
            const existing = await tx.medicalDocument.findUnique({ where: { id } });
            if (existing && (existing.userId !== req.user.sub || existing.profileId !== req.profileId))
                throw new AppError(403, "FORBIDDEN", "Documento indisponível");
            if (existing && !existing.deletedAt) {
                const [rev] = await tx.$queryRaw<{
                    revision: bigint;
                }[]> `SELECT nextval('"MedicalDocument_revision_seq"') AS revision`;
                await tx.medicalDocument.update({ where: { id }, data: { deletedAt: new Date(), revision: rev!.revision } });
            }
            await tx.processedMutation.create({ data: { userId: req.user.sub, profileId: req.profileId, mutationId, result: { kind: "document-delete", id } } });
            return existing?.storageName ?? null;
        });
        if (path)
            await unlink(join(privateDocumentDirectory(), path)).catch(() => { });
        return reply.code(204).send();
    });
}

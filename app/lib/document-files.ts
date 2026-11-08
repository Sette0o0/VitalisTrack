import { Directory, File, Paths } from "expo-file-system";
import { DOCUMENT_MAX_BYTES, documentMimeSchema, type MedicalDocument } from "@vitalis/contracts";
import { newId } from "./health";
import { fileTools } from "./file-tools";
import { getDatabase, serializeWrite } from "./local-database";
import { findDocument, saveDocument, setDocumentUri, type StoredDocument } from "./document-store";
import { apiResponse } from "./api";
import { UserFacingError } from "./user-error";
const extension = (mime: string) => ({ "application/pdf": ".pdf", "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp" })[mime] ?? "";
function directory(userId: string, profileId: string) {
    const d = new Directory(Paths.document, "medical", userId, profileId);
    d.create({ idempotent: true, intermediates: true });
    return d;
}
export async function importDocument(userId: string, profileId: string, source: {
    uri: string;
    name: string;
    mimeType?: string | null;
    size?: number;
}) {
    const mime = documentMimeSchema.safeParse(source.mimeType);
    if (!mime.success)
        throw new UserFacingError("Escolha PDF, JPEG, PNG ou WebP.");
    if (source.size && source.size > DOCUMENT_MAX_BYTES)
        throw new UserFacingError("O documento deve ter no máximo 10 MiB.");
    const id = newId(), file = new File(directory(userId, profileId), id + extension(mime.data));
    try {
        new File(source.uri).copy(file);
        const info = await fileTools().info(file.uri);
        if (!info.size || info.size > DOCUMENT_MAX_BYTES)
            throw new UserFacingError("O documento deve ter entre 1 byte e 10 MiB.");
        const h = info.headerHex ?? "";
        const valid = mime.data === "application/pdf" ? h.startsWith("255044462d") : mime.data === "image/jpeg" ? h.startsWith("ffd8ff") : mime.data === "image/png" ? h.startsWith("89504e470d0a1a0a") : h.startsWith("52494646") && h.slice(16, 24) === "57454250";
        if (!valid)
            throw new UserFacingError("O conteúdo não corresponde a um PDF ou imagem válido.");
        const now = new Date().toISOString();
        const record: MedicalDocument = { id, profileId, name: source.name.replace(/[\x00-\x1f\x7f]/g, "").slice(0, 180) || "Documento", mimeType: mime.data, size: info.size, sha256: info.sha256, createdAt: now, updatedAt: now, deletedAt: null, revision: "0" };
        await saveDocument(userId, profileId, record, file.uri);
        return record;
    }
    catch (e) {
        if (file.exists)
            file.delete();
        throw e;
    }
}
export async function ensureDocumentFile(userId: string, profileId: string, document: StoredDocument) {
    if (document.localUri && new File(document.localUri).exists)
        return document.localUri;
    let published = false;
  const target = new File(directory(userId, profileId), document.id + extension(document.mimeType)), temporary = new File(directory(userId, profileId), document.id + ".download-" + newId());
    try {
        const response = await apiResponse(`/v1/documents/${document.id}/file`, { headers: { "x-profile-id": profileId } }, true, userId);
        temporary.write(new Uint8Array(await response.arrayBuffer()));
        const info = await fileTools().info(temporary.uri);
        if (info.sha256 !== document.sha256 || info.size !== document.size)
            throw new UserFacingError("O arquivo recebido não está íntegro. Tente baixar novamente.");
        if (target.exists)
            target.delete();
        temporary.move(target); published = true;
        await setDocumentUri(userId, profileId, document.id, target.uri);
        if (!(await findDocument(userId, profileId, document.id))) {
            if (target.exists)
                target.delete();
            throw new UserFacingError("Este documento foi excluído durante o download.");
        }
        return target.uri;
    }
    finally {
        if (!published && temporary.exists)
            temporary.delete();
    }
}
export async function pruneDocumentFiles(userId: string) {
    const db = await getDatabase();
    await serializeWrite(async () => {
        const rows = await db.getAllAsync<{
            id: string;
            profile_id: string;
            local_uri: string;
        }>("SELECT id,profile_id,local_uri FROM medical_documents WHERE user_id=? AND deleted=1 AND local_uri IS NOT NULL", userId);
        const pending = await db.getAllAsync<{
            mutation: string;
        }>("SELECT mutation FROM outbox_v2 WHERE user_id=?", userId);
        const protectedIds = new Set(pending.map(r => JSON.parse(r.mutation)).filter(m => m.entity === "document").map(m => m.entityId ?? m.payload?.id));
        for (const row of rows)
            if (!protectedIds.has(row.id)) {
                const file = new File(row.local_uri);
                if (file.exists)
                    file.delete();
                await db.runAsync("UPDATE medical_documents SET local_uri=NULL WHERE user_id=? AND profile_id=? AND id=?", userId, row.profile_id, row.id);
            }
    });
}

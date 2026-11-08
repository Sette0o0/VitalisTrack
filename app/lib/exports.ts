import { loadTokens, tokenClaims, sessionRevision } from "./session";
import { Directory, File, Paths } from "expo-file-system";
import * as SQLite from "expo-sqlite";
import * as Print from "expo-print";
import NetInfo from "@react-native-community/netinfo";
import { type HealthReport, type MedicalDocument, type UnitSystem } from "@vitalis/contracts";
import { getDatabase, getValue, setValue, pendingCount, serializeWrite, storedProfiles } from "./local-database";
import { synchronizeAccount } from "./sync-engine";
import { ApiClientError, apiRequest, apiResponse } from "./api";
import { listDocuments } from "./document-store";
import { ensureDocumentFile } from "./document-files";
import { fileTools, exportDirectory, cleanTemporaryExports } from "./file-tools";
import { backupHealthRow, backupProfileDetails, reportHtml } from "./export-format";
import { CSV_HEADER, csvCell, healthCsvRow } from "./report-store";
import { newId } from "./health";
import { UserFacingError } from "./user-error";
import type { AppState } from "@/state/types";
export async function exportPdf(report: HealthReport, state: AppState, extras: string[] = []) {
    cleanTemporaryExports();
    const pending = !!(await pendingCount(state.userId!, state.profileId ?? state.userId!));
    const result = await Print.printToFileAsync({ html: reportHtml(report, state.profile.name, state.unitSystem ?? "metric", pending, extras), width: 595, height: 842 });
    const target = new File(exportDirectory(), `vitalis-${report.period}-${report.start}-${newId()}.pdf`);
    new File(result.uri).move(target);
    return target.uri;
}
export async function exportCsv(userId: string, profileId: string) {
    cleanTemporaryExports();
    const db = await getDatabase(), file = new File(exportDirectory(), `vitalis-dados-${newId()}.csv`);
    file.create();
    const native = fileTools();
    try {
        await native.appendText(file.uri, "\ufeff" + CSV_HEADER.map(x => csvCell(x)).join(",") + "\r\n");
        // A read transaction freezes this export while SQLite continues to own the source data.
        await serializeWrite(() => db.withExclusiveTransactionAsync(async (tx) => {
            let cursor = "";
            for (;;) {
                const rows = await tx.getAllAsync<{
                    kind: string;
                    id: string;
                    record: string;
                }>("SELECT kind,id,record FROM health_records WHERE user_id=? AND profile_id=? AND kind IN ('meal','activity','weight') AND (kind||':'||id)>? ORDER BY kind,id LIMIT 100", userId, profileId, cursor);
                if (!rows.length)
                    break;
                await native.appendText(file.uri, rows.map(row => healthCsvRow(row.kind, profileId, JSON.parse(row.record))).join(""));
                const last = rows.at(-1)!;
                cursor = last.kind + ":" + last.id;
            }
        }));
        return file.uri;
    }
    catch (e) {
        if (file.exists)
            file.delete();
        throw e;
    }
}
type Friendship = {
    id: string;
    profileId: string;
    friendProfileId: string;
    status: string;
};
type Photo = {
    source: string;
    uri: string;
    mimeType: string;
};
type BlobRef = {
    id: string;
    uri: string;
    mimeType: string;
    size: number;
    sha256: string;
};
const stateKey = (userId: string, id: string) => `${userId}:${id === userId ? "" : id + ":"}app-state`;
async function prepareAccount(userId: string, work: Directory, progress: (text: string) => void) {
    const online = { ...await NetInfo.fetch() };
    let friendships: Friendship[] = [];
    const useLocal = async () => { const known = await getValue("backup-friendships", userId, userId), complete = await getValue("account-sync-complete", userId, userId); if (!known || !complete)
        throw new UserFacingError("Conecte à internet para concluir a primeira cópia de todos os perfis e anexos."); progress("Usando a cópia local da última sincronização…"); return JSON.parse(known) as Friendship[]; };
    if (online.isConnected && online.isInternetReachable !== false) {
        try {
            progress("Sincronizando todos os perfis…");
            await synchronizeAccount(userId);
            for (const p of await storedProfiles(userId)) {
                const rows = await apiRequest<{
                    id: string;
                    status: string;
                    other: {
                        id: string;
                    };
                }[]>("/v1/friendships", { headers: { "x-profile-id": p.id } }, true, userId);
                friendships.push(...rows.map(r => ({ id: r.id, profileId: p.id, friendProfileId: r.other.id, status: r.status })));
            }
            await setValue("backup-friendships", JSON.stringify(friendships), userId, userId);
        }
        catch (e) {
            if (e instanceof ApiClientError && [401, 403].includes(e.status))
                throw e;
            friendships = await useLocal();
            online.isConnected = false;
        }
    }
    else {
        friendships = await useLocal();
    }
    const profiles = await storedProfiles(userId), photos = new Map<string, Photo>();
    if (!profiles.length)
        throw new UserFacingError("Sincronize seus perfis antes de gerar o backup.");
    const db = await getDatabase();
    for (const p of profiles) {
        const row = await db.getFirstAsync<{
            profile: string;
        }>("SELECT json_extract(value,'$.profile') profile FROM kv WHERE key=?", stateKey(userId, p.id));
        if (!row || !(await getValue("documents-cursor", userId, p.id)) || !(await getValue("wellbeing-cursor", userId, p.id)))
            throw new UserFacingError("Conecte à internet para completar os dados de todos os perfis.");
        const profile = JSON.parse(row.profile) as AppState["profile"];
        if (profile.avatar) {
            let source: File, mimeType = "image/jpeg";
            if (!profile.avatar.startsWith("file://")) {
                if (!online.isConnected || online.isInternetReachable === false)
                    throw new UserFacingError("Conecte para baixar as fotos que faltam no backup.");
                const url = new URL(profile.avatar);
                if (!url.pathname.startsWith("/uploads/avatars/"))
                    throw new UserFacingError("A foto do perfil precisa ser sincronizada novamente.");
                const response = await apiResponse(url.pathname, {}, true, userId);
                mimeType = response.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
                source = new File(work, `prepare-photo-${p.id}`);
                source.write(new Uint8Array(await response.arrayBuffer()));
            }
            else {
                source = new File(profile.avatar);
                mimeType = source.type || "image/jpeg";
                if (!source.exists)
                    throw new UserFacingError("Uma foto não está disponível. Sincronize antes de gerar o backup.");
            }
            photos.set(p.id, { source: profile.avatar, uri: source.uri, mimeType });
        }
        let cursor: {
            at: string;
            id: string;
        } | undefined;
        do {
            const page = await listDocuments(userId, p.id, cursor, 100);
            for (const d of page.records) {
                progress("Preparando documentos…");
                await ensureDocumentFile(userId, p.id, d);
            }
            cursor = page.nextCursor;
        } while (cursor);
    }
    return { profiles, photos, friendships };
}
let backingUp = false;
async function createAccountBackup(userId: string, progress: (text: string) => void) {
    const revision = sessionRevision(), tokens = await loadTokens();
    if (!tokens || tokenClaims(tokens.accessToken).sub !== userId)
        throw new UserFacingError("Entre na conta para gerar o backup.");
    const active = () => { if (revision !== sessionRevision())
        throw new UserFacingError("A sessão foi alterada. Gere o backup novamente após entrar."); };
    cleanTemporaryExports();
    const native = fileTools(), work = new Directory(exportDirectory(), `backup-work-${Date.now()}-${newId()}`);
    work.create({ intermediates: true });
    const name = `snapshot-${newId()}.db`, output = new File(exportDirectory(), `vitalis-backup-${newId()}.json`), partial = new File(work, "partial.json");
    let snapshot: SQLite.SQLiteDatabase | undefined;
    try {
        const prepared = await prepareAccount(userId, work, progress);
        snapshot = await SQLite.openDatabaseAsync(name, {}, work.uri);
        const blobs: BlobRef[] = [];
        const total = (await (await getDatabase()).getFirstAsync<{
            n: number;
        }>("SELECT COALESCE(SUM(json_extract(record,'$.size')),0) n FROM medical_documents WHERE user_id=? AND deleted=0", userId))?.n ?? 0;
        if (Paths.availableDiskSpace < total * 2.5 + 20 * 1024 * 1024)
            throw new UserFacingError("Libere espaço no aparelho para gerar o backup completo.");
        progress("Preparando uma cópia consistente…");
        await serializeWrite(async () => {
            await SQLite.backupDatabaseAsync({ sourceDatabase: await getDatabase(), destDatabase: snapshot! });
            const catalog = await snapshot!.getFirstAsync<{ value: string }>("SELECT value FROM kv WHERE key=?", `${userId}:profiles`);
            const snapshotIds = (catalog ? JSON.parse(catalog.value) : []).map((p: { id: string }) => p.id).sort();
            const preparedIds = prepared.profiles.map(p => p.id).sort();
            if (JSON.stringify(snapshotIds) !== JSON.stringify(preparedIds))
                throw new UserFacingError("Os perfis foram alterados. Gere o backup novamente.");
            let bytes = 0;
            for (const p of prepared.profiles) {
                const row = await snapshot!.getFirstAsync<{
                    profile: string;
                }>("SELECT json_extract(value,'$.profile') profile FROM kv WHERE key=?", stateKey(userId, p.id));
                if (!row)
                    throw new UserFacingError("Os perfis foram alterados. Gere o backup novamente.");
                const profile = JSON.parse(row.profile) as AppState["profile"], photo = prepared.photos.get(p.id);
                if (profile.avatar) {
                    if (!photo || photo.source !== profile.avatar)
                        throw new UserFacingError("A foto foi alterada. Gere o backup novamente.");
                    const file = new File(work, `photo-${p.id}`);
                    new File(photo.uri).copy(file);
                    const info = await native.info(file.uri);
                    bytes += info.size;
                    blobs.push({ id: p.id + ":avatar", uri: file.uri, mimeType: photo.mimeType, ...info });
                }
                let after = "";
                for (;;) {
                    const rows = await snapshot!.getAllAsync<{
                        id: string;
                        record: string;
                        local_uri: string | null;
                    }>("SELECT id,record,local_uri FROM medical_documents WHERE user_id=? AND profile_id=? AND deleted=0 AND id>? ORDER BY id LIMIT 100", userId, p.id, after);
                    if (!rows.length)
                        break;
                    for (const row of rows) {
                        const d = JSON.parse(row.record) as MedicalDocument;
                        if (!row.local_uri || !new File(row.local_uri).exists)
                            throw new UserFacingError("Um anexo ainda não está disponível. Conecte e tente novamente.");
                        const file = new File(work, `document-${d.id}`);
                        new File(row.local_uri).copy(file);
                        const info = await native.info(file.uri);
                        if (info.sha256 !== d.sha256 || info.size !== d.size)
                            throw new UserFacingError("Um anexo não passou na conferência de integridade.");
                        bytes += info.size;
                        blobs.push({ id: p.id + ":document:" + d.id, uri: file.uri, mimeType: d.mimeType, ...info });
                    }
                    after = rows.at(-1)!.id;
                }
            }
            if (Paths.availableDiskSpace < bytes * 1.5 + 20 * 1024 * 1024)
                throw new UserFacingError("Libere espaço no aparelho para gerar o backup completo.");
        });
        partial.create();
        let text = "";
        const append = async (value: string) => { active(); text += value; if (text.length >= 65536) {
            await native.appendText(partial.uri, text);
            text = "";
        } };
        const array = async (reader: (after: string) => Promise<{
            id: string;
            record: string;
        }[]>, convert: (r: Record<string, unknown>) => unknown = r => r) => {
            await append("[");
            let after = "", separator = "";
            for (;;) {
                const rows = await reader(after);
                if (!rows.length)
                    break;
                for (const row of rows) {
                    await append(separator + JSON.stringify(convert(JSON.parse(row.record))));
                    separator = ",";
                }
                after = rows.at(-1)!.id;
            }
            await append("]");
        };
        const syncRow = await snapshot.getFirstAsync<{
            value: string;
        }>("SELECT value FROM kv WHERE key=?", `${userId}:account-sync-complete`);
        let lastSyncedAt: string | null = null;
        try {
            lastSyncedAt = syncRow ? JSON.parse(syncRow.value).at ?? null : null;
        }
        catch { /* Legacy completeness marker has no timestamp. */ }
        const pending = (await snapshot.getFirstAsync<{
            n: number;
        }>("SELECT COUNT(*) n FROM outbox_v2 WHERE user_id=?", userId))?.n ?? 0;
        await append(JSON.stringify({ lastSyncedAt, includesPendingChanges: pending > 0, format: "VitalisTrack", version: 1, exportedAt: new Date().toISOString(), userId, units: "kg-cm-m-ml" }).slice(0, -1) + ',"profiles":[');
        let separator = "";
        for (const p of prepared.profiles) {
            progress(`Exportando ${p.name}…`);
            const key = stateKey(userId, p.id), row = (await snapshot.getFirstAsync<{
                profile: string;
                goals: string;
                nutrition: string | null;
                units: UnitSystem | null;
                theme: string | null;
            }>("SELECT json_extract(value,'$.profile') profile,json_extract(value,'$.goals') goals,json_extract(value,'$.nutrition') nutrition,json_extract(value,'$.unitSystem') units,json_extract(value,'$.themeMode') theme FROM kv WHERE key=?", key))!;
            const profile = backupProfileDetails(JSON.parse(row.profile), blobs.some(b => b.id === p.id + ":avatar") ? p.id + ":avatar" : undefined);
            const enabled = await snapshot.getFirstAsync<{
                value: string;
            }>("SELECT value FROM kv WHERE key=?", `${userId}:${p.id === userId ? "" : p.id + ":"}reminders-enabled`);
            const settings = { goals: JSON.parse(row.goals), unitSystem: row.units ?? "metric", nutrition: row.nutrition ? JSON.parse(row.nutrition) : null, themeMode: row.theme ?? "system", remindersEnabled: enabled?.value === "true" };
            await append(separator + JSON.stringify({ id: p.id, profile, settings }).slice(0, -1));
            separator = ",";
            for (const [kind, field] of [["water", "water"], ["meal", "meals"], ["activity", "activities"], ["weight", "weights"], ["steps", "steps"]]) {
                await append(',"' + field + '":');
                await array(after => snapshot!.getAllAsync("SELECT id,record FROM health_records WHERE user_id=? AND profile_id=? AND kind=? AND id>? ORDER BY id LIMIT 100", userId, p.id, kind, after), r => backupHealthRow(kind, r));
            }
            await append(',"recipes":');
            await array(after => snapshot!.getAllAsync("SELECT json_extract(value,'$.id') id,value record FROM json_each((SELECT value FROM kv WHERE key=?),'$.recipes') WHERE json_extract(value,'$.deletedAt') IS NULL AND json_extract(value,'$.id')>? ORDER BY id LIMIT 100", key, after));
            await append(',"wellbeing":');
            await array(after => snapshot!.getAllAsync("SELECT id,record FROM wellbeing_records WHERE user_id=? AND profile_id=? AND deleted=0 AND id>? ORDER BY id LIMIT 100", userId, p.id, after));
            await append(',"documents":');
            await array(after => snapshot!.getAllAsync("SELECT id,record FROM medical_documents WHERE user_id=? AND profile_id=? AND deleted=0 AND id>? ORDER BY id LIMIT 100", userId, p.id, after));
            await append("}");
            // Envelope schema is exercised on complete fixture exports without materializing this account here.
        }
        await append('],"friendships":' + JSON.stringify(prepared.friendships) + ',"blobs":[');
        separator = "";
        for (const blob of blobs) {
            await append(separator + JSON.stringify({ id: blob.id, mimeType: blob.mimeType, size: blob.size, sha256: blob.sha256 }).slice(0, -1) + ',"base64":"');
            if (text) {
                await native.appendText(partial.uri, text);
                text = "";
            }
            await native.appendBase64(blob.uri, partial.uri);
            await append('"}');
            separator = ",";
        }
        await append("]}");
        if (text)
            await native.appendText(partial.uri, text);
        partial.move(output);
        return output.uri;
    }
    catch (e) {
        if (output.exists)
            output.delete();
        throw e;
    }
    finally {
        try {
            await snapshot?.closeAsync();
        }
        finally {
            if (work.exists)
                work.delete();
        }
    }
}
export async function exportAccountBackup(userId: string, progress: (text: string) => void = () => { }) {
    if (backingUp)
        throw new UserFacingError("Um backup já está em andamento.");
    backingUp = true;
    try {
        return await createAccountBackup(userId, progress);
    }
    finally {
        backingUp = false;
    }
}

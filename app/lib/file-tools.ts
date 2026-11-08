import { requireOptionalNativeModule } from "expo";
import { File, Directory, Paths } from "expo-file-system";
import { StorageAccessFramework, deleteAsync } from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { UserFacingError } from "./user-error";
type FilesBridge = {
    info(uri: string): Promise<{
        size: number;
        sha256: string;
        headerHex?: string;
    }>;
    appendText(uri: string, text: string): Promise<void>;
    appendBase64(source: string, destination: string): Promise<void>;
    copyToUri(source: string, destination: string): Promise<void>;
    open(uri: string, mime: string): Promise<void>;
};
export const fileTools = () => {
    const native = requireOptionalNativeModule<FilesBridge>("VitalisFiles");
    if (!native)
        throw new UserFacingError("Atualize o APK Android para usar arquivos.");
    return native;
};
export function exportDirectory() {
    const dir = new Directory(Paths.cache, "exports");
    dir.create({ intermediates: true, idempotent: true });
    return dir;
}
export function cleanTemporaryExports(now = Date.now()) {
    const dir = exportDirectory();
    for (const entry of dir.list()) {
        if (entry instanceof File && (entry.modificationTime ?? now) < now - 86400000)
            entry.delete();
        if (entry instanceof Directory && entry.name.startsWith("backup-work-")) {
            const created = Number(entry.name.slice("backup-work-".length).split("-")[0]);
            if (created && created < now - 86400000)
                entry.delete();
        }
    }
}
export async function shareFile(uri: string, mimeType: string) {
    if (!(await Sharing.isAvailableAsync()))
        throw new UserFacingError("Não há aplicativo disponível para compartilhar este arquivo.");
    await Sharing.shareAsync(uri, { mimeType, dialogTitle: "Compartilhar arquivo" });
}
export async function saveFileAs(uri: string, name: string, mime: string) {
    const permission = await StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!permission.granted)
        return false;
    const target = await StorageAccessFramework.createFileAsync(permission.directoryUri, name, mime);
    try{await fileTools().copyToUri(uri, target);return true;}
    catch{await deleteAsync(target,{idempotent:true}).catch(()=>{});throw new UserFacingError("Não foi possível salvar no local escolhido. Confira o espaço e a permissão da pasta.");}
}

import { Directory, File, Paths } from "expo-file-system";
import type { Profile } from "@/state/types";

const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const directory = (userId: string) => new Directory(Paths.document, "avatars", userId);

export function persistAvatar(userId: string, mutationId: string, uri: string, mimeType: string) {
	const extension = extensions[mimeType];
	if (!extension) throw new Error("Use JPEG, PNG ou WebP.");
	const source = new File(uri);
	if (!source.exists || source.size <= 0) throw new Error("Não foi possível ler a imagem escolhida.");
	if (source.size > 5 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 5 MB.");
	const folder = directory(userId);
	folder.create({ intermediates: true, idempotent: true });
	const target = new File(folder, `${mutationId}.${extension}`);
	try { source.copy(target); } catch (error) {
		if (target.exists) target.delete();
		throw error;
	}
	return target.uri;
}

export function cleanupAvatarFiles(userId: string, references: Set<string>) {
	const folder = directory(userId);
	if (!folder.exists) return;
	for (const file of folder.list()) {
		if (file instanceof File && !references.has(file.uri)) file.delete();
	}
}

export function reconcileAvatar(current: Profile, remoteUrl: string | null, pending: boolean): Pick<Profile, "avatar" | "avatarRemoteUrl" | "avatarMutationId"> {
	if (pending || (current.avatar?.startsWith("file://") && current.avatarRemoteUrl === remoteUrl))
		return { avatar: current.avatar, avatarRemoteUrl: current.avatarRemoteUrl, avatarMutationId: current.avatarMutationId };
	return { avatar: remoteUrl ?? undefined, avatarRemoteUrl: remoteUrl ?? undefined, avatarMutationId: undefined };
}

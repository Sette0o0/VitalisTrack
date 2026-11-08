import { pruneDocumentFiles } from "./document-files";
import { acknowledgeDocument, receiveDocuments } from "./document-store";
import type { DocumentChanges, MedicalDocument } from "@vitalis/contracts";
import { receiveWellbeing,wellbeingCursor } from "./wellbeing-store";
import type { WellbeingChanges } from "@vitalis/contracts";
import { File } from "expo-file-system";
import type { HealthProfile, Profile, SyncPull, SyncResult } from "@vitalis/contracts";
import type { AppState, LocalMutation } from "@/state/types";
import { initialState } from "@/state/reducer";
import { migrateState } from "@/state/migration";
import { apiRequest } from "./api";
import {
	getValue,
 setValue,
	loadState,
	pendingMutations,
	removeMutations,
	markAttempt,
	saveState,
	storedProfiles,
	rememberProfiles,
	updateStoredState,
} from "./local-database";
import { drainOutbox, orderedBatch } from "./sync";
import { mergePull } from "./merge-pull";
export type SyncAdapter = {
	active: () => boolean;
	apply: (
		profileId: string,
		update: (state: AppState) => AppState | Promise<AppState>,
		cursor?: string,
	) => Promise<void>;
	avatarStarted?: (uri: string) => void;
	avatarFinished?: (uri: string) => void;
	acknowledged?: () => Promise<void>;
};
const flights = new Map<string, { promise: Promise<void>; active: () => boolean }>();
let foreground: { userId: string; adapter: SyncAdapter } | null = null;
export function setSyncForeground(userId: string, adapter: SyncAdapter) {
	const binding = { userId, adapter };
	foreground = binding;
	return () => {
		if (foreground === binding) foreground = null;
	};
}
export function synchronizeAccount(userId: string, adapter?: SyncAdapter): Promise<void> {
	const previous = flights.get(userId);
	if (previous)
		return previous.active()
			? previous.promise
			: previous.promise.catch(() => {}).then(() => synchronizeAccount(userId, adapter));
	const io = foreground?.userId === userId ? foreground.adapter : adapter;
	const active = io?.active ?? (() => true);
	const apply =
		io?.apply ??
		((profileId, update, cursor) => updateStoredState(userId, profileId, update, cursor));
	const run = (async () => {
		const remote = await apiRequest<HealthProfile[]>("/v1/profiles", {}, true, userId);
		const local = await storedProfiles(userId);
		const profiles = [...new Map([...local, ...remote].map((p) => [p.id, p])).values()];
		if (!active()) return;
		await rememberProfiles(userId, profiles);
		const failures: unknown[] = [];
		for (const p of profiles) {
			try {
				if (!active()) return;
				if (!(await loadState(userId, p.id))) {
					await saveState({
						...migrateState(null, userId),
						profileId: p.id,
						authenticated: true,
						profile: {
							...initialState.profile,
							name: p.name,
							email: (await loadState(userId, userId))?.profile.email ?? "",
						},
					});
				}
				const headers = { "x-profile-id": p.id };
				await drainOutbox<LocalMutation>({
					read: async () =>
						active() ? orderedBatch(await pendingMutations(100, userId, p.id)) : [],
					push: async (mutations) => {
						if (!active()) throw new Error("A sessão foi alterada");
						const first = mutations[0];
						if(first.entity === "document") {
 if(first.action === "delete") {
  await apiRequest<void>(`/v1/documents/${first.entityId}`,{method:"DELETE",headers:{...headers,"Idempotency-Key":first.mutationId}},true,userId);
 } else {
  const payload=first.payload!;
  const body=new FormData();
  // Expo File keeps its private UUID basename; send the display name separately.
  body.append("name",String(payload.name));body.append("file",new File(String(payload.uri)) as unknown as Blob);
  const record=await apiRequest<MedicalDocument>("/v1/documents",{method:"POST",headers:{...headers,"Idempotency-Key":first.mutationId,"x-document-id":String(payload.id)},body},true,userId);
  if(!active())throw new Error("A sessão foi alterada");
  await acknowledgeDocument(userId,p.id,record);
 }
 return [{mutationId:first.mutationId,status:"applied"}];
 }
 if (first.entity === "avatar") {
							io?.avatarStarted?.(first.payload.uri);
							try {
								const data = new FormData();
								// Expo fetch accepts File objects and can complete while JS timers are paused.
								data.append("file", new File(first.payload.uri) as unknown as Blob);
								const profile = await apiRequest<Profile>(
									"/v1/profile/avatar",
									{
										method: "POST",
										headers: { ...headers, "Idempotency-Key": first.mutationId },
										body: data,
									},
									true,
									userId,
								);
								if (!active()) throw new Error("A sessão foi alterada");
								await apply(p.id, (current) =>
									current.profile.avatarMutationId === first.mutationId
										? {
												...current,
												profile: {
													...current.profile,
													avatarRemoteUrl: profile.avatarUrl ?? undefined,
												},
											}
										: current,
								);
								return [{ mutationId: first.mutationId, status: "applied" }];
							} finally {
								io?.avatarFinished?.(first.payload.uri);
							}
						}
						return apiRequest<SyncResult[]>(
							"/v1/sync",
							{
								method: "POST",
								body: JSON.stringify({
									mutations: mutations.map((m) => ({ ...m, profileId: p.id })),
								}),
							},
							true,
							userId,
						);
					},
					ack: async (ids) => {
						if (!active()) throw new Error("A sessão foi alterada");
						await removeMutations(ids, userId);
						await io?.acknowledged?.();
					},
					fail: (ids) => markAttempt(ids, userId),
				});
				if (!active()) return;
				const cursor = await getValue("sync-cursor", userId, p.id);
				const pulled = await apiRequest<SyncPull>(
					`/v1/sync${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
					{ headers },
					true,
					userId,
				);
				if (!active()) return;
				await apply(
					p.id,
					async (current) =>
						mergePull(current, pulled, await pendingMutations(1_000_000, userId, p.id)),
					pulled.cursor,
				);
    if(pulled.wellbeingVersion===1){
     let more=true;
     while(more && active()){
      const next=await wellbeingCursor(userId,p.id)??'0';
      const page=await apiRequest<WellbeingChanges>(`/v1/wellbeing/sync?cursor=${encodeURIComponent(next)}`,{headers},true,userId);
      if(!active())return;
      await receiveWellbeing(userId,p.id,page);more=page.hasMore;
     }
    }

    if(pulled.documentsVersion===1){
     let more=true;
     while(more && active()){
      const next=await getValue("documents-cursor",userId,p.id)??"0";
      const page=await apiRequest<DocumentChanges>(`/v1/documents/sync?cursor=${encodeURIComponent(next)}`,{headers},true,userId);
      if(!active())return;
      await receiveDocuments(userId,p.id,page);more=page.hasMore;
     }
    }


			} catch (error) {
				failures.push(error);
			}
		}
		if (failures.length) throw failures[0];
 if(active())await pruneDocumentFiles(userId).catch(()=>{});
 if(active())await setValue("account-sync-complete",JSON.stringify({at:new Date().toISOString(),profileIds:profiles.map(p=>p.id)}),userId,userId);
	})().finally(() => flights.delete(userId));
	flights.set(userId, { promise: run, active });
	return run;
}

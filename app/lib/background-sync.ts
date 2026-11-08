import { startBackgroundRun, finishBackgroundRun, type BackgroundRun } from "./background-diagnostics";
import { reconcileReminders } from "./reminders";
import { Platform } from "react-native";
import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import NetInfo from "@react-native-community/netinfo";
import { initDatabase } from "./local-database";
import { loadTokens, tokenClaims, sessionRevision } from "./session";
import { synchronizeAccount } from "./sync-engine";
import { updateStoredState } from "./local-database";
export const BACKGROUND_SYNC_TASK = "vitalis-sync-v3";
const record = (result: string) => console.info("[sync]", new Date().toISOString(), result);
export async function runBackgroundSync() {
	record("iniciado");
 let run:BackgroundRun|undefined;
	try {
 await initDatabase();run=await startBackgroundRun();
		const revision = sessionRevision();
		const tokens = await loadTokens();
		if (!tokens) {
			record("adiado: sessão bloqueada ou ausente");
 await finishBackgroundRun(run,"deferred","session-unavailable");
			return BackgroundTask.BackgroundTaskResult.Success;
		}
		const owner = tokenClaims(tokens.accessToken).sub;
		if (!owner) {
			record("adiado: sessão ausente");
 await finishBackgroundRun(run,"deferred","session-unavailable");
			return BackgroundTask.BackgroundTaskResult.Success;
		}
		const network = await NetInfo.fetch();
		if (!network.isConnected || network.isInternetReachable === false) {
			record("adiado: sem internet");
 await finishBackgroundRun(run,"deferred","network-unavailable");
			return BackgroundTask.BackgroundTaskResult.Success;
		}
		const active = () => revision === sessionRevision();
		await synchronizeAccount(owner, {
			active,
			apply: async (profileId, update, cursor) => {
				if (active()) await updateStoredState(owner, profileId, update, cursor);
			},
		});
		if(!active()){await finishBackgroundRun(run,"deferred","session-changed");return BackgroundTask.BackgroundTaskResult.Success;}
 await reconcileReminders(owner);
 await finishBackgroundRun(run,"completed");
		record("concluído");
		return BackgroundTask.BackgroundTaskResult.Success;
	} catch {
 if(run)await finishBackgroundRun(run,"failed","retry-required").catch(()=>{});
		record("falhou: nova tentativa no próximo agendamento");
		return BackgroundTask.BackgroundTaskResult.Failed;
	}
}
TaskManager.defineTask(BACKGROUND_SYNC_TASK, runBackgroundSync);
export async function registerBackgroundSync() {
	if (Platform.OS !== "android" || !(await TaskManager.isAvailableAsync())) return;
	if ((await BackgroundTask.getStatusAsync()) === BackgroundTask.BackgroundTaskStatus.Restricted)
		return;
	if (!(await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK)))
		await BackgroundTask.registerTaskAsync(BACKGROUND_SYNC_TASK, { minimumInterval: 15 });
}
export async function unregisterBackgroundSync() {
	if (Platform.OS !== "android") return;
	if (await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK))
		await BackgroundTask.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
}

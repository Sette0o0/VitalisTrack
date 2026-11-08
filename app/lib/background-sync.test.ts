jest.mock("./background-diagnostics",()=>({startBackgroundRun:jest.fn(async()=>({id:"run"})),finishBackgroundRun:jest.fn(async()=>{})}));
import { Platform } from "react-native";
import {
	runBackgroundSync,
	registerBackgroundSync,
	unregisterBackgroundSync,
	BACKGROUND_SYNC_TASK,
} from "./background-sync";
import * as Tasks from "expo-task-manager";
import * as Background from "expo-background-task";
import NetInfo from "@react-native-community/netinfo";
import { loadTokens, sessionRevision } from "./session";
import { synchronizeAccount } from "./sync-engine";
jest.mock("expo-task-manager", () => ({
	defineTask: jest.fn(),
	isAvailableAsync: jest.fn(async () => true),
	isTaskRegisteredAsync: jest.fn(async () => false),
}));
jest.mock("expo-background-task", () => ({
	BackgroundTaskResult: { Success: 1, Failed: 2 },
	BackgroundTaskStatus: { Available: 1, Restricted: 2 },
	getStatusAsync: jest.fn(async () => 1),
	registerTaskAsync: jest.fn(),
	unregisterTaskAsync: jest.fn(),
}));
jest.mock("@react-native-community/netinfo", () => ({
	__esModule: true,
	default: { fetch: jest.fn() },
}));
jest.mock("./session", () => ({
	loadTokens: jest.fn(),
	tokenClaims: () => ({ sub: "a" }),
	sessionRevision: jest.fn(() => 0),
}));
jest.mock("./sync-engine", () => ({ synchronizeAccount: jest.fn() }));
jest.mock("./local-database", () => ({ initDatabase: jest.fn(), updateStoredState: jest.fn() }));
beforeEach(() => {
	jest.clearAllMocks();
	Object.defineProperty(Platform, "OS", { get: () => "android", configurable: true });
	(loadTokens as jest.Mock).mockResolvedValue({ accessToken: "token" });
	(NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true, isInternetReachable: true });
	(sessionRevision as jest.Mock).mockReturnValue(0);
	(synchronizeAccount as jest.Mock).mockResolvedValue(undefined);
});
test("agendamento usa intervalo mínimo de 15 minutos e logout cancela", async () => {
	await registerBackgroundSync();
	expect(Background.registerTaskAsync).toHaveBeenCalledWith(BACKGROUND_SYNC_TASK, {
		minimumInterval: 15,
	});
	(Tasks.isTaskRegisteredAsync as jest.Mock).mockResolvedValue(true);
	await unregisterBackgroundSync();
	expect(Background.unregisterTaskAsync).toHaveBeenCalledWith(BACKGROUND_SYNC_TASK);
	(Tasks.isTaskRegisteredAsync as jest.Mock).mockResolvedValue(false);
});
test("sessão biométrica bloqueada e rede ausente adiam sem sincronizar", async () => {
	(loadTokens as jest.Mock).mockResolvedValue(null);
	expect(await runBackgroundSync()).toBe(1);
	expect(synchronizeAccount).not.toHaveBeenCalled();
	(loadTokens as jest.Mock).mockResolvedValue({ accessToken: "token" });
	(NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: false });
	expect(await runBackgroundSync()).toBe(1);
	expect(synchronizeAccount).not.toHaveBeenCalled();
});
test("sessão desbloqueada sincroniza e revogação invalida o trabalho capturado", async () => {
	expect(await runBackgroundSync()).toBe(1);
	expect(synchronizeAccount).toHaveBeenCalledWith("a", expect.any(Object));
	const adapter = (synchronizeAccount as jest.Mock).mock.calls[0][1];
	expect(adapter.active()).toBe(true);
	(sessionRevision as jest.Mock).mockReturnValue(1);
	expect(adapter.active()).toBe(false);
	(synchronizeAccount as jest.Mock).mockRejectedValue(new Error("rede"));
	expect(await runBackgroundSync()).toBe(2);
});

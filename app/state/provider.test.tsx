import { act, render, waitFor } from "@testing-library/react-native";
import * as SQLite from "expo-sqlite";
import NetInfo from "@react-native-community/netinfo";
import { AppStateProvider, useAppState } from "./app-state";
import { apiRequest, publicRequest } from "@/lib/api";
import { getBiometricStatus, loadTokens, unlockBiometricSession } from "@/lib/session";
import { File } from "expo-file-system";
import {
	initDatabase,
	pendingCount,
	loadState,
	setActiveUser,
	pendingMutations,
} from "@/lib/local-database";

jest.mock("expo-sqlite", () =>
	jest.requireActual("@/testing/sqlite").sqliteBridge(),
);
jest.mock("expo-file-system", () => jest.requireActual("@/testing/filesystem").filesystemBridge());
jest.mock("@/lib/use-session-refresh", () => ({
	useSessionRefresh: jest.fn(),
}));
jest.mock("expo-sensors", () => ({
	Pedometer: { isAvailableAsync: async () => false },
}));
jest.mock("@/lib/session", () => ({
	loadTokens: jest.fn(async () => null),
	saveTokens: jest.fn(async () => {}),
	clearTokens: jest.fn(async () => {}),
	tokenClaims: () => ({ sub: "a" }),
	getBiometricStatus: jest.fn(async () => ({ enabled: false, available: true })),
	enableBiometricLogin: jest.fn(async () => {}),
	disableBiometricLogin: jest.fn(async () => {}),
	unlockBiometricSession: jest.fn(),
}));
jest.mock("@/lib/api", () => ({
	apiRequest: jest.fn(),
	publicRequest: jest.fn(),
}));
jest.mock("@react-native-community/netinfo", () => ({
	__esModule: true,
	default: {
		fetch: jest.fn(async () => ({ isConnected: false })),
		addEventListener: () => () => {},
	},
}));
let context: ReturnType<typeof useAppState>;
function Probe() {
	context = useAppState();
	return null;
}
const profile = (id = "a") => ({
	id,
	name: "Pessoa Teste",
	email: `${id}@example.com`,
	birthDate: "2000-01-01",
	weightKg: 70,
	heightCm: 170,
	gender: "Outro",
	avatarUrl: null,
});
const loginResult = (id = "a") => ({
	profile: profile(id),
	tokens: { accessToken: "access", refreshToken: "refresh", expiresIn: 900 },
});
const emptyPull = {
	water: [],
	meals: [],
	activities: [],
	weights: [],
	steps: [],
	profile: null,
	goals: null,
	cursor: "2026-10-03T12:00:00Z",
};
beforeEach(async () => {
	jest.clearAllMocks();
	(apiRequest as jest.Mock).mockReset();
	jest.requireMock("expo-file-system").__reset();
	await initDatabase();
	const db = await SQLite.openDatabaseAsync("test");
	await db.execAsync(
		"DELETE FROM kv; DELETE FROM outbox_v2; DELETE FROM outbox;",
	);
	setActiveUser(null);
	(loadTokens as jest.Mock).mockResolvedValue(null);
	(getBiometricStatus as jest.Mock).mockResolvedValue({ enabled: false, available: true });
	(NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: false });
	(publicRequest as jest.Mock).mockResolvedValue(loginResult());
});
async function mount() {
	const view = render(
		<AppStateProvider>
			<Probe />
		</AppStateProvider>,
	);
	await waitFor(() => expect(context.loading).toBe(false));
	return view;
}
test("biometria só restaura a conta offline após confirmação", async () => {
	let view = await mount();
	await act(async () => context.login("a@example.com", "12345678"));
	await act(async () => context.dispatch({
		type: "WATER_ADD", value: { amountMl: 350, date: "2026-10-03", time: "08:00" },
	}));
	view.unmount();
	(getBiometricStatus as jest.Mock).mockResolvedValue({ enabled: true, available: true });
	view = await mount();
	expect(context.state.authenticated).toBe(false);
	expect(context.state.water).toHaveLength(0);
	(unlockBiometricSession as jest.Mock).mockRejectedValueOnce(new Error("Cancelado"));
	await act(async () => {
		await expect(context.loginWithBiometrics()).rejects.toThrow("Cancelado");
	});
	expect(context.state.authenticated).toBe(false);
	(unlockBiometricSession as jest.Mock).mockResolvedValue(loginResult().tokens);
	(loadTokens as jest.Mock).mockResolvedValue(loginResult().tokens);
	await act(async () => context.loginWithBiometrics());
	expect(context.state.authenticated).toBe(true);
	expect(context.state.water[0].amountMl).toBe(350);
	view.unmount();
});
test("biometria com sessão revogada retorna ao login por senha", async () => {
	const view = await mount();
	(unlockBiometricSession as jest.Mock).mockResolvedValue(loginResult().tokens);
	(loadTokens as jest.Mock).mockResolvedValue(null);
	await act(async () => {
		await expect(context.loginWithBiometrics()).rejects.toThrow("sessão expirou");
	});
	expect(context.state.authenticated).toBe(false);
	view.unmount();
});
test("registros offline sobrevivem logout, troca de conta e reinício", async () => {
	let view = await mount();
	await act(async () => context.login("a@example.com", "12345678"));
	await act(async () =>
		context.dispatch({
			type: "WATER_ADD",
			value: { amountMl: 500, date: "2026-10-03", time: "08:00" },
		}),
	);
	expect(await pendingCount("a")).toBe(1);
	await act(async () => context.logout());
	(publicRequest as jest.Mock).mockResolvedValue(loginResult("b"));
	await act(async () =>
		context.register("Outra", "b@example.com", "12345678", "12345678"),
	);
	expect(context.state.water).toHaveLength(0);
	expect(await pendingCount("a")).toBe(1);
	await act(async () => context.logout());
	view.unmount();
	(loadTokens as jest.Mock).mockResolvedValue(loginResult().tokens);
	view = await mount();
	expect(context.state.water[0].amountMl).toBe(500);
	expect(context.state.authenticated).toBe(true);
	view.unmount();
});
test("pull em andamento preserva uma alteração local posterior ao push", async () => {
	const view = await mount();
	await act(async () => context.login("a@example.com", "12345678"));
	(NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });
	let deliver: (value: unknown) => void = () => {};
	(apiRequest as jest.Mock).mockImplementation(
		() =>
			new Promise((resolve) => {
				deliver = resolve;
			}),
	);
	let flight: Promise<void>;
	await act(async () => {
		flight = context.syncNow();
	});
	await waitFor(() => expect(apiRequest).toHaveBeenCalled());
	await act(async () =>
		context.dispatch({
			type: "WATER_ADD",
			value: { amountMl: 200, date: "2026-10-03", time: "09:00" },
		}),
	);
	await act(async () => {
		deliver({ ...emptyPull, water: [] });
		await flight;
	});
	expect(context.state.water).toHaveLength(1);
	expect(await pendingCount("a")).toBe(1);
	expect((await loadState("a"))?.water).toHaveLength(1);
	view.unmount();
});
test("operações locais concorrentes acumulam os deltas de passos", async () => {
	const view = await mount();
	await act(async () => context.login("a@example.com", "12345678"));
	await act(async () => {
		await Promise.all([
			context.dispatch({
				type: "STEPS_INCREMENT",
				date: "2026-10-03",
				value: 10,
			}),
			context.dispatch({
				type: "STEPS_INCREMENT",
				date: "2026-10-03",
				value: 15,
			}),
		]);
	});
	expect(context.state.dailySteps).toEqual([{ date: "2026-10-03", steps: 25 }]);
	expect(await pendingCount("a")).toBe(2);
	view.unmount();
});

test("cache offline permanece após 24 horas com relógio controlado", async () => {
	jest.useFakeTimers();
	jest.setSystemTime(new Date("2026-10-03T12:00:00Z"));
	let view = await mount();
	await act(async () => context.login("a@example.com", "12345678"));
	await act(async () =>
		context.dispatch({
			type: "WATER_ADD",
			value: { amountMl: 500, date: "2026-10-03", time: "09:00" },
		}),
	);
	view.unmount();
	jest.advanceTimersByTime(86_400_000);
	(loadTokens as jest.Mock).mockResolvedValue(loginResult().tokens);
	view = await mount();
	expect(context.state.water).toHaveLength(1);
	expect(await pendingCount("a")).toBe(1);
	expect(apiRequest).not.toHaveBeenCalled();
	view.unmount();
	jest.useRealTimers();
});

test("peso pendente preserva o IMC ao receber um perfil remoto antigo", async () => {
	const view = await mount();
	await act(async () => context.login("a@example.com", "12345678"));
	(NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });
	let deliver: (value: unknown) => void = () => {};
	(apiRequest as jest.Mock).mockImplementation(
		() =>
			new Promise((resolve) => {
				deliver = resolve;
			}),
	);
	let flight: Promise<void>;
	await act(async () => {
		flight = context.syncNow();
	});
	await waitFor(() => expect(apiRequest).toHaveBeenCalled());
	await act(async () =>
		context.dispatch({
			type: "WEIGHT_ADD",
			value: { date: "2026-10-03", weightKg: 69.5 },
		}),
	);
	await act(async () => {
		deliver({ ...emptyPull, profile: { weightKg: 70, heightCm: 170 } });
		await flight;
	});
	expect(context.state.profile.weightKg).toBe(69.5);
	expect(await pendingCount("a")).toBe(1);
	view.unmount();
});
test("virada do dia zera apenas o total atual e preserva o histórico", async () => {
	jest.useFakeTimers();
	jest.setSystemTime(new Date("2026-10-03T12:00:00Z"));
	const view = await mount();
	await act(async () => context.login("a@example.com", "12345678"));
	await act(async () =>
		context.dispatch({
			type: "STEPS_INCREMENT",
			date: "2026-10-03",
			value: 500,
		}),
	);
	jest.setSystemTime(new Date("2026-10-04T12:00:00Z"));
	await act(async () => {
		jest.advanceTimersByTime(60_000);
	});
	expect(context.state.steps).toBe(0);
	expect(context.state.dailySteps).toEqual([
		{ date: "2026-10-03", steps: 500 },
	]);
	view.unmount();
	jest.useRealTimers();
});

test("foto offline sobrevive reinício, sincroniza pela fila e conserva cópia local", async () => {
 let view = await mount();
 await act(async () => context.login("a@example.com", "12345678"));
 await act(async () => context.uploadAvatar("file://picked.jpg"));
 const localUri = context.state.profile.avatar;
 expect(localUri).toMatch(/^file:\/\/\/documents\/avatars\/a\//);
 expect(apiRequest).not.toHaveBeenCalled();
 const [job] = await pendingMutations(100, "a");
 expect(job.entity).toBe("avatar");
 expect((await loadState("a"))?.profile.avatar).toBe(localUri);
 view.unmount();
 (loadTokens as jest.Mock).mockResolvedValue(loginResult().tokens);
 view = await mount();
 expect(context.state.profile.avatar).toBe(localUri);
 (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });
 const remote = "https://qa.example/avatar-a.jpg";
 (apiRequest as jest.Mock).mockImplementation(async (path) => path === "/v1/profile/avatar"
  ? { ...profile(), avatarUrl: remote }
  : { ...emptyPull, profile: { ...profile(), avatarUrl: remote } });
 await act(async () => context.syncNow());
 expect((apiRequest as jest.Mock).mock.calls[0][1].headers["Idempotency-Key"]).toBe(job.mutationId);
 expect(await pendingCount("a")).toBe(0);
 expect(context.state.profile.avatar).toBe(localUri);
 expect(context.state.profile.avatarRemoteUrl).toBe(remote);
 expect(new File(localUri!).exists).toBe(true);
 view.unmount();
});
test("foto pendente permanece por conta no logout e novo login", async () => {
 const view = await mount();
 await act(async () => context.login("a@example.com", "12345678"));
 await act(async () => context.uploadAvatar("file://picked.jpg"));
 const localUri = context.state.profile.avatar;
 await act(async () => context.logout());
 (publicRequest as jest.Mock).mockResolvedValue(loginResult("b"));
 await act(async () => context.login("b@example.com", "12345678"));
 expect(context.state.profile.avatar).toBeUndefined();
 expect(await pendingCount("a")).toBe(1);
 await act(async () => context.logout());
 (publicRequest as jest.Mock).mockResolvedValue(loginResult());
 await act(async () => context.login("a@example.com", "12345678"));
 expect(context.state.profile.avatar).toBe(localUri);
 view.unmount();
});
test("rollback de snapshot/fila remove a cópia órfã sem exibir sucesso", async () => {
 const view = await mount();
 await act(async () => context.login("a@example.com", "12345678"));
 const db = await SQLite.openDatabaseAsync("test");
 await db.execAsync("CREATE TEMP TRIGGER fail_avatar BEFORE INSERT ON outbox_v2 BEGIN SELECT RAISE(ABORT, 'disk full'); END;");
 try {
  await act(async () => { await expect(context.uploadAvatar("file://picked.jpg")).rejects.toThrow("disk full"); });
  expect(context.state.profile.avatar).toBeUndefined();
  expect((await loadState("a"))?.profile.avatar).toBeUndefined();
  expect(await pendingCount("a")).toBe(0);
  expect([...jest.requireMock("expo-file-system").__files.keys()].filter((p: string) => p.includes("/avatars/"))).toEqual([]);
 } finally { await db.execAsync("DROP TRIGGER fail_avatar;"); view.unmount(); }
});
test("cópia falha e imagem inválida não geram alteração ou fila", async () => {
 const view = await mount();
 await act(async () => context.login("a@example.com", "12345678"));
 const spy = jest.spyOn(File.prototype, "copy").mockImplementationOnce(() => { throw new Error("Falha de cópia"); });
 await act(async () => { await expect(context.uploadAvatar("file://picked.jpg")).rejects.toThrow("Falha de cópia"); });
 spy.mockRestore();
 await act(async () => { await expect(context.uploadAvatar("file://picked.jpg", "image/gif")).rejects.toThrow("JPEG"); });
 jest.requireMock("expo-file-system").__files.set("file://picked.jpg", 5 * 1024 * 1024 + 1);
 await act(async () => { await expect(context.uploadAvatar("file://picked.jpg")).rejects.toThrow("5 MB"); });
 expect(await pendingCount("a")).toBe(0);
 expect(context.state.profile.avatar).toBeUndefined();
 view.unmount();
});
test("perda da resposta mantém ID/foto para retry e single flight", async () => {
 const view = await mount();
 await act(async () => context.login("a@example.com", "12345678"));
 await act(async () => context.uploadAvatar("file://picked.jpg"));
 const [job] = await pendingMutations(100, "a");
 (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });
 (apiRequest as jest.Mock).mockRejectedValueOnce(new Error("Resposta perdida"));
 await act(async () => context.syncNow());
 expect(await pendingCount("a")).toBe(1);
 (apiRequest as jest.Mock).mockImplementation(async (path) => path === "/v1/profile/avatar" ? { ...profile(), avatarUrl: "https://qa/avatar.jpg" } : emptyPull);
 await act(async () => { await Promise.all([context.syncNow(), context.syncNow()]); });
 const uploads = (apiRequest as jest.Mock).mock.calls.filter(([path]) => path === "/v1/profile/avatar");
 expect(uploads).toHaveLength(2);
 expect(uploads.map(([, init]) => init.headers["Idempotency-Key"])).toEqual([job.mutationId, job.mutationId]);
 expect(await pendingCount("a")).toBe(0);
 view.unmount();
});
test("resposta de foto antiga não substitui seleção mais recente", async () => {
 const view = await mount();
 await act(async () => context.login("a@example.com", "12345678"));
 await act(async () => context.uploadAvatar("file://picked.jpg"));
 const firstUri = context.state.profile.avatar;
 let release!: (value: unknown) => void;
 const reply = new Promise((resolve) => { release = resolve; });
 (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });
 (apiRequest as jest.Mock).mockImplementation(async (path) => path === "/v1/profile/avatar" ? reply : emptyPull);
 let syncing!: Promise<void>;
 await act(async () => { syncing = context.syncNow(); });
 await waitFor(() => expect(apiRequest).toHaveBeenCalled());
 await act(async () => context.uploadAvatar("file://second.jpg"));
 const secondUri = context.state.profile.avatar;
 expect(new File(firstUri!).exists).toBe(true);
 (apiRequest as jest.Mock).mockImplementation(async (path) => path === "/v1/profile/avatar" ? { ...profile(), avatarUrl: "https://qa/second.jpg" } : { ...emptyPull, profile: { ...profile(), avatarUrl: "https://qa/second.jpg" } });
 await act(async () => { release({ ...profile(), avatarUrl: "https://qa/first.jpg" }); await syncing; });
 expect(context.state.profile.avatar).toBe(secondUri);
 expect(context.state.profile.avatarRemoteUrl).toBe("https://qa/second.jpg");
 expect(new File(firstUri!).exists).toBe(false);
 expect(new File(secondUri!).exists).toBe(true);
 view.unmount();
});
test("resposta de upload após logout não altera outra conta nem apaga sua fila", async () => {
 const view = await mount();
 await act(async () => context.login("a@example.com", "12345678"));
 await act(async () => context.uploadAvatar("file://picked.jpg"));
 let release!: (value: unknown) => void;
 const reply = new Promise((resolve) => { release = resolve; });
 (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });
 (apiRequest as jest.Mock).mockImplementation(() => reply);
 let syncing!: Promise<void>;
 await act(async () => { syncing = context.syncNow(); });
 await waitFor(() => expect(apiRequest).toHaveBeenCalled());
 await act(async () => context.logout());
 (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: false });
 (publicRequest as jest.Mock).mockResolvedValue(loginResult("b"));
 await act(async () => context.login("b@example.com", "12345678"));
 await act(async () => { release({ ...profile(), avatarUrl: "https://qa/a.jpg" }); await syncing; });
 expect(context.state.userId).toBe("b");
 expect(context.state.profile.avatar).toBeUndefined();
 expect(await pendingCount("a")).toBe(1);
 view.unmount();
});

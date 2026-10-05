import { act, render, waitFor } from "@testing-library/react-native";
import * as SQLite from "expo-sqlite";
import NetInfo from "@react-native-community/netinfo";
import { AppStateProvider, useAppState } from "@/state/app-state";
import { apiRequest, publicRequest } from "@/lib/api";
import { getBiometricStatus, loadTokens, unlockBiometricSession } from "@/lib/session";
import {
	initDatabase,
	pendingCount,
	loadState,
	setActiveUser,
} from "@/lib/local-database";

jest.mock("expo-sqlite", () =>
	jest.requireActual("@/testing/sqlite").sqliteBridge(),
);
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
test("RNF3/US-016: troca de foto offline deve ser salva e enfileirada", async () => {
  const view = await mount();
  await act(async () => { await context.login("a@example.com", "senha-qa"); });
  (apiRequest as jest.Mock).mockRejectedValue(new Error("Offline"));
  const queuedBefore = await pendingCount("a");
  await act(async () => {
    await expect(context.uploadAvatar("file:///qa/profile.png", "image/png")).resolves.toBeUndefined();
  });
  expect(context.state.profile.avatar).toBeTruthy();
  expect(await pendingCount("a")).toBeGreaterThan(queuedBefore);
  view.unmount();
});

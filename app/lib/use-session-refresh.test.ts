import { act, renderHook } from "@testing-library/react-native";
import { AppState, type AppStateStatus } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { useSessionRefresh } from "./use-session-refresh";
import { ensureFreshSession } from "./api";
import { loadTokens, onSessionChange, sessionExpiresAt } from "./session";
jest.mock("./api", () => ({ ensureFreshSession: jest.fn(async () => {}) }));
jest.mock("./session", () => ({
	loadTokens: jest.fn(async () => ({})),
	onSessionChange: jest.fn(() => jest.fn()),
	sessionExpiresAt: jest.fn(),
}));
jest.mock("@react-native-community/netinfo", () => ({
	__esModule: true,
	default: { fetch: jest.fn(async () => ({ isConnected: true })) },
}));
beforeEach(() => {
	jest.useFakeTimers();
	jest.clearAllMocks();
	(sessionExpiresAt as jest.Mock).mockReturnValue(Date.now() + 90_000);
	(NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });
});
afterEach(() => jest.useRealTimers());
const flush = async () =>
	act(async () => {
		await Promise.resolve();
		await Promise.resolve();
	});
test("renova ao abrir, antes de expirar e ao retornar ao primeiro plano", async () => {
	let foreground: (s: AppStateStatus) => void = () => {};
	const remove = jest.fn();
	jest
		.spyOn(AppState, "addEventListener")
		.mockImplementation((_event, callback) => {
			foreground = callback;
			return { remove };
		});
	const invalidate = jest.fn();
	const view = renderHook(() => useSessionRefresh(true, invalidate));
	await flush();
	expect(ensureFreshSession).toHaveBeenCalledTimes(1);
	await act(async () => jest.advanceTimersByTime(30_000));
	expect(ensureFreshSession).toHaveBeenCalledTimes(2);
	await act(async () => foreground("active"));
	expect(ensureFreshSession).toHaveBeenCalledTimes(3);
	const listener = (onSessionChange as jest.Mock).mock.calls[0][0];
	act(() => listener(false));
	expect(invalidate).toHaveBeenCalledTimes(1);
	view.unmount();
	expect(remove).toHaveBeenCalled();
});
test("sem rede mantém sessão e tenta novamente após 30 segundos", async () => {
	(NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: false });
	const view = renderHook(() => useSessionRefresh(true, jest.fn()));
	await flush();
	expect(ensureFreshSession).not.toHaveBeenCalled();
	(NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });
	await act(async () => jest.advanceTimersByTime(30_000));
	expect(ensureFreshSession).toHaveBeenCalledTimes(1);
	view.unmount();
});
test("sessão ausente não agenda renovação", () => {
	const view = renderHook(() => useSessionRefresh(false, jest.fn()));
	expect(loadTokens).not.toHaveBeenCalled();
	view.unmount();
});

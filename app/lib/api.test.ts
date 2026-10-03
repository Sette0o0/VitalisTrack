import * as SecureStore from "expo-secure-store";
import { apiRequest, ensureFreshSession, refreshAccessToken } from "./api";
import { clearTokens, loadTokens, saveTokens, tokenClaims } from "./session";

const jwt = (exp: number) =>
	`header.${btoa(JSON.stringify({ exp, sub: "user-a" }))}.signature`;
const tokens = (seconds = 900) => ({
	accessToken: jwt(Math.floor(Date.now() / 1000) + seconds),
	refreshToken: "refresh-a",
	expiresIn: seconds,
});
const response = (data: unknown, status = 200) =>
	({
		ok: status < 400,
		status,
		json: async () =>
			status < 400
				? { data }
				: {
						error: {
							code: "INVALID_REFRESH_TOKEN",
							message: "Sessão inválida",
						},
					},
	}) as Response;

beforeEach(async () => {
	jest.clearAllMocks();
	jest.spyOn(SecureStore, "getItemAsync").mockResolvedValue(null);
	jest.spyOn(SecureStore, "setItemAsync").mockResolvedValue();
	jest.spyOn(SecureStore, "deleteItemAsync").mockResolvedValue();
	await clearTokens();
	globalThis.fetch = jest.fn();
});

test("lê claims e tolera token incompleto", () => {
	expect(tokenClaims(tokens().accessToken).sub).toBe("user-a");
	expect(tokenClaims("invalid")).toEqual({});
});
test("persiste o par de tokens numa única escrita segura", async () => {
	const value = tokens();
	await saveTokens(value);
	expect(await loadTokens()).toEqual(value);
	expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
});
test("não renova uma sessão ainda válida", async () => {
	await saveTokens(tokens());
	await ensureFreshSession();
	expect(fetch).not.toHaveBeenCalled();
});
test("renova antecipadamente e compartilha requisições concorrentes", async () => {
	await saveTokens(tokens(30));
	(fetch as jest.Mock).mockResolvedValue(
		response({ ...tokens(), refreshToken: "rotated" }),
	);
	await Promise.all([ensureFreshSession(), ensureFreshSession()]);
	expect(fetch).toHaveBeenCalledTimes(1);
	expect((await loadTokens())?.refreshToken).toBe("rotated");
});
test("falha de rede preserva a sessão offline", async () => {
	const value = tokens();
	await saveTokens(value);
	(fetch as jest.Mock).mockRejectedValue(
		new TypeError("Network request failed"),
	);
	await expect(refreshAccessToken()).rejects.toThrow("Network");
	expect(await loadTokens()).toEqual(value);
});
test("refresh definitivamente inválido revoga a sessão", async () => {
	await saveTokens(tokens());
	(fetch as jest.Mock).mockResolvedValue(response(null, 401));
	await expect(refreshAccessToken()).rejects.toMatchObject({ status: 401 });
	expect(await loadTokens()).toBeNull();
});
test("anexa Bearer, retorna dados e suporta 204", async () => {
	await saveTokens(tokens());
	(fetch as jest.Mock)
		.mockResolvedValueOnce(response({ water: 500 }))
		.mockResolvedValueOnce(response(null, 204));
	expect(await apiRequest("/v1/dashboard/daily")).toEqual({ water: 500 });
	expect(
		(fetch as jest.Mock).mock.calls[0][1].headers.get("authorization"),
	).toContain("Bearer ");
	expect(
		await apiRequest("/v1/auth/logout", { method: "POST" }),
	).toBeUndefined();
});
test("repete apenas uma vez após 401", async () => {
	await saveTokens(tokens());
	(fetch as jest.Mock)
		.mockResolvedValueOnce(response(null, 401))
		.mockResolvedValueOnce(
			response({ ...tokens(1200), refreshToken: "rotated" }),
		)
		.mockResolvedValueOnce(response({ ok: true }));
	expect(await apiRequest("/v1/profile")).toEqual({ ok: true });
	expect(fetch).toHaveBeenCalledTimes(3);
});

test("troca de conta bloqueia uma requisição com dados do dono anterior", async () => {
	await saveTokens(tokens());
	await expect(
		apiRequest("/v1/sync", {}, true, "user-b"),
	).rejects.toMatchObject({ code: "STALE_SESSION" });
	expect(fetch).not.toHaveBeenCalled();
});
test("erro transitório do servidor preserva os tokens", async () => {
	const old = tokens();
	await saveTokens(old);
	(fetch as jest.Mock).mockResolvedValue(response(null, 503));
	await expect(refreshAccessToken()).rejects.toMatchObject({ status: 503 });
	expect(await loadTokens()).toEqual(old);
});
test("resposta de refresh antiga não sobrescreve uma sessão nova", async () => {
	await saveTokens(tokens());
	let release: (value: Response) => void = () => {};
	(fetch as jest.Mock).mockImplementation(
		() =>
			new Promise((resolve) => {
				release = resolve;
			}),
	);
	const request = refreshAccessToken();
	await new Promise((resolve) => setTimeout(resolve, 0));
	const next = { ...tokens(), refreshToken: "new-account" };
	await saveTokens(next);
	release(response({ ...tokens(), refreshToken: "old-rotation" }));
	await expect(request).rejects.toMatchObject({ code: "STALE_SESSION" });
	expect(await loadTokens()).toEqual(next);
});

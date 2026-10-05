import type { AuthTokens } from "@vitalis/contracts";

jest.mock("react-native", () => ({ Platform: { OS: "android" } }));
jest.mock("expo-secure-store", () => ({
	getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn(),
	canUseBiometricAuthentication: jest.fn(() => true),
}));
let session: typeof import("./session");
let secure: typeof import("expo-secure-store");
let storage: Map<string, string>;
const tokens = (owner = "a"): AuthTokens => ({
	accessToken: `header.${btoa(JSON.stringify({ sub: owner, exp: 9999999999 }))}.signature`,
	refreshToken: `refresh-${owner}`, expiresIn: 900,
});
const boot = () => {
	jest.isolateModules(() => { session = jest.requireActual("./session"); });
};
beforeEach(() => {
	secure = jest.requireMock("expo-secure-store");
	storage = new Map();
	jest.clearAllMocks();
	(secure.canUseBiometricAuthentication as jest.Mock).mockReturnValue(true);
	(secure.getItemAsync as jest.Mock).mockImplementation(async (key) => storage.get(key) ?? null);
	(secure.setItemAsync as jest.Mock).mockImplementation(async (key, value) => { storage.set(key, value); });
	(secure.deleteItemAsync as jest.Mock).mockImplementation(async (key) => { storage.delete(key); });
	boot();
});
async function enroll() {
	await session.saveTokens(tokens());
	await session.enableBiometricLogin();
}
test("ativa apenas após login e usa armazenamento com confirmação biométrica", async () => {
	await expect(session.enableBiometricLogin()).rejects.toThrow("Entre com e-mail");
	await enroll();
	expect(secure.setItemAsync).toHaveBeenCalledWith("vitalis.biometric-proof", "a", expect.objectContaining({ requireAuthentication: true }));
	expect(await session.getBiometricStatus()).toEqual({ enabled: true, available: true });
});
test("início bloqueado não lê tokens até a digital ser confirmada", async () => {
	await enroll();
	boot();
	jest.clearAllMocks();
	expect(await session.loadTokens()).toBeNull();
	expect(secure.getItemAsync).not.toHaveBeenCalledWith("vitalis.session-v2");
	expect(await session.unlockBiometricSession()).toEqual(tokens());
	expect(secure.getItemAsync).toHaveBeenCalledWith("vitalis.biometric-proof", expect.objectContaining({ requireAuthentication: true }));
});
test("cancelar não libera a sessão nem apaga a opção de tentar novamente", async () => {
	await enroll();
	boot();
	(secure.getItemAsync as jest.Mock).mockImplementation(async (key) => {
		if (key === "vitalis.biometric-proof") throw new Error("User canceled");
		return storage.get(key) ?? null;
	});
	await expect(session.unlockBiometricSession()).rejects.toThrow("não confirmada");
	expect(await session.loadTokens()).toBeNull();
	expect((await session.getBiometricStatus()).enabled).toBe(true);
});
test("alteração da digital invalida o acesso e exige senha", async () => {
	await enroll();
	boot();
	storage.delete("vitalis.biometric-proof");
	await expect(session.unlockBiometricSession()).rejects.toThrow("biometria mudou");
	expect(await session.loadTokens()).toBeNull();
	expect((await session.getBiometricStatus()).enabled).toBe(false);
});
test("renovação da sessão não solicita nova digital", async () => {
	await enroll();
	const rotated = { ...tokens(), refreshToken: "rotated" };
	jest.clearAllMocks();
	await session.saveTokens(rotated);
	expect(await session.loadTokens()).toEqual(rotated);
	expect(secure.setItemAsync).toHaveBeenCalledTimes(1);
	expect(secure.getItemAsync).not.toHaveBeenCalledWith("vitalis.biometric-proof", expect.anything());
});
test("senha pode recuperar a mesma conta e troca de conta remove a biometria anterior", async () => {
	await enroll();
	boot();
	await session.saveTokens(tokens());
	expect(await session.loadTokens()).toEqual(tokens());
	expect((await session.getBiometricStatus()).enabled).toBe(true);
	await session.saveTokens(tokens("b"));
	expect((await session.getBiometricStatus()).enabled).toBe(false);
	expect(storage.has("vitalis.biometric-proof")).toBe(false);
});
test("logout elimina tokens e acesso biométrico", async () => {
	await enroll();
	await session.clearTokens();
	boot();
	expect(await session.loadTokens()).toBeNull();
	expect(storage.size).toBe(0);
});
test("sem digital cadastrada não habilita o recurso", async () => {
	await session.saveTokens(tokens());
	(secure.canUseBiometricAuthentication as jest.Mock).mockReturnValue(false);
	await expect(session.enableBiometricLogin()).rejects.toThrow("Cadastre uma digital");
	expect((await session.getBiometricStatus()).enabled).toBe(false);
});
test("logout durante o prompt impede restauração tardia", async () => {
	await enroll();
	boot();
	let release: (value: string) => void = () => {};
	(secure.getItemAsync as jest.Mock).mockImplementation(async (key) => {
		if (key === "vitalis.biometric-proof") return new Promise<string>((resolve) => { release = resolve; });
		return storage.get(key) ?? null;
	});
	const unlock = session.unlockBiometricSession();
	await new Promise((resolve) => setTimeout(resolve, 0));
	await session.clearTokens();
	release("a");
	await expect(unlock).rejects.toThrow("sessão foi alterada");
	expect(await session.loadTokens()).toBeNull();
});

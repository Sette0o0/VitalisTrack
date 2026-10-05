import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import type { AuthTokens } from "@vitalis/contracts";

const ACCESS = "vitalis.access-token";
const REFRESH = "vitalis.refresh-token";
const SESSION = "vitalis.session-v2";
const BIOMETRIC_OWNER = "vitalis.biometric-owner";
const BIOMETRIC_PROOF = "vitalis.biometric-proof";
const biometricOptions = {
	requireAuthentication: true,
	keychainService: "vitalis.biometric",
	authenticationPrompt: "Use sua biometria para entrar no VitalisTrack",
};
let memory: AuthTokens | null = null;
let expiresAt = 0;
let biometricUnlocked = false;
let sessionVersion = 0;
let clearingSession = false;
const listeners = new Set<(authenticated: boolean) => void>();
export type BiometricStatus = { enabled: boolean; available: boolean };

export function tokenClaims(token: string): { exp?: number; sub?: string } {
	try {
		return JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
	} catch {
		return {};
	}
}
export const sessionExpiresAt = () => expiresAt;
export function onSessionChange(listener: (authenticated: boolean) => void) {
	listeners.add(listener);
	return () => { listeners.delete(listener); };
}

export async function getBiometricStatus(): Promise<BiometricStatus> {
	const owner = await SecureStore.getItemAsync(BIOMETRIC_OWNER);
	let available = false;
	try {
		available = SecureStore.canUseBiometricAuthentication();
	} catch { /* Web and devices without supported biometrics use password login. */ }
	return { enabled: Boolean(owner), available };
}

export async function disableBiometricLogin() {
	await SecureStore.deleteItemAsync(BIOMETRIC_OWNER);
	await SecureStore.deleteItemAsync(BIOMETRIC_PROOF, biometricOptions);
}

export async function enableBiometricLogin() {
	if (!(await getBiometricStatus()).available)
		throw new Error("Cadastre uma digital nas configurações de segurança do celular.");
	const tokens = await loadTokens();
	const owner = tokens && tokenClaims(tokens.accessToken).sub;
	if (!owner) throw new Error("Entre com e-mail e senha antes de ativar a biometria.");
	await SecureStore.setItemAsync(BIOMETRIC_PROOF, owner, biometricOptions);
	// iOS authenticates on reading a new entry; Android already prompts on writing it.
	if (Platform.OS === "ios" && await SecureStore.getItemAsync(BIOMETRIC_PROOF, biometricOptions) !== owner)
		throw new Error("Não foi possível confirmar a biometria.");
	await SecureStore.setItemAsync(BIOMETRIC_OWNER, owner);
	biometricUnlocked = true;
}

export async function saveTokens(tokens: AuthTokens) {
	const biometricOwner = await SecureStore.getItemAsync(BIOMETRIC_OWNER);
	if (biometricOwner && biometricOwner !== tokenClaims(tokens.accessToken).sub)
		await disableBiometricLogin();
	const expiration = tokenClaims(tokens.accessToken).exp;
	const nextExpiry = expiration ? expiration * 1000 : Date.now() + tokens.expiresIn * 1000;
	await SecureStore.setItemAsync(SESSION, JSON.stringify({ tokens, expiresAt: nextExpiry }));
	memory = tokens;
	biometricUnlocked = true; // A verified password login or refresh has accepted this session.
	expiresAt = nextExpiry;
	listeners.forEach((listener) => listener(true));
}

export async function loadTokens(): Promise<AuthTokens | null> {
	if (clearingSession) return null;
	const version = sessionVersion;
	if (memory) return memory;
	// Neither startup nor background refresh can bypass the biometric login screen.
	if (!biometricUnlocked && await SecureStore.getItemAsync(BIOMETRIC_OWNER)) return null;
	const saved = await SecureStore.getItemAsync(SESSION);
	if (version !== sessionVersion || clearingSession) return null;
	if (saved) {
		try {
			const session = JSON.parse(saved);
			if (session.tokens?.accessToken && session.tokens?.refreshToken) {
				memory = session.tokens;
				expiresAt = session.expiresAt ?? 0;
				return memory;
			}
		} catch { /* Migrate or request authentication when storage is incomplete. */ }
	}
	const [accessToken, refreshToken] = await Promise.all([
		SecureStore.getItemAsync(ACCESS),
		SecureStore.getItemAsync(REFRESH),
	]);
	if (!accessToken || !refreshToken) return null;
	await saveTokens({ accessToken, refreshToken, expiresIn: 0 });
	return memory;
}

export async function unlockBiometricSession(): Promise<AuthTokens> {
	const version = sessionVersion;
	const owner = await SecureStore.getItemAsync(BIOMETRIC_OWNER);
	if (!owner || !(await getBiometricStatus()).available)
		throw new Error("Biometria indisponível. Entre com e-mail e senha.");
	let proof: string | null;
	try {
		proof = await SecureStore.getItemAsync(BIOMETRIC_PROOF, biometricOptions);
	} catch {
		throw new Error("Biometria não confirmada. Tente novamente ou entre com sua senha.");
	}
	if (sessionVersion !== version) throw new Error("A sessão foi alterada. Entre novamente.");
	if (proof !== owner) {
		await clearTokens();
		throw new Error("A biometria mudou. Entre com sua senha e ative-a novamente no Perfil.");
	}
	biometricUnlocked = true;
	const tokens = await loadTokens();
	if (version !== sessionVersion) throw new Error("A sessão foi alterada. Entre novamente.");
	if (!tokens || tokenClaims(tokens.accessToken).sub !== owner) {
		await clearTokens();
		throw new Error("Sessão indisponível. Entre com e-mail e senha.");
	}
	return tokens;
}

export async function clearTokens() {
	sessionVersion += 1;
	clearingSession = true;
	memory = null;
	biometricUnlocked = false;
	expiresAt = 0;
	listeners.forEach((listener) => listener(false));
	try {
		await Promise.all([
			SecureStore.deleteItemAsync(SESSION),
			SecureStore.deleteItemAsync(ACCESS),
			SecureStore.deleteItemAsync(REFRESH),
			disableBiometricLogin(),
		]);
	} finally {
		clearingSession = false;
	}
}

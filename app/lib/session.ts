import * as SecureStore from "expo-secure-store";
import type { AuthTokens } from "@vitalis/contracts";

const ACCESS = "vitalis.access-token";
const REFRESH = "vitalis.refresh-token";
let memory: AuthTokens | null = null;
const SESSION = "vitalis.session-v2";
let expiresAt = 0;
const listeners = new Set<(authenticated: boolean) => void>();

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

export async function saveTokens(tokens: AuthTokens) {
	const expiration = tokenClaims(tokens.accessToken).exp;
	const nextExpiry = expiration ? expiration * 1000 : Date.now() + tokens.expiresIn * 1000;
	await SecureStore.setItemAsync(SESSION, JSON.stringify({ tokens, expiresAt: nextExpiry }));
	memory = tokens;
	expiresAt = nextExpiry;
	listeners.forEach((listener) => listener(true));
}
export async function loadTokens(): Promise<AuthTokens | null> {
	if (memory) return memory;
	const saved = await SecureStore.getItemAsync(SESSION);
	if (saved) {
		try {
			const session = JSON.parse(saved);
			if (session.tokens?.accessToken && session.tokens?.refreshToken) {
				memory = session.tokens;
				expiresAt = session.expiresAt ?? 0;
				return memory;
			}
		} catch { /* migrate or request authentication when storage is incomplete */ }
	}
	const [accessToken, refreshToken] = await Promise.all([
		SecureStore.getItemAsync(ACCESS),
		SecureStore.getItemAsync(REFRESH),
	]);
	if (!accessToken || !refreshToken) return null;
	await saveTokens({ accessToken, refreshToken, expiresIn: 0 });
	return memory;
}
export async function clearTokens() {
	memory = null;
	expiresAt = 0;
	listeners.forEach((listener) => listener(false));
	await Promise.all([
		SecureStore.deleteItemAsync(SESSION),
		SecureStore.deleteItemAsync(ACCESS),
		SecureStore.deleteItemAsync(REFRESH),
	]);
}

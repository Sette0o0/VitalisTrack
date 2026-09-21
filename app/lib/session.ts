import * as SecureStore from "expo-secure-store";
import type { AuthTokens } from "@vitalis/contracts";

const ACCESS = "vitalis.access-token";
const REFRESH = "vitalis.refresh-token";
let memory: AuthTokens | null = null;

export async function saveTokens(tokens: AuthTokens) {
	memory = tokens;
	await Promise.all([
		SecureStore.setItemAsync(ACCESS, tokens.accessToken),
		SecureStore.setItemAsync(REFRESH, tokens.refreshToken),
	]);
}
export async function loadTokens(): Promise<AuthTokens | null> {
	if (memory) return memory;
	const [accessToken, refreshToken] = await Promise.all([
		SecureStore.getItemAsync(ACCESS),
		SecureStore.getItemAsync(REFRESH),
	]);
	if (!accessToken || !refreshToken) return null;
	memory = { accessToken, refreshToken, expiresIn: 0 };
	return memory;
}
export async function clearTokens() {
	memory = null;
	await Promise.all([
		SecureStore.deleteItemAsync(ACCESS),
		SecureStore.deleteItemAsync(REFRESH),
	]);
}

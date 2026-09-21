import type { ApiError, ApiResponse, AuthTokens } from "@vitalis/contracts";
import { clearTokens, loadTokens, saveTokens } from "./session";

export const API_URL =
	process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:3000";
let refreshPromise: Promise<AuthTokens> | null = null;

export class ApiClientError extends Error {
	constructor(
		public status: number,
		public code: string,
		message: string,
		public details?: unknown,
	) {
		super(message);
	}
}

async function decode<T>(response: Response): Promise<T> {
	if (response.status === 204) return undefined as T;
	const payload = (await response.json()) as ApiResponse<T> | ApiError;
	if (!response.ok || "error" in payload) {
		const error =
			"error" in payload
				? payload.error
				: {
						code: "HTTP_ERROR",
						message: "Falha na requisição",
						details: undefined,
					};
		throw new ApiClientError(
			response.status,
			error.code,
			error.message,
			error.details,
		);
	}
	return payload.data;
}

async function refreshAccessToken() {
	if (refreshPromise) return refreshPromise;
	refreshPromise = (async () => {
		const current = await loadTokens();
		if (!current) throw new ApiClientError(401, "NO_SESSION", "Sessão ausente");
		const response = await fetch(`${API_URL}/v1/auth/refresh`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ refreshToken: current.refreshToken }),
		});
		const tokens = await decode<AuthTokens>(response);
		await saveTokens(tokens);
		return tokens;
	})()
		.catch(async (error) => {
			await clearTokens();
			throw error;
		})
		.finally(() => {
			refreshPromise = null;
		});
	return refreshPromise;
}

export async function apiRequest<T>(
	path: string,
	init: RequestInit = {},
	retry = true,
): Promise<T> {
	const tokens = await loadTokens();
	const headers = new Headers(init.headers);
	if (!(init.body instanceof FormData))
		headers.set("content-type", "application/json");
	if (tokens?.accessToken)
		headers.set("authorization", `Bearer ${tokens.accessToken}`);
	const response = await fetch(`${API_URL}${path}`, { ...init, headers });
	if (response.status === 401 && retry && tokens) {
		await refreshAccessToken();
		return apiRequest<T>(path, init, false);
	}
	return decode<T>(response);
}

export const publicRequest = async <T>(path: string, body: unknown) =>
	decode<T>(
		await fetch(`${API_URL}${path}`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body),
		}),
	);

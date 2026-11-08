import { RequestFailure } from "./user-error";
import { fetch } from "expo/fetch";
import {
	deviceTimeZone,
	type ApiError,
	type ApiResponse,
	type AuthTokens,
} from "@vitalis/contracts";
import { clearTokens, loadTokens, saveTokens, sessionExpiresAt, tokenClaims } from "./session";

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:3000";
let refreshPromise: Promise<AuthTokens> | null = null;
async function timedFetch(url: string, init: RequestInit): Promise<Response> {
	const controller = new AbortController();
	let timedOut = false;
	const abort = () => controller.abort();
	init.signal?.addEventListener("abort", abort);
	const timer = setTimeout(() => { timedOut = true; abort(); }, 15_000);
	if (init.signal?.aborted) abort();
	try {
		return await fetch(url, { ...init, body: init.body ?? undefined, signal: controller.signal });
	} catch {
		throw new RequestFailure(timedOut ? "timeout" : init.signal?.aborted ? "cancelled" : "network");
	} finally {
		clearTimeout(timer);
		init.signal?.removeEventListener("abort", abort);
	}
}

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
	let payload: ApiResponse<T> | ApiError;
 try { payload = await response.json(); }
 catch {
  if (!response.ok) throw new ApiClientError(response.status,"HTTP_ERROR","Falha na requisição");
  throw new RequestFailure("response");
 }
 if (!payload || typeof payload !== "object" || (!("data" in payload) && !("error" in payload)))
  throw new RequestFailure("response");
	if (!response.ok || "error" in payload) {
		const error =
			"error" in payload
				? payload.error
				: {
						code: "HTTP_ERROR",
						message: "Falha na requisição",
						details: undefined,
					};
		throw new ApiClientError(response.status, error.code, error.message, error.details);
	}
	return payload.data;
}

export async function refreshAccessToken() {
	if (refreshPromise) return refreshPromise;
	let attemptedToken: string | undefined;
	refreshPromise = (async () => {
		const current = await loadTokens();
		if (!current) throw new ApiClientError(401, "NO_SESSION", "Sessão ausente");
		attemptedToken = current.refreshToken;
		const response = await timedFetch(`${API_URL}/v1/auth/refresh`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ refreshToken: current.refreshToken }),
		});
		const tokens = await decode<AuthTokens>(response);
		if ((await loadTokens())?.refreshToken !== current.refreshToken)
			throw new ApiClientError(401, "STALE_SESSION", "A sessão foi alterada");
		await saveTokens(tokens);
		return tokens;
	})()
		.catch(async (error) => {
			if (
				error instanceof ApiClientError &&
				error.status === 401 &&
				error.code !== "STALE_SESSION" &&
				(await loadTokens())?.refreshToken === attemptedToken
			)
				await clearTokens();
			throw error;
		})
		.finally(() => {
			refreshPromise = null;
		});
	return refreshPromise;
}

export async function ensureFreshSession() {
	const tokens = await loadTokens();
	if (tokens && sessionExpiresAt() <= Date.now() + 60_000) return refreshAccessToken();
	return tokens;
}

export async function apiResponse(
	path: string,
	init: RequestInit = {},
	retry = true,
	expectedUserId?: string,
): Promise<Response> {
	const tokens = retry ? await ensureFreshSession() : await loadTokens();
	if (expectedUserId && tokenClaims(tokens?.accessToken ?? "").sub !== expectedUserId)
		throw new ApiClientError(401, "STALE_SESSION", "A sessão foi alterada");
	const headers = new Headers(init.headers);
	headers.set("x-client-time-zone", deviceTimeZone());
	if (!(init.body instanceof FormData)) headers.set("content-type", "application/json");
	if (tokens?.accessToken) headers.set("authorization", `Bearer ${tokens.accessToken}`);
	const response = await timedFetch(`${API_URL}${path}`, { ...init, headers });
	if (response.status === 401 && retry && tokens) {
		const latest = await loadTokens();
		if (latest?.accessToken === tokens.accessToken) await refreshAccessToken();
		return apiResponse(path, init, false, expectedUserId);
	}
	if(!response.ok) await decode<unknown>(response);
 return response;
}
export async function apiRequest<T>(path:string,init:RequestInit={},retry=true,expectedUserId?:string):Promise<T>{
 return decode<T>(await apiResponse(path,init,retry,expectedUserId));
}

export const publicRequest = async <T>(path: string, body: unknown) =>
	decode<T>(
		await timedFetch(`${API_URL}${path}`, {
			method: "POST",
			headers: { "content-type": "application/json", "x-client-time-zone": deviceTimeZone() },
			body: JSON.stringify(body),
		}),
	);

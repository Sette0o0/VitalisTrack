import { AppState as Lifecycle, useColorScheme } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { Pedometer } from "expo-sensors";
import {
	createContext,
	PropsWithChildren,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type {
	AuthTokens,
	Profile as ApiProfile,
	SyncPull,
	SyncResult,
} from "@vitalis/contracts";
import { apiRequest, publicRequest } from "@/lib/api";
import { calculateActivityCalories, isoDate, newId } from "@/lib/health";
import {
	getValue,
	initDatabase,
	loadState,
	loadLegacyState,
	markAttempt,
	migrateLegacyAccount,
	pendingCount,
	pendingMutations,
	removeMutations,
	saveState,
	setActiveUser,
	setValue,
} from "@/lib/local-database";
import {
	clearTokens,
	disableBiometricLogin,
	enableBiometricLogin,
	getBiometricStatus,
	loadTokens,
	saveTokens,
	tokenClaims,
	unlockBiometricSession,
	type BiometricStatus,
} from "@/lib/session";
import { useSessionRefresh } from "@/lib/use-session-refresh";
import { drainOutbox, mergeRows } from "@/lib/sync";
import { orderedBatch } from "@/lib/sync";
import { cleanupAvatarFiles, persistAvatar, reconcileAvatar } from "@/lib/avatar-files";
import { appReducer, initialState, type Action } from "./reducer";
import { mutationFor } from "./mutations";
import { migrateState } from "./migration";
import type { Activity, AppState, Period, Profile } from "./types";
import { selectDailySummary, selectProgressSummary } from "./selectors";
export { appReducer, initialState } from "./reducer";
export type { Action } from "./reducer";

type AuthResult = { profile: ApiProfile; tokens: AuthTokens };
const localProfile = (profile: ApiProfile): Profile => ({
	name: profile.name,
	email: profile.email,
	hasWeight: profile.weightKg != null,
	hasHeight: profile.heightCm != null,
	birthDate: profile.birthDate ?? "",
	weightKg: profile.weightKg ?? 70,
	heightCm: profile.heightCm ?? 170,
	gender: profile.gender ?? "Outro",
	avatar: profile.avatarUrl ?? undefined,
	avatarRemoteUrl: profile.avatarUrl ?? undefined,
});
type ContextValue = {
	state: AppState;
	dispatch: (action: Action) => Promise<void>;
	loading: boolean;
	lastError: string | null;
	addActivity: (value: Omit<Activity, "id" | "calories">) => Promise<void>;
	login: (email: string, password: string) => Promise<void>;
	biometrics: BiometricStatus;
	loginWithBiometrics: () => Promise<void>;
	setBiometricLogin: (enabled: boolean) => Promise<void>;
	register: (
		name: string,
		email: string,
		password: string,
		passwordConfirmation: string,
	) => Promise<void>;
	logout: () => Promise<void>;
	syncNow: () => Promise<void>;
	uploadAvatar: (uri: string, mimeType?: string) => Promise<void>;
};
const AppContext = createContext<ContextValue | null>(null);

export function AppStateProvider({ children }: PropsWithChildren) {
	const [state, setState] = useState(initialState),
		[loading, setLoading] = useState(true),
		[lastError, setLastError] = useState<string | null>(null);
	const systemScheme = useColorScheme();
	const [biometrics, setBiometrics] = useState<BiometricStatus>({
		enabled: false,
		available: false,
	});
	const stateRef = useRef(state);
	const writes = useRef<Promise<void>>(Promise.resolve());
	const flight = useRef<Promise<void> | null>(null);
	const flightOwner = useRef<string | undefined>(undefined);
	const inFlightAvatars = useRef(new Set<string>());
	const cleanupAvatars = useCallback(async (owner: string) => {
		try {
			const stored = await loadState(owner);
			const pending = await pendingMutations(1_000_000, owner);
			const references = new Set(inFlightAvatars.current);
			if (stored?.profile.avatar) references.add(stored.profile.avatar);
			for (const row of pending) if (row.entity === "avatar") references.add(row.payload.uri);
			cleanupAvatarFiles(owner, references);
		} catch { /* A failed cleanup must never roll back a saved photo. */ }
	}, []);
	const syncRef = useRef<() => Promise<void>>(async () => {});
	const syncTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined,
	);
	const invalidateSession = useCallback(() => {
		const next = { ...stateRef.current, authenticated: false };
		stateRef.current = next;
		setState(next);
	}, []);
	useSessionRefresh(state.authenticated, invalidateSession);
	const commit = useCallback(
		(
			updater: (previous: AppState) => AppState | Promise<AppState>,
			action?: Action,
		) => {
			const operation = writes.current.then(async () => {
				const previous = stateRef.current,
					updated = await updater(previous);
				const mutation =
					action && updated.authenticated ? mutationFor(action, updated) : null;
				const next = mutation
					? {
							...updated,
							syncStatus:
								updated.syncStatus === "offline"
									? ("offline" as const)
									: ("pending" as const),
						}
					: updated;
				if (next === previous) return;
				await saveState(next, mutation);
				const applied =
					previous.authenticated && !stateRef.current.authenticated
						? { ...next, authenticated: false }
						: next;
				stateRef.current = applied;
				setState(applied);
			});
			writes.current = operation.catch((error) =>
				setLastError(
					error instanceof Error ? error.message : "Falha ao salvar os dados.",
				),
			);
			return operation;
		},
		[],
	);
	const scheduleSync = useCallback(() => {
		clearTimeout(syncTimer.current);
		syncTimer.current = setTimeout(() => void syncRef.current(), 750);
	}, []);
	const dispatch = useCallback(
		async (action: Action) => {
			const owner = stateRef.current.userId;
			await commit(
				(previous) =>
					previous.userId !== owner ? previous : appReducer(previous, action),
				action,
			);
			if (mutationFor(action, stateRef.current)) scheduleSync();
		},
		[commit, scheduleSync],
	);
	const syncNow = useCallback(() => {
		const owner = stateRef.current.userId;
		if (flight.current) return flightOwner.current === owner ? flight.current : Promise.resolve();
		if (!owner || !stateRef.current.authenticated) return Promise.resolve();
		const active = () =>
			stateRef.current.userId === owner && stateRef.current.authenticated;
		const run = (async () => {
			const network = await NetInfo.fetch();
			if (!network.isConnected || network.isInternetReachable === false) {
				if (active()) await commit((x) => ({ ...x, syncStatus: "offline" }));
				return;
			}
			if (!active()) return;
			await commit((x) => ({ ...x, syncStatus: "syncing" }));
			try {
				await writes.current;
				await drainOutbox({
					read: async () => {
						await writes.current;
						return active() ? orderedBatch(await pendingMutations(100, owner)) : [];
					},
					push: async (mutations) => {
						const first = mutations[0];
						if (first?.entity === "avatar") {
							inFlightAvatars.current.add(first.payload.uri);
							try {
								const data = new FormData();
								data.append("file", { uri: first.payload.uri, type: first.payload.mimeType, name: `avatar.${first.payload.mimeType.split("/")[1]}` } as unknown as Blob);
								const profile = await apiRequest<ApiProfile>("/v1/profile/avatar", { method: "POST", headers: { "Idempotency-Key": first.mutationId }, body: data }, true, owner);
								if (!active()) throw new Error("A sessão foi alterada");
								await commit((current) => active() && current.profile.avatarMutationId === first.mutationId
									? { ...current, profile: { ...current.profile, avatarRemoteUrl: profile.avatarUrl ?? undefined } }
									: current);
								return [{ mutationId: first.mutationId, status: "applied" as const }];
							} finally { inFlightAvatars.current.delete(first.payload.uri); }
						}
						return apiRequest<SyncResult[]>(
							"/v1/sync",
							{ method: "POST", body: JSON.stringify({ mutations }) },
							true,
							owner,
						);
					},
					ack: async (ids) => { await removeMutations(ids, owner); await cleanupAvatars(owner); },
					fail: (ids) => markAttempt(ids, owner),
				});
				if (!active()) return;
				const cursor = await getValue("sync-cursor", owner);
				const pulled = await apiRequest<SyncPull>(
					`/v1/sync${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
					{},
					true,
					owner,
				);
				await commit(async (current) => {
					if (!active()) return current;
					const pending = await pendingMutations(1_000_000, owner);
					const hasPending = (entity: string) =>
						pending.some((x) => x.entity === entity);
					return {
						...current,
						profile:
							pulled.profile && !hasPending("profile")
								? {
										...current.profile,
										name: pulled.profile.name ?? current.profile.name,
										birthDate:
											pulled.profile.birthDate ?? current.profile.birthDate,
										weightKg: hasPending("weight")
											? current.profile.weightKg
											: (pulled.profile.weightKg ?? current.profile.weightKg),
										heightCm:
											pulled.profile.heightCm ?? current.profile.heightCm,
										gender: pulled.profile.gender ?? current.profile.gender,
										hasWeight: hasPending("weight")
											? current.profile.hasWeight
											: "weightKg" in pulled.profile
												? pulled.profile.weightKg != null
												: current.profile.hasWeight,
										hasHeight:
											"heightCm" in pulled.profile
												? pulled.profile.heightCm != null
												: current.profile.hasHeight,
										...reconcileAvatar(current.profile, pulled.profile.avatarUrl ?? null, hasPending("avatar")),
									}
								: current.profile,
						goals:
							pulled.goals && !hasPending("goals")
								? { ...current.goals, ...pulled.goals }
								: current.goals,
						water: mergeRows(current.water, pulled.water, pending, "water"),
						meals: mergeRows(current.meals, pulled.meals, pending, "meal"),
						activities: mergeRows(
							current.activities,
							pulled.activities.map((x) => ({
								...x,
								durationMinutes: x.durationSeconds / 60,
								distanceKm: x.distanceMeters / 1000,
							})),
							pending,
							"activity",
						),
						weights: mergeRows(
							current.weights,
							pulled.weights,
							pending,
							"weight",
						),
						dailySteps: hasPending("steps")
							? current.dailySteps
							: [
									...new Map(
										[...(current.dailySteps ?? []), ...pulled.steps].map(
											(x) => [x.date, x],
										),
									).values(),
								],
						steps: hasPending("steps")
							? current.steps
							: (pulled.steps.find((x) => x.date === isoDate())?.steps ??
								current.dailySteps?.find((x) => x.date === isoDate())?.steps ??
								0),
						syncStatus: pending.length ? "pending" : "idle",
					};
				});
				await setValue("sync-cursor", pulled.cursor, owner);
				setLastError(null);
			} catch (error) {
				if (!active()) return;
				await commit((x) => ({ ...x, syncStatus: "error" }));
				setLastError(
					error instanceof Error ? error.message : "Falha ao sincronizar",
				);
				clearTimeout(syncTimer.current);
				syncTimer.current = setTimeout(() => void syncRef.current(), 30_000);
			}
		})()
			.catch((error) =>
				{ if (active()) setLastError(error instanceof Error ? error.message : "Falha de rede"); },
			)
			.finally(async () => {
				flight.current = null;
				flightOwner.current = undefined;
				if (stateRef.current.authenticated && stateRef.current.userId !== owner) { scheduleSync(); return; }
				if (
					active() &&
					stateRef.current.syncStatus === "pending" &&
					(await pendingCount(owner))
				)
					scheduleSync();
			});
		flight.current = run;
		flightOwner.current = owner;
		return run;
	}, [commit, scheduleSync, cleanupAvatars]);
	syncRef.current = syncNow;
	const acceptSession = useCallback(
		async (result: AuthResult) => {
			await writes.current;
			await saveTokens(result.tokens);
			setBiometrics(await getBiometricStatus());
			setActiveUser(result.profile.id);
			await migrateLegacyAccount(result.profile.id, result.profile.email);
			const restored = migrateState(
				await loadState(result.profile.id),
				result.profile.id,
			);
			const pending = await pendingMutations(1_000_000, result.profile.id);
			const pendingProfile = pending.some((row) => row.entity === "profile");
		const pendingWeight = pending.some((row) => row.entity === "weight");
		const pendingAvatar = pending.some((row) => row.entity === "avatar");
			await commit(() => ({
				...restored,
				profile: {
					...(pendingProfile
						? { ...restored.profile, email: result.profile.email }
						: localProfile(result.profile)),
					...(pendingWeight
						? {
								weightKg: restored.profile.weightKg,
								hasWeight: restored.profile.hasWeight,
							}
						: {}),
					...reconcileAvatar(restored.profile, result.profile.avatarUrl, pendingAvatar),
				},
				authenticated: true,
			}));
			await syncNow();
			scheduleSync();
		},
		[commit, scheduleSync, syncNow],
	);
	const login = useCallback(
		async (email: string, password: string) =>
			acceptSession(
				await publicRequest<AuthResult>("/v1/auth/login", { email, password }),
			),
		[acceptSession],
	);
	const register = useCallback(
		async (
			name: string,
			email: string,
			password: string,
			passwordConfirmation: string,
		) =>
			acceptSession(
				await publicRequest<AuthResult>("/v1/auth/register", {
					name,
					email,
					password,
					passwordConfirmation,
				}),
			),
		[acceptSession],
	);
	const setBiometricLogin = useCallback(async (enabled: boolean) => {
		try {
			if (enabled) await enableBiometricLogin();
			else await disableBiometricLogin();
		} catch {
			throw new Error("Não foi possível alterar a biometria. Confirme sua digital ou tente novamente.");
		} finally {
			setBiometrics(await getBiometricStatus());
		}
	}, []);
	const loginWithBiometrics = useCallback(async () => {
		try {
			const tokens = await unlockBiometricSession();
			const owner = tokenClaims(tokens.accessToken).sub;
			if (!owner) throw new Error("Entre com e-mail e senha para renovar sua sessão.");
			await writes.current;
			setActiveUser(owner);
			const restored = migrateState(await loadState(owner), owner);
			await commit(() => ({ ...restored, authenticated: true }));
			await syncNow();
			if (!(await loadTokens())) {
				invalidateSession();
				throw new Error("Sua sessão expirou. Entre com e-mail e senha para continuar.");
			}
			scheduleSync();
		} finally {
			setBiometrics(await getBiometricStatus());
		}
	}, [commit, invalidateSession, scheduleSync, syncNow]);
	const logout = useCallback(async () => {
		const tokens = await loadTokens();
		const owner = stateRef.current.userId;
		invalidateSession();
		clearTimeout(syncTimer.current);
		await writes.current;
		await clearTokens();
		setBiometrics(await getBiometricStatus());
		setActiveUser(null);
		stateRef.current = initialState;
		setState(initialState);
		if (tokens)
			void publicRequest("/v1/auth/logout", {
				refreshToken: tokens.refreshToken,
			}).catch(() => {});
		// Pending records remain scoped to their owner and can be resumed after login.
		if (owner) setLastError(null);
	}, [invalidateSession]);
	const uploadAvatar = useCallback(
		async (uri: string, mimeType = "image/jpeg") => {
			const owner = stateRef.current.userId;
			if (!owner || !stateRef.current.authenticated) throw new Error("Entre na sua conta para alterar a foto.");
			const mutationId = newId();
			const savedUri = persistAvatar(owner, mutationId, uri, mimeType);
			// Protect the copy until its snapshot/outbox transaction has completed.
			inFlightAvatars.current.add(savedUri);
			try {
				const action: Action = { type: "AVATAR_SAVE", uri: savedUri, mimeType, mutationId };
				await commit((current) => {
					if (current.userId !== owner || !current.authenticated) throw new Error("A sessão foi alterada");
					return appReducer(current, action);
				}, action);
				scheduleSync();
			} finally {
				inFlightAvatars.current.delete(savedUri);
				await cleanupAvatars(owner);
			}
		},
		[commit, scheduleSync, cleanupAvatars],
	);
	useEffect(() => {
		let stopped = false;
		void (async () => {
			try {
				await initDatabase();
				const biometricStatus = await getBiometricStatus();
				if (!stopped) setBiometrics(biometricStatus);
				const tokens = await loadTokens();
				const owner = tokens ? tokenClaims(tokens.accessToken).sub : undefined;
				setActiveUser(owner ?? null);
				if (owner) {
					const scoped = await loadState(owner);
					const legacy = scoped ? null : await loadLegacyState();
					// v1 cleared cache on logout. A legacy authenticated snapshot belongs to
					// the SecureStore session being migrated; a different login uses verified email.
					if (
						legacy?.authenticated &&
						(!legacy.userId || legacy.userId === owner)
					)
						await migrateLegacyAccount(owner, legacy.profile.email);

					const migrated = migrateState(await loadState(owner), owner);
					if (!stopped) {
						stateRef.current = { ...migrated, authenticated: true };
						setState(stateRef.current);
					}
				}
			} catch (error) {
				if (!stopped)
					setLastError(
						error instanceof Error
							? error.message
							: "Falha ao carregar os dados",
					);
			} finally {
				if (!stopped) {
					setLoading(false);
					scheduleSync();
					if (stateRef.current.userId) void cleanupAvatars(stateRef.current.userId);
				}
			}
		})();
		return () => {
			stopped = true;
			clearTimeout(syncTimer.current);
		};
	}, [scheduleSync, cleanupAvatars]);
	useEffect(() => {
		const subscription = Lifecycle.addEventListener("change", (status) => {
			if (status === "active")
				void getBiometricStatus().then(setBiometrics).catch(() => {});
		});
		return () => subscription.remove();
	}, []);
	useEffect(() => {
		if (
			state.themeMode === "system" &&
			state.darkMode !== (systemScheme === "dark")
		)
			void commit((x) => ({ ...x, darkMode: systemScheme === "dark" }));
	}, [commit, systemScheme, state.themeMode, state.darkMode]);
	useEffect(
		() =>
			NetInfo.addEventListener((network) => {
				if (network.isConnected) scheduleSync();
				else if (stateRef.current.authenticated)
					void commit((x) => ({ ...x, syncStatus: "offline" }));
			}),
		[commit, scheduleSync],
	);
	useEffect(() => {
		if (!state.authenticated) return;
		let day = isoDate();
		const checkDay = () => {
			const nextDay = isoDate();
			if (nextDay !== day) {
				day = nextDay;
				void commit((current) => ({
					...current,
					steps:
						current.dailySteps?.find((row) => row.date === nextDay)?.steps ?? 0,
				}));
			}
		};
		const timer = setInterval(checkDay, 60_000);
		const subscription = Lifecycle.addEventListener("change", (status) => {
			if (status === "active") checkDay();
		});
		return () => {
			clearInterval(timer);
			subscription.remove();
		};
	}, [commit, state.authenticated]);

	useEffect(() => {
		if (!state.authenticated) return;
		let stopped = false,
			subscription: { remove(): void } | undefined;
		let previousCount = 0;
		void (async () => {
			try {
				if (!(await Pedometer.isAvailableAsync())) return;
				const permission = await Pedometer.requestPermissionsAsync();
				if (permission.granted && !stopped)
					subscription = Pedometer.watchStepCount(({ steps }) => {
						if (stopped) return;
						const date = isoDate();
						const delta = Math.max(0, steps - previousCount);
						previousCount = steps;
						if (delta)
							void dispatch({
								type: "STEPS_INCREMENT",
								date,
								value: delta,
							}).catch(() => {});
					});
			} catch {
				/* devices without a pedometer still support manual activities */
			}
		})();
		return () => {
			stopped = true;
			subscription?.remove();
		};
	}, [dispatch, state.authenticated]);
	const value = useMemo<ContextValue>(
		() => ({
			state,
			dispatch,
			loading,
			lastError,
			login,
			biometrics,
			loginWithBiometrics,
			setBiometricLogin,
			register,
			logout,
			syncNow,
			uploadAvatar,
			addActivity: async (activity) =>
				dispatch({
					type: "ACTIVITY_SAVE",
					value: {
						...activity,
						id: newId(),
						calories: calculateActivityCalories(
							activity.type,
							state.profile.weightKg,
							activity.durationMinutes,
						),
					},
				}),
		}),
		[
			state,
			dispatch,
			loading,
			lastError,
			login,
			biometrics,
			loginWithBiometrics,
			setBiometricLogin,
			register,
			logout,
			syncNow,
			uploadAvatar,
		],
	);
	return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
export const useAppState = () => {
	const value = useContext(AppContext);
	if (!value)
		throw new Error("useAppState deve estar dentro de AppStateProvider");
	return value;
};
export function useDailySummary(date = isoDate()) {
	const { state } = useAppState();
	return useMemo(() => selectDailySummary(state, date), [state, date]);
}
export function useProgress(period: Period) {
	const { state } = useAppState();
	return useMemo(() => selectProgressSummary(state, period), [state, period]);
}

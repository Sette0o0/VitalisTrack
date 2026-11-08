import { onWellbeingChanged } from "@/lib/wellbeing-store";
import { reconcileReminders,clearNativeAccount } from "@/lib/reminders";
import { UserFacingError, userError } from "@/lib/user-error";
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
import { healthProfileCreateSchema } from "@vitalis/contracts";
import type { AuthTokens, Profile as ApiProfile, HealthProfile } from "@vitalis/contracts";
import { apiRequest, publicRequest } from "@/lib/api";
import { calculateActivityCalories, isoDate, newId } from "@/lib/health";
import {
	getValue,
	initDatabase,
	loadState,
 serializeWrite,
	loadLegacyState,
	migrateLegacyAccount,
	pendingMutations,
	pendingCount,
	saveState,
	setActiveUser,
	setValue,
	storedProfiles,
	restoreProfileCatalog,
	updateStoredState,
	createStoredProfile,
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
import { synchronizeAccount, setSyncForeground, type SyncAdapter } from "@/lib/sync-engine";
import { registerBackgroundSync, unregisterBackgroundSync } from "@/lib/background-sync";
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
	profiles: HealthProfile[];
	createProfile: (name: string) => Promise<void>;
	selectProfile: (id: string) => Promise<void>;
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
 runLocalOperation: (work: () => Promise<void>) => Promise<void>;
	uploadAvatar: (uri: string, mimeType?: string) => Promise<void>;
};
const AppContext = createContext<ContextValue | null>(null);

export function AppStateProvider({ children }: PropsWithChildren) {
	const [state, setState] = useState(initialState),
		[loading, setLoading] = useState(true),
		[lastError, setLastError] = useState<string | null>(null);
	const systemScheme = useColorScheme();
	const [profiles, setProfiles] = useState<HealthProfile[]>([]);
	const [biometrics, setBiometrics] = useState<BiometricStatus>({
		enabled: false,
		available: false,
	});
	const stateRef = useRef(state);
	const epoch = useRef(0),
		mounted = useRef(true);
	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
			epoch.current++;
		};
	}, []);
	const writes = useRef<Promise<void>>(Promise.resolve());

	const inFlightAvatars = useRef(new Set<string>());
	const cleanupAvatars = useCallback(async (owner: string) => {
		try {await serializeWrite(async()=>{
			const list = await storedProfiles(owner);
			const references = new Set(inFlightAvatars.current);
			for (const id of new Set([owner, ...list.map((p) => p.id)])) {
				const stored = await loadState(owner, id);
				if (stored?.profile.avatar) references.add(stored.profile.avatar);
				for (const row of await pendingMutations(1_000_000, owner, id))
					if (row.entity === "avatar") references.add(row.payload.uri);
			}
			cleanupAvatarFiles(owner, references);});
		} catch {
			/* A failed cleanup must never roll back a saved photo. */
		}
	}, []);
	const syncRef = useRef<() => Promise<void>>(async () => {});
	const syncTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const invalidateSession = useCallback(() => {
 void clearNativeAccount().catch(()=>{});
		epoch.current++;
		const next = { ...stateRef.current, authenticated: false };
		stateRef.current = next;
		setState(next);
	}, []);
	useSessionRefresh(state.authenticated, invalidateSession);
	const commit = useCallback(
		(
			updater: (previous: AppState) => AppState | Promise<AppState>,
			action?: Action,
			cursor?: string,
		) => {
			const operation = writes.current.then(async () => {
				const previous = stateRef.current,
					updated = await updater(previous);
				if (updated === previous) return;
				const mutation = action && updated.authenticated ? mutationFor(action, updated) : null;
				const next = mutation
					? {
							...updated,
							syncStatus:
								updated.syncStatus === "offline" ? ("offline" as const) : ("pending" as const),
						}
					: updated;
				if (next === previous) return;
				await saveState(next, mutation, cursor);
				const applied =
					previous.authenticated && !stateRef.current.authenticated
						? { ...next, authenticated: false }
						: next;
				stateRef.current = applied;
				setState(applied);
			});
			writes.current = operation.catch((error) =>
				setLastError(userError(error, "save")),
			);
			return operation;
		},
		[],
	);
	const scheduleSync = useCallback(() => {
		clearTimeout(syncTimer.current);
		syncTimer.current = setTimeout(() => void syncRef.current(), 750);
	}, []);
 useEffect(()=>{
  if(!state.authenticated || !state.userId)return;
  const owner=state.userId;
  const update=()=>{void reconcileReminders(owner).catch(()=>{});};update();
  const off=onWellbeingChanged(reason=>{update();if(reason==="local")scheduleSync();});
  const sub=Lifecycle.addEventListener("change",value=>{if(value==="active")update();});
  return ()=>{off();sub.remove();};
 },[state.authenticated,state.userId,scheduleSync]);

 const runLocalOperation = useCallback((work:()=>Promise<void>)=>{
 const owner=state.userId,profileId=state.profileId??owner;
 const operation=writes.current.then(async()=>{
  if(!owner || stateRef.current.userId!==owner || (stateRef.current.profileId??owner)!==profileId || !stateRef.current.authenticated)throw new UserFacingError("O perfil foi alterado. Confira a prévia novamente.");
  await work();const saved=await loadState(owner,profileId);
  if(saved && stateRef.current.userId===owner && (stateRef.current.profileId??owner)===profileId && stateRef.current.authenticated){stateRef.current=saved;setState(saved);}
  scheduleSync();
 });writes.current=operation.catch(e=>setLastError(userError(e,"save")));return operation;
 },[state.userId,state.profileId,scheduleSync]);
	const dispatch = useCallback(
		async (action: Action) => {
			const owner = state.userId;
			const profileId = state.profileId;
			if (owner !== stateRef.current.userId || profileId !== stateRef.current.profileId)
				throw new UserFacingError("O perfil foi alterado. Abra o formulário novamente.");
			await commit(
				(previous) =>
					previous.userId !== owner || previous.profileId !== profileId
						? previous
						: appReducer(previous, action),
				action,
			);
			if (mutationFor(action, stateRef.current)) scheduleSync();
		},
		[commit, scheduleSync, state.userId, state.profileId],
	);
	const makeAdapter = useCallback(
		(owner: string): SyncAdapter => {
			const generation = epoch.current;
			return {
				active: () =>
					mounted.current &&
					generation === epoch.current &&
					stateRef.current.userId === owner &&
					stateRef.current.authenticated,
				apply: async (profileId, update, cursor) => {
					if (stateRef.current.userId !== owner || !stateRef.current.authenticated) return;
					await commit(
						async (current) => {
							if (current.userId !== owner || !current.authenticated) return current;
							if ((current.profileId ?? owner) !== profileId) {
								await updateStoredState(owner, profileId, update, cursor);
								return current;
							}
							return update(current);
						},
						undefined,
						cursor,
					);
				},
				avatarStarted: (uri) => inFlightAvatars.current.add(uri),
				avatarFinished: (uri) => inFlightAvatars.current.delete(uri),
				acknowledged: () => cleanupAvatars(owner),
			};
		},
		[commit, cleanupAvatars],
	);
	const syncNow = useCallback(async () => {
		const owner = stateRef.current.userId;
		if (!owner || !stateRef.current.authenticated) return;
		const generation = epoch.current;
		const valid = () =>
			generation === epoch.current &&
			mounted.current &&
			stateRef.current.userId === owner &&
			stateRef.current.authenticated;
		const network = await NetInfo.fetch();
		if (!valid()) return;
		if (!network.isConnected || network.isInternetReachable === false) {
			await commit((x) => ({ ...x, syncStatus: "offline" }));
			return;
		}
		await commit((x) => ({ ...x, syncStatus: "syncing" }));
		try {
			await writes.current;
			await synchronizeAccount(owner, makeAdapter(owner));
			if (valid()) {
				const list = await storedProfiles(owner);
				setProfiles(list);
				setLastError(null);
				if ((await Promise.all(list.map((p) => pendingCount(owner, p.id)))).some(Boolean))
					scheduleSync();
			}
		} catch (error) {
			if (!valid()) return;
			await commit((x) => ({ ...x, syncStatus: "error" }));
			setLastError(userError(error, "sync"));
			clearTimeout(syncTimer.current);
			syncTimer.current = setTimeout(() => void syncRef.current(), 30000);
		}
	}, [commit, makeAdapter, scheduleSync]);
	useEffect(() => {
		if (!state.authenticated || !state.userId) return;
		const release = setSyncForeground(state.userId, makeAdapter(state.userId));
		void registerBackgroundSync().catch(() => {});
		const timer = setInterval(() => {
			if (Lifecycle.currentState === "active") scheduleSync();
		}, 15 * 60_000);
		return () => {
			clearInterval(timer);
			release();
		};
	}, [state.authenticated, state.userId, makeAdapter, scheduleSync]);
	const selectProfile = useCallback(
		async (id: string) => {
			const current = stateRef.current,
				owner = current.userId;
			if (!owner || !current.authenticated) throw new UserFacingError("Entre na conta.");
			if (!profiles.some((p) => p.id === id)) throw new UserFacingError("Perfil não encontrado.");
			await writes.current;
			if (await getValue("active-workout", owner, current.profileId ?? owner))
				throw new UserFacingError("Finalize ou descarte o treino antes de trocar de perfil.");
			await commit(async (previous) => {
				if (previous.userId !== owner || !previous.authenticated) return previous;
				const restored = migrateState(await loadState(owner, id), owner);
				return {
					...restored,
					profileId: id,
					authenticated: true,
					darkMode: previous.darkMode,
					themeMode: previous.themeMode,
				};
			});
			if (stateRef.current.userId !== owner || !stateRef.current.authenticated)
				throw new UserFacingError("A sessão foi alterada");
			setActiveUser(owner, id);
			await setValue("selected-profile", id, owner, owner);
			scheduleSync();
		},
		[profiles, commit, scheduleSync],
	);
	const createProfile = useCallback(
		async (name: string) => {
			const owner = stateRef.current.userId;
			if (!owner || !stateRef.current.authenticated) throw new UserFacingError("Entre na conta.");
			const input = healthProfileCreateSchema.parse({ id: newId(), name });
			const p: HealthProfile = { ...input, isPrimary: false, updatedAt: new Date().toISOString() };
			const fresh = {
				...migrateState(null, owner),
				profileId: p.id,
				authenticated: true,
				profile: { ...initialState.profile, name: p.name, email: stateRef.current.profile.email },
			};
			await createStoredProfile(fresh, p, {
				mutationId: newId(),
				entity: "healthProfile",
				action: "upsert",
				profileId: p.id,
				payload: input,
				clientUpdatedAt: new Date().toISOString(),
			});
			if (stateRef.current.userId === owner && stateRef.current.authenticated) {
				setProfiles(await storedProfiles(owner));
				scheduleSync();
			}
		},
		[scheduleSync],
	);
	syncRef.current = syncNow;
	const acceptSession = useCallback(
		async (result: AuthResult) => {
			await writes.current;
			await saveTokens(result.tokens);
			setBiometrics(await getBiometricStatus());
			const owner = result.profile.id;
			await migrateLegacyAccount(owner, result.profile.email);
			const { profiles: list, selected } = await restoreProfileCatalog(owner, result.profile.name);
			setProfiles(list);
			setActiveUser(owner, selected);
			const restored = migrateState(
				await loadState(result.profile.id, selected),
				result.profile.id,
			);
			const pending = await pendingMutations(1_000_000, result.profile.id, selected);
			const pendingProfile = pending.some((row) => row.entity === "profile");
			const pendingWeight = pending.some((row) => row.entity === "weight");
			const pendingAvatar = pending.some((row) => row.entity === "avatar");
			await commit(() => ({
				...restored,
				profileId: selected,
				profile: {
					...(pendingProfile || selected !== owner
						? { ...restored.profile, email: result.profile.email }
						: localProfile(result.profile)),
					...(pendingWeight
						? {
								weightKg: restored.profile.weightKg,
								hasWeight: restored.profile.hasWeight,
							}
						: {}),
					...(selected === owner
						? reconcileAvatar(restored.profile, result.profile.avatarUrl, pendingAvatar)
						: {}),
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
			acceptSession(await publicRequest<AuthResult>("/v1/auth/login", { email, password })),
		[acceptSession],
	);
	const register = useCallback(
		async (name: string, email: string, password: string, passwordConfirmation: string) =>
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
			throw new UserFacingError(
				"Não foi possível alterar a biometria. Confirme sua digital ou tente novamente.",
			);
		} finally {
			setBiometrics(await getBiometricStatus());
		}
	}, []);
	const loginWithBiometrics = useCallback(async () => {
		try {
			const tokens = await unlockBiometricSession();
			const owner = tokenClaims(tokens.accessToken).sub;
			if (!owner) throw new UserFacingError("Entre com e-mail e senha para renovar sua sessão.");
			await writes.current;
			const { profiles: list, selected } = await restoreProfileCatalog(owner);
			setActiveUser(owner, selected);
			setProfiles(list);
			const restored = {
				...migrateState(await loadState(owner, selected), owner),
				profileId: selected,
			};
			await commit(() => ({ ...restored, authenticated: true }));
			await syncNow();
			if (!(await loadTokens())) {
				invalidateSession();
				throw new UserFacingError("Sua sessão expirou. Entre com e-mail e senha para continuar.");
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
		await unregisterBackgroundSync();
 await clearNativeAccount();
		setProfiles([]);
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
			const owner = state.userId;
			const profileId = state.profileId;
			if (owner !== stateRef.current.userId || profileId !== stateRef.current.profileId)
				throw new UserFacingError("O perfil foi alterado.");
			if (!owner || !stateRef.current.authenticated)
				throw new UserFacingError("Entre na sua conta para alterar a foto.");
			const mutationId = newId();
			const savedUri = persistAvatar(owner, mutationId, uri, mimeType);
			// Protect the copy until its snapshot/outbox transaction has completed.
			inFlightAvatars.current.add(savedUri);
			try {
				const action: Action = { type: "AVATAR_SAVE", uri: savedUri, mimeType, mutationId };
				await commit((current) => {
					if (current.userId !== owner || current.profileId !== profileId || !current.authenticated)
						throw new UserFacingError("A sessão foi alterada");
					return appReducer(current, action);
				}, action);
				scheduleSync();
			} finally {
				inFlightAvatars.current.delete(savedUri);
				await cleanupAvatars(owner);
			}
		},
		[commit, scheduleSync, cleanupAvatars, state.userId, state.profileId],
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
					const legacy = (await loadState(owner, owner)) ? null : await loadLegacyState();
					// SecureStore identity authorizes migrating this legacy authenticated cache.
					if (legacy?.authenticated && (!legacy.userId || legacy.userId === owner))
						await migrateLegacyAccount(owner, legacy.profile.email);
					const { profiles: list, selected } = await restoreProfileCatalog(owner);
					setActiveUser(owner, selected);
					if (!stopped) setProfiles(list);

					const migrated = {
						...migrateState(await loadState(owner, selected), owner),
						profileId: selected,
					};
					if (!stopped) {
						stateRef.current = { ...migrated, authenticated: true };
						setState(stateRef.current);
					}
				}
			} catch (error) {
				if (!stopped)
					setLastError(userError(error, "load"));
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
			if (status === "active") {
				scheduleSync();
				void getBiometricStatus()
					.then(setBiometrics)
					.catch(() => {});
			}
		});
		return () => subscription.remove();
	}, []);
	useEffect(() => {
		if (state.themeMode === "system" && state.darkMode !== (systemScheme === "dark"))
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
					steps: current.dailySteps?.find((row) => row.date === nextDay)?.steps ?? 0,
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
	}, [dispatch, state.authenticated, state.profileId]);
	const value = useMemo<ContextValue>(
		() => ({
			state,
			profiles,
			createProfile,
			selectProfile,
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
 runLocalOperation,
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
			profiles,
			createProfile,
			selectProfile,
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
 runLocalOperation,
			uploadAvatar,
		],
	);
	return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
export const useAppState = () => {
	const value = useContext(AppContext);
	if (!value) throw new Error("useAppState deve estar dentro de AppStateProvider");
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

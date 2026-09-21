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
	SyncMutation,
} from "@vitalis/contracts";
import { apiRequest, publicRequest } from "@/lib/api";
import { calculateActivityCalories, isoDate, newId } from "@/lib/health";
import {
	clearLocalData,
	enqueueMutation,
	getValue,
	initDatabase,
	loadState,
	markAttempt,
	pendingMutations,
	removeMutations,
	saveState,
	setValue,
} from "@/lib/local-database";
import { clearTokens, loadTokens, saveTokens } from "@/lib/session";
import type {
	Activity,
	AppState,
	Goals,
	Meal,
	Period,
	Profile,
	WaterEntry,
	WeightEntry,
} from "./types";
import { selectDailySummary, selectProgressSummary } from "./selectors";

export const initialState: AppState = {
	profile: {
		name: "",
		email: "",
		birthDate: "2000-01-01",
		weightKg: 70,
		heightCm: 170,
		gender: "Outro",
	},
	goals: {
		waterMl: 2500,
		calories: 2000,
		mealCalories: 700,
		steps: 10000,
		weightKg: 70,
		dailyDeficit: 400,
	},
	water: [],
	meals: [],
	activities: [],
	weights: [],
	steps: 0,
	authenticated: false,
	darkMode: false,
	syncStatus: "idle",
};

export type Action =
	| { type: "LOGIN" }
	| { type: "LOGOUT" }
	| { type: "SET_DARK"; value: boolean }
	| { type: "PROFILE"; value: Profile }
	| { type: "GOALS"; value: Partial<Goals> }
	| { type: "WATER_ADD"; value: Omit<WaterEntry, "id"> }
	| { type: "WATER_UPDATE"; value: WaterEntry }
	| { type: "WATER_DELETE"; id: string }
	| { type: "MEAL_SAVE"; value: Meal }
	| { type: "MEAL_DELETE"; id: string }
	| { type: "ACTIVITY_SAVE"; value: Activity }
	| { type: "ACTIVITY_DELETE"; id: string }
	| { type: "WEIGHT_ADD"; value: Omit<WeightEntry, "id"> }
	| { type: "STEPS_SET"; value: number };

export function appReducer(state: AppState, action: Action): AppState {
	switch (action.type) {
		case "LOGIN":
			return { ...state, authenticated: true };
		case "LOGOUT":
			return { ...initialState, darkMode: state.darkMode };
		case "SET_DARK":
			return { ...state, darkMode: action.value };
		case "PROFILE":
			return { ...state, profile: action.value };
		case "GOALS":
			return { ...state, goals: { ...state.goals, ...action.value } };
		case "WATER_ADD":
			return {
				...state,
				water: [...state.water, { ...action.value, id: newId() }],
			};
		case "WATER_UPDATE":
			return {
				...state,
				water: state.water.map((x) =>
					x.id === action.value.id ? action.value : x,
				),
			};
		case "WATER_DELETE":
			return { ...state, water: state.water.filter((x) => x.id !== action.id) };
		case "MEAL_SAVE":
			return {
				...state,
				meals: state.meals.some((x) => x.id === action.value.id)
					? state.meals.map((x) =>
							x.id === action.value.id ? action.value : x,
						)
					: [...state.meals, action.value],
			};
		case "MEAL_DELETE":
			return { ...state, meals: state.meals.filter((x) => x.id !== action.id) };
		case "ACTIVITY_SAVE":
			return {
				...state,
				activities: state.activities.some((x) => x.id === action.value.id)
					? state.activities.map((x) =>
							x.id === action.value.id ? action.value : x,
						)
					: [...state.activities, action.value],
			};
		case "ACTIVITY_DELETE":
			return {
				...state,
				activities: state.activities.filter((x) => x.id !== action.id),
			};
		case "WEIGHT_ADD":
			return {
				...state,
				weights: [...state.weights, { ...action.value, id: newId() }],
				profile: { ...state.profile, weightKg: action.value.weightKg },
			};
		case "STEPS_SET":
			return { ...state, steps: action.value };
	}
}

const createMutation = (
	entity: SyncMutation["entity"],
	action: SyncMutation["action"],
	payload?: Record<string, unknown>,
	entityId?: string,
): SyncMutation => ({
	mutationId: newId(),
	entity,
	action,
	payload,
	entityId,
	clientUpdatedAt: new Date().toISOString(),
});
function mutationFor(action: Action, next: AppState): SyncMutation | null {
	switch (action.type) {
		case "PROFILE": {
			const { name, birthDate, weightKg, heightCm, gender } = action.value;
			return createMutation("profile", "upsert", {
				name,
				birthDate,
				weightKg,
				heightCm,
				gender,
			});
		}
		case "GOALS":
			return createMutation(
				"goals",
				"upsert",
				action.value as Record<string, unknown>,
			);
		case "WATER_ADD":
			return createMutation(
				"water",
				"upsert",
				next.water.at(-1) as unknown as Record<string, unknown>,
			);
		case "WATER_UPDATE":
			return createMutation(
				"water",
				"upsert",
				action.value as unknown as Record<string, unknown>,
				action.value.id,
			);
		case "WATER_DELETE":
			return createMutation("water", "delete", undefined, action.id);
		case "MEAL_SAVE":
			return createMutation(
				"meal",
				"upsert",
				action.value as unknown as Record<string, unknown>,
				action.value.id,
			);
		case "MEAL_DELETE":
			return createMutation("meal", "delete", undefined, action.id);
		case "ACTIVITY_SAVE":
			return createMutation(
				"activity",
				"upsert",
				{
					id: action.value.id,
					type: action.value.type,
					date: action.value.date,
					durationSeconds: action.value.durationMinutes * 60,
					distanceMeters: action.value.distanceKm * 1000,
					route: action.value.route ?? [],
				},
				action.value.id,
			);
		case "ACTIVITY_DELETE":
			return createMutation("activity", "delete", undefined, action.id);
		case "WEIGHT_ADD":
			return createMutation(
				"weight",
				"upsert",
				next.weights.at(-1) as unknown as Record<string, unknown>,
			);
		case "STEPS_SET":
			return createMutation("steps", "upsert", {
				date: isoDate(),
				steps: action.value,
			});
		default:
			return null;
	}
}

type AuthResult = { profile: ApiProfile; tokens: AuthTokens };
type SyncPull = {
	water: any[];
	meals: any[];
	activities: any[];
	weights: any[];
	steps: { date: string; steps: number }[];
	profile: Partial<Profile> | null;
	goals: Partial<Goals> | null;
	cursor: string;
};
const mergeRows = <T extends { id: string }>(
	current: T[],
	incoming: (T & { deletedAt?: string | null })[],
) => {
	const map = new Map(current.map((item) => [item.id, item]));
	for (const item of incoming)
		item.deletedAt ? map.delete(item.id) : map.set(item.id, item);
	return [...map.values()];
};
const localProfile = (profile: ApiProfile): Profile => ({
	name: profile.name,
	email: profile.email,
	birthDate: profile.birthDate ?? "2000-01-01",
	weightKg: profile.weightKg ?? 70,
	heightCm: profile.heightCm ?? 170,
	gender: profile.gender ?? "Outro",
	avatar: profile.avatarUrl ?? undefined,
});

type ContextValue = {
	state: AppState;
	dispatch: (action: Action) => void;
	loading: boolean;
	lastError: string | null;
	addActivity: (value: Omit<Activity, "id" | "calories">) => void;
	login: (email: string, password: string) => Promise<void>;
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
	const [state, setState] = useState(initialState);
	const [loading, setLoading] = useState(true);
	const [lastError, setLastError] = useState<string | null>(null);
	const stateRef = useRef(state);
	stateRef.current = state;
	const setAndSave = useCallback(
		(updater: (previous: AppState) => AppState) => {
			setState((previous) => {
				const next = updater(previous);
				stateRef.current = next;
				void saveState(next);
				return next;
			});
		},
		[],
	);
	const dispatch = useCallback(
		(action: Action) => {
			setAndSave((previous) => {
				const next = appReducer(previous, action);
				const queued = next.authenticated ? mutationFor(action, next) : null;
				if (queued) void enqueueMutation(queued);
				return next;
			});
		},
		[setAndSave],
	);
	const syncNow = useCallback(async () => {
		if (!stateRef.current.authenticated) return;
		const network = await NetInfo.fetch();
		if (!network.isConnected) {
			setAndSave((x) => ({ ...x, syncStatus: "offline" }));
			return;
		}
		setAndSave((x) => ({ ...x, syncStatus: "syncing" }));
		try {
			const pending = await pendingMutations();
			if (pending.length) {
				const results = await apiRequest<
					{ mutationId: string; status: string }[]
				>("/v1/sync", {
					method: "POST",
					body: JSON.stringify({ mutations: pending }),
				});
				await removeMutations(
					results
						.filter((x) => x.status === "applied")
						.map((x) => x.mutationId),
				);
				await markAttempt(
					results
						.filter((x) => x.status !== "applied")
						.map((x) => x.mutationId),
				);
			}
			const cursor = await getValue("sync-cursor");
			const pulled = await apiRequest<SyncPull>(
				`/v1/sync${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
			);
			setAndSave((current) => ({
				...current,
				profile: pulled.profile
					? { ...current.profile, ...pulled.profile }
					: current.profile,
				goals: pulled.goals
					? { ...current.goals, ...pulled.goals }
					: current.goals,
				water: mergeRows(
					current.water,
					pulled.water.map((x) => ({
						id: x.id,
						amountMl: x.amountMl,
						date: x.date,
						time: x.time,
						deletedAt: x.deletedAt,
					})),
				),
				meals: mergeRows(
					current.meals,
					pulled.meals.map((x) => ({
						id: x.id,
						name: x.name,
						date: x.date,
						time: x.time,
						quantity: x.quantity,
						unit: x.unit,
						calories: x.calories,
						deletedAt: x.deletedAt,
					})),
				),
				activities: mergeRows(
					current.activities,
					pulled.activities.map((x) => ({
						id: x.id,
						type: x.type,
						date: x.date,
						durationMinutes: Math.max(1, Math.round(x.durationSeconds / 60)),
						distanceKm: x.distanceMeters / 1000,
						calories: x.calories,
						route: x.route,
						deletedAt: x.deletedAt,
					})),
				),
				weights: mergeRows(
					current.weights,
					pulled.weights.map((x) => ({
						id: x.id,
						date: x.date,
						weightKg: x.weightKg,
						deletedAt: x.deletedAt,
					})),
				),
				steps:
					pulled.steps.find((x) => x.date === isoDate())?.steps ??
					current.steps,
				syncStatus: "idle",
			}));
			await setValue("sync-cursor", pulled.cursor);
			setLastError(null);
		} catch (error) {
			setAndSave((x) => ({ ...x, syncStatus: "error" }));
			setLastError(
				error instanceof Error ? error.message : "Falha ao sincronizar",
			);
		}
	}, [setAndSave]);
	const acceptSession = useCallback(
		async (result: AuthResult) => {
			await saveTokens(result.tokens);
			setAndSave((current) => ({
				...current,
				profile: localProfile(result.profile),
				authenticated: true,
			}));
			await syncNow();
		},
		[setAndSave, syncNow],
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
	const logout = useCallback(async () => {
		const tokens = await loadTokens();
		if (tokens)
			await apiRequest<void>("/v1/auth/logout", {
				method: "POST",
				body: JSON.stringify({ refreshToken: tokens.refreshToken }),
			}).catch(() => undefined);
		await clearTokens();
		await clearLocalData();
		setState(initialState);
		stateRef.current = initialState;
	}, []);
	const uploadAvatar = useCallback(
		async (uri: string, mimeType = "image/jpeg") => {
			const data = new FormData();
			data.append("file", {
				uri,
				type: mimeType,
				name: `avatar.${mimeType.split("/")[1] ?? "jpg"}`,
			} as unknown as Blob);
			const profile = await apiRequest<ApiProfile>("/v1/profile/avatar", {
				method: "POST",
				body: data,
			});
			setAndSave((current) => ({ ...current, profile: localProfile(profile) }));
		},
		[setAndSave],
	);

	useEffect(() => {
		void (async () => {
			await initDatabase();
			const [saved, tokens] = await Promise.all([loadState(), loadTokens()]);
			const restored = saved
				? { ...initialState, ...saved, authenticated: Boolean(tokens) }
				: { ...initialState, authenticated: Boolean(tokens) };
			setState(restored);
			stateRef.current = restored;
			setLoading(false);
			if (tokens) await syncNow();
		})();
	}, [syncNow]);
	useEffect(
		() =>
			NetInfo.addEventListener((network) => {
				if (network.isConnected) void syncNow();
				else if (stateRef.current.authenticated)
					setAndSave((x) => ({ ...x, syncStatus: "offline" }));
			}),
		[setAndSave, syncNow],
	);
	useEffect(() => {
		if (!state.authenticated) return;
		let subscription: { remove(): void } | undefined;
		void (async () => {
			if (!(await Pedometer.isAvailableAsync())) return;
			const permission = await Pedometer.requestPermissionsAsync();
			if (permission.granted)
				subscription = Pedometer.watchStepCount(({ steps }) =>
					dispatch({ type: "STEPS_SET", value: steps }),
				);
		})();
		return () => subscription?.remove();
	}, [dispatch, state.authenticated]);
	const value = useMemo<ContextValue>(
		() => ({
			state,
			dispatch,
			loading,
			lastError,
			login,
			register,
			logout,
			syncNow,
			uploadAvatar,
			addActivity: (activity) =>
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

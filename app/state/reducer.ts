import type {
	AppState,
	Profile,
	Goals,
	WaterEntry,
	Meal,
	Activity,
	WeightEntry,
} from "./types";
import { newId, isoDate } from "@/lib/health";
export const initialState: AppState = {
	schemaVersion: 2,
	dailySteps: [],
	themeMode: "system",
	profile: {
		hasWeight: false,
		hasHeight: false,
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
	| { type: "SET_THEME"; value: "system" | "light" | "dark"; dark: boolean }
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
	| { type: "STEPS_SET"; value: number; date?: string }
	| { type: "STEPS_INCREMENT"; value: number; date: string };

export function appReducer(state: AppState, action: Action): AppState {
	switch (action.type) {
		case "LOGIN":
			return { ...state, authenticated: true };
		case "LOGOUT":
			return { ...initialState, darkMode: state.darkMode };
		case "SET_DARK":
			return {
				...state,
				darkMode: action.value,
				themeMode: action.value ? "dark" : "light",
			};
		case "SET_THEME":
			return { ...state, themeMode: action.value, darkMode: action.dark };
		case "PROFILE":
			return {
				...state,
				profile: { ...action.value, hasWeight: true, hasHeight: true },
			};
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
				profile: {
					...state.profile,
					weightKg: action.value.weightKg,
					hasWeight: true,
				},
			};
		case "STEPS_INCREMENT":
		case "STEPS_SET": {
			const date = action.date ?? isoDate();
			const steps =
				action.type === "STEPS_INCREMENT"
					? (state.dailySteps?.find((row) => row.date === date)?.steps ?? 0) +
						action.value
					: action.value;
			return {
				...state,
				steps: date === isoDate() ? steps : state.steps,
				dailySteps: [
					...(state.dailySteps ?? []).filter((row) => row.date !== date),
					{ date, steps },
				],
			};
		}
	}
}

export type Gender = "Feminino" | "Masculino" | "Outro";
export type ActivityType = "walk" | "run" | "cycling";
export type Period = "day" | "week" | "month";
export type Profile = {
	name: string;
	email: string;
	birthDate: string;
	weightKg: number;
	heightCm: number;
	gender: Gender;
	avatar?: string;
};
export type Goals = {
	waterMl: number;
	calories: number;
	mealCalories: number;
	steps: number;
	weightKg: number;
	dailyDeficit: number;
};
export type WaterEntry = {
	id: string;
	amountMl: number;
	date: string;
	time: string;
};
export type Meal = {
	id: string;
	name: string;
	date: string;
	time: string;
	quantity: number;
	unit: "g" | "mL";
	calories: number;
};
export type Activity = {
	id: string;
	type: ActivityType;
	date: string;
	durationMinutes: number;
	distanceKm: number;
	calories: number;
	route?: {
		latitude: number;
		longitude: number;
		altitude?: number | null;
		accuracy?: number | null;
		timestamp: string;
	}[];
};
export type WeightEntry = { id: string; date: string; weightKg: number };
export type AppState = {
	profile: Profile;
	goals: Goals;
	water: WaterEntry[];
	meals: Meal[];
	activities: Activity[];
	weights: WeightEntry[];
	steps: number;
	authenticated: boolean;
	darkMode: boolean;
	syncStatus?: "idle" | "syncing" | "offline" | "error";
};

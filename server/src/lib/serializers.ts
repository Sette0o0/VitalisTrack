import { calculateAge } from "./dates.js";
import type {
	Activity,
	ActivityRoutePoint,
	Meal,
	WaterEntry,
	WeightEntry,
} from "../../generated/prisma/client.js";

export function serializeProfile(
	user: {
		id: string;
		email: string;
		profile: {
			name: string;
			birthDate: Date | null;
			weightKg: number | null;
			heightCm: number | null;
			gender: string | null;
			avatarPath: string | null;
			updatedAt: Date;
		} | null;
	},
	publicBaseUrl: string,
) {
	const profile = user.profile;
	if (!profile) throw new Error("Perfil ausente");
	return {
		id: user.id,
		name: profile.name,
		email: user.email,
		birthDate: profile.birthDate?.toISOString().slice(0, 10) ?? null,
		weightKg: profile.weightKg,
		heightCm: profile.heightCm,
		gender: profile.gender,
		avatarUrl: profile.avatarPath
			? `${publicBaseUrl}${profile.avatarPath}`
			: null,
		age: calculateAge(profile.birthDate),
		updatedAt: profile.updatedAt.toISOString(),
	};
}

export const serializeGoals = (goals: {
	waterMl: number;
	calories: number;
	mealCalories: number;
	steps: number;
	weightKg: number;
	dailyDeficit: number;
	updatedAt: Date;
}) => ({ ...goals, updatedAt: goals.updatedAt.toISOString() });

const base = (value: {
	createdAt: Date;
	updatedAt: Date;
	deletedAt: Date | null;
}) => ({
	createdAt: value.createdAt.toISOString(),
	updatedAt: value.updatedAt.toISOString(),
	deletedAt: value.deletedAt?.toISOString() ?? null,
});
export const serializeWater = (value: WaterEntry) => ({
	id: value.id,
	amountMl: value.amountMl,
	date: value.date.toISOString().slice(0, 10),
	time: value.time,
	...base(value),
});
export const serializeMeal = (value: Meal) => ({
	id: value.id,
	name: value.name,
	date: value.date.toISOString().slice(0, 10),
	time: value.time,
	quantity: value.quantity,
	unit: value.unit,
	calories: value.calories,
	...base(value),
});
export const serializeWeight = (value: WeightEntry) => ({
	id: value.id,
	date: value.date.toISOString().slice(0, 10),
	weightKg: value.weightKg,
	...base(value),
});
export const serializeActivity = (
	value: Activity & { route: ActivityRoutePoint[] },
) => ({
	id: value.id,
	type: value.type,
	date: value.date.toISOString().slice(0, 10),
	durationSeconds: value.durationSeconds,
	distanceMeters: value.distanceMeters,
	calories: value.calories,
	paceSecondsPerKm: value.paceSecondsPerKm,
	route: value.route.map((point) => ({
		latitude: point.latitude,
		longitude: point.longitude,
		altitude: point.altitude,
		accuracy: point.accuracy,
		timestamp: point.timestamp.toISOString(),
	})),
	...base(value),
});

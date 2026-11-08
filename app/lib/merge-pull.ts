import type { SyncPull } from "@vitalis/contracts";
import type { AppState, LocalMutation } from "@/state/types";
import { mergeRows } from "./sync";
import { reconcileAvatar } from "./avatar-files";
import { isoDate } from "./health";
export function mergePull(current: AppState, pulled: SyncPull, pending: LocalMutation[]): AppState {
	const hasPending = (entity: string) => pending.some((x) => x.entity === entity);
	return {
		...current,
		unitSystem: hasPending("preferences")
			? current.unitSystem
			: (pulled.unitSystem ?? current.unitSystem),
		nutrition: hasPending("nutrition")
			? current.nutrition
			: pulled.nutrition === undefined
				? current.nutrition
				: pulled.nutrition,
		recipes: mergeRows(current.recipes ?? [], pulled.recipes ?? [], pending, "recipe"),
		profile:
			pulled.profile && !hasPending("profile")
				? {
						...current.profile,
						name: pulled.profile.name ?? current.profile.name,
						birthDate: pulled.profile.birthDate ?? current.profile.birthDate,
						weightKg: hasPending("weight")
							? current.profile.weightKg
							: (pulled.profile.weightKg ?? current.profile.weightKg),
						heightCm: pulled.profile.heightCm ?? current.profile.heightCm,
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
						...reconcileAvatar(
							current.profile,
							pulled.profile.avatarUrl ?? null,
							hasPending("avatar"),
						),
					}
				: current.profile,
		goals:
			pulled.goals && !hasPending("goals") ? { ...current.goals, ...pulled.goals } : current.goals,
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
		weights: mergeRows(current.weights, pulled.weights, pending, "weight"),
		dailySteps: hasPending("steps")
			? current.dailySteps
			: [
					...new Map(
						[...(current.dailySteps ?? []), ...pulled.steps].map((x) => [x.date, x]),
					).values(),
				].filter(x => !(x as {deletedAt?:string|null}).deletedAt),
		steps: hasPending("steps")
			? current.steps
			: (pulled.steps.find((x) => x.date === isoDate())?.steps ??
				current.dailySteps?.find((x) => x.date === isoDate())?.steps ??
				0),
		syncStatus: pending.length ? "pending" : "idle",
	};
}

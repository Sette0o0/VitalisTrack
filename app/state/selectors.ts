import { isoDate } from "@/lib/health";
import type { AppState, Period } from "./types";

export type DailySummary = {
	water: number;
	calories: number;
	steps: number;
	waterProgress: number;
	calorieProgress: number;
	stepProgress: number;
};

const safeRatio = (value: number, target: number) =>
	target > 0 ? value / target : 0;

export function selectDailySummary(
	state: AppState,
	date = isoDate(),
): DailySummary {
	const water = state.water
		.filter((entry) => entry.date === date)
		.reduce((total, entry) => total + entry.amountMl, 0);
	const calories = state.meals
		.filter((meal) => meal.date === date)
		.reduce((total, meal) => total + meal.calories, 0);
	return {
		water,
		calories,
		steps: state.steps,
		waterProgress: safeRatio(water, state.goals.waterMl),
		calorieProgress: safeRatio(calories, state.goals.calories),
		stepProgress: safeRatio(state.steps, state.goals.steps),
	};
}

function startDate(period: Period, referenceDate: string) {
	const date = new Date(`${referenceDate}T12:00:00`);
	const days = period === "day" ? 0 : period === "week" ? 6 : 29;
	date.setDate(date.getDate() - days);
	return isoDate(date);
}

function average(values: number[]) {
	return values.length
		? values.reduce((sum, value) => sum + value, 0) / values.length
		: 0;
}

export function selectProgressSummary(
	state: AppState,
	period: Period,
	referenceDate = isoDate(),
) {
	const start = startDate(period, referenceDate);
	const inWindow = (date: string) => date >= start && date <= referenceDate;
	const waterDates = [
		...new Set(
			state.water
				.filter((entry) => inWindow(entry.date))
				.map((entry) => entry.date),
		),
	];
	const mealDates = [
		...new Set(
			state.meals
				.filter((meal) => inWindow(meal.date))
				.map((meal) => meal.date),
		),
	];
	const activityDates = state.activities
		.filter((activity) => inWindow(activity.date))
		.map((activity) => activity.date);
	const contributingDates = [
		...new Set([
			...waterDates,
			...mealDates,
			...activityDates,
			...(state.steps > 0 ? [referenceDate] : []),
		]),
	];
	const waterProgress = average(
		waterDates.map((date) => selectDailySummary(state, date).waterProgress),
	);
	const calorieProgress = average(
		mealDates.map((date) => selectDailySummary(state, date).calorieProgress),
	);
	const stepProgress = selectDailySummary(state, referenceDate).stepProgress;
	return {
		rings: [
			{ label: "Passos", value: Math.min(stepProgress, 1) },
			{ label: "Água", value: Math.min(waterProgress, 1) },
			{ label: "Calorias", value: Math.min(calorieProgress, 1) },
		],
		activityMinutes: state.activities
			.filter((activity) => inWindow(activity.date))
			.reduce((sum, activity) => sum + activity.durationMinutes, 0),
		contributingDays: contributingDates.length,
		windowDays: period === "day" ? 1 : period === "week" ? 7 : 30,
	};
}

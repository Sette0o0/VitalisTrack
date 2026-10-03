import type { ActivityStatistics } from "@vitalis/contracts";
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
const ratio = (value: number, target: number) =>
	target > 0 ? value / target : 0;
export function dateRange(days: number, referenceDate: string) {
	const date = new Date(`${referenceDate}T12:00:00`);
	date.setDate(date.getDate() - days + 1);
	return { start: isoDate(date), end: referenceDate };
}
const inRange = (date: string, range: { start: string; end: string }) =>
	date >= range.start && date <= range.end;
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
export function selectDailySummary(
	state: AppState,
	date = isoDate(),
): DailySummary {
	const water = sum(
		state.water.filter((x) => x.date === date).map((x) => x.amountMl),
	);
	const calories = sum(
		state.meals.filter((x) => x.date === date).map((x) => x.calories),
	);
	const steps = state.dailySteps
		? (state.dailySteps.find((x) => x.date === date)?.steps ?? 0)
		: date === isoDate()
			? state.steps
			: 0;
	return {
		water,
		calories,
		steps,
		waterProgress: ratio(water, state.goals.waterMl),
		calorieProgress: ratio(calories, state.goals.calories),
		stepProgress: ratio(steps, state.goals.steps),
	};
}
export function selectProgressSummary(
	state: AppState,
	period: Period,
	referenceDate = isoDate(),
) {
	const days = period === "day" ? 1 : period === "week" ? 7 : 30,
		range = dateRange(days, referenceDate);
	const water = state.water.filter((x) => inRange(x.date, range)),
		meals = state.meals.filter((x) => inRange(x.date, range)),
		activities = state.activities.filter((x) => inRange(x.date, range)),
		steps = (state.dailySteps ?? []).filter((x) => inRange(x.date, range));
	return {
		rings: [
			{
				label: "Passos",
				value: ratio(sum(steps.map((x) => x.steps)) / days, state.goals.steps),
			},
			{
				label: "Água",
				value: ratio(
					sum(water.map((x) => x.amountMl)) / days,
					state.goals.waterMl,
				),
			},
			{
				label: "Calorias",
				value: ratio(
					sum(meals.map((x) => x.calories)) / days,
					state.goals.calories,
				),
			},
		],
		activityMinutes: sum(
			activities.map((x) => (x.durationSeconds ?? x.durationMinutes * 60) / 60),
		),
		contributingDays: new Set(
			[...water, ...meals, ...activities, ...steps].map((x) => x.date),
		).size,
		windowDays: days,
	};
}
export function selectActivityStats(
	state: AppState,
	period: "week" | "month",
	referenceDate = isoDate(),
): ActivityStatistics {
	const range = dateRange(period === "week" ? 7 : 30, referenceDate);
	const activities = state.activities.filter((x) => inRange(x.date, range));
	const current = dateRange(7, referenceDate),
		previousEnd = new Date(`${current.start}T12:00:00`);
	previousEnd.setDate(previousEnd.getDate() - 1);
	const previous = dateRange(7, isoDate(previousEnd));
	const steps = state.dailySteps ?? [];
	const average =
		sum(steps.filter((x) => inRange(x.date, current)).map((x) => x.steps)) / 7;
	const prior =
		sum(steps.filter((x) => inRange(x.date, previous)).map((x) => x.steps)) / 7;
	return {
		period,
		activityCount: activities.length,
		durationSeconds: sum(
			activities.map((x) => x.durationSeconds ?? x.durationMinutes * 60),
		),
		distanceMeters: sum(activities.map((x) => x.distanceKm * 1000)),
		calories: sum(activities.map((x) => x.calories)),
		steps: sum(steps.filter((x) => inRange(x.date, range)).map((x) => x.steps)),
		stepAverage: average,
		previousStepAverage: prior,
		trend: average > prior ? "up" : average < prior ? "down" : "flat",
		trendPercent: prior ? ((average - prior) / prior) * 100 : null,
	};
}
export function selectWeightComparison(
	state: AppState,
	referenceDate = isoDate(),
) {
	const currentRange = dateRange(7, referenceDate),
		end = new Date(`${currentRange.start}T12:00:00`);
	end.setDate(end.getDate() - 1);
	const previousRange = dateRange(7, isoDate(end));
	const daily = [
		...new Map(state.weights.map((x) => [x.date, x])).values(),
	].sort((a, b) => a.date.localeCompare(b.date));
	const current = daily.filter((x) => inRange(x.date, currentRange)),
		previous = daily.filter((x) => inRange(x.date, previousRange));
	const average = (rows: typeof daily) =>
		rows.length ? sum(rows.map((x) => x.weightKg)) / rows.length : null;
	return {
		current,
		previous,
		currentAverage: average(current),
		previousAverage: average(previous),
	};
}

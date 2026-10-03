import { appReducer, initialState } from "./reducer";
import {
	selectDailySummary,
	selectProgressSummary,
	selectActivityStats,
	selectWeightComparison,
	dateRange,
} from "./selectors";

const referenceDate = "2026-09-20";
const meal = {
	id: "meal-shared",
	name: "Jantar",
	date: referenceDate,
	time: "20:00",
	quantity: 350,
	unit: "g" as const,
	calories: 400,
};

const baseState = {
	...initialState,
	water: [],
	meals: [meal],
	activities: [],
	steps: 5000,
	dailySteps: [{ date: referenceDate, steps: 5000 }],
	goals: { ...initialState.goals, calories: 2000, steps: 10000 },
};

describe("seletores compartilhados de calorias", () => {
	test("edição atualiza o resumo diário sem duplicar a refeição", () => {
		const edited = appReducer(baseState, {
			type: "MEAL_SAVE",
			value: { ...meal, calories: 1000 },
		});

		expect(edited.meals).toHaveLength(1);
		expect(selectDailySummary(edited, referenceDate)).toMatchObject({
			calories: 1000,
			calorieProgress: 0.5,
		});
	});

	test.each(["day", "week", "month"] as const)(
		"edição e exclusão recalculam o progresso %s no mesmo estado",
		(period) => {
			const before = selectProgressSummary(baseState, period, referenceDate);
			const edited = appReducer(baseState, {
				type: "MEAL_SAVE",
				value: { ...meal, calories: 1000 },
			});
			const afterEdit = selectProgressSummary(edited, period, referenceDate);
			const deleted = appReducer(edited, {
				type: "MEAL_DELETE",
				id: meal.id,
			});
			const afterDelete = selectProgressSummary(deleted, period, referenceDate);

			expect(before.rings[2].value).toBeCloseTo(
				0.2 / (period === "day" ? 1 : period === "week" ? 7 : 30),
			);
			expect(afterEdit.rings[2].value).toBeCloseTo(
				0.5 / (period === "day" ? 1 : period === "week" ? 7 : 30),
			);
			expect(afterDelete.rings[2].value).toBe(0);
		},
	);

	test("semana e mês usam a média de todos os dias da janela", () => {
		const state = {
			...baseState,
			meals: [
				meal,
				{ ...meal, id: "anterior", date: "2026-09-19", calories: 800 },
			],
		};

		expect(
			selectProgressSummary(state, "week", referenceDate).rings[2].value,
		).toBeCloseTo(0.6 / 7);
		expect(
			selectProgressSummary(state, "month", referenceDate).contributingDays,
		).toBe(2);
	});
});

test("janelas excluem futuro e dados anteriores, incluindo dias sem registros", () => {
	const state = {
		...baseState,
		water: [
			{ id: "w", amountMl: 2500, date: "2026-09-20", time: "10:00" },
			{ id: "old", amountMl: 5000, date: "2026-08-01", time: "10:00" },
			{ id: "future", amountMl: 5000, date: "2026-10-01", time: "10:00" },
		],
	};
	expect(
		selectProgressSummary(state, "week", referenceDate).rings[1].value,
	).toBeCloseTo(1 / 7);
	expect(selectDailySummary(state, "2026-09-19").steps).toBe(0);
	expect(
		selectDailySummary(
			{ ...state, goals: { ...state.goals, waterMl: 0 } },
			referenceDate,
		).waterProgress,
	).toBe(0);
});

test("estatísticas usam 7/30 dias completos e preservam segundos", () => {
	const state = {
		...baseState,
		activities: [
			{
				id: "a",
				type: "run" as const,
				date: referenceDate,
				durationSeconds: 90,
				durationMinutes: 1.5,
				distanceKm: 0.1234,
				calories: 18,
			},
		],
		dailySteps: [
			{ date: referenceDate, steps: 7000 },
			{ date: "2026-09-13", steps: 3500 },
			{ date: "2026-08-01", steps: 50000 },
		],
	};
	expect(selectActivityStats(state, "week", referenceDate)).toMatchObject({
		activityCount: 1,
		durationSeconds: 90,
		stepAverage: 1000,
		previousStepAverage: 500,
		trend: "up",
		trendPercent: 100,
		steps: 7000,
	});
	expect(selectActivityStats(state, "month", referenceDate).steps).toBe(10500);
	expect(
		selectActivityStats({ ...initialState }, "week", referenceDate),
	).toMatchObject({ trend: "flat", trendPercent: null, stepAverage: 0 });
	expect(dateRange(7, "2024-03-01").start).toBe("2024-02-24");
});
test("peso agrupa datas reais e ausência não vira uma pesagem zero", () => {
	const state = {
		...baseState,
		weights: [
			{ id: "old", date: "2026-09-10", weightKg: 80 },
			{ id: "a", date: "2026-09-20", weightKg: 70 },
			{ id: "b", date: "2026-09-20", weightKg: 69 },
			{ id: "c", date: "2026-09-18", weightKg: 71 },
		],
	};
	const result = selectWeightComparison(state, referenceDate);
	expect(result.current.map((x) => x.date)).toEqual([
		"2026-09-18",
		"2026-09-20",
	]);
	expect(result.currentAverage).toBe(70);
	expect(result.previousAverage).toBe(80);
	expect(selectWeightComparison(initialState, referenceDate)).toMatchObject({
		currentAverage: null,
		previousAverage: null,
	});
});

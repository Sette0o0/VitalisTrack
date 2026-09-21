import { appReducer, initialState } from "./app-state";
import { selectDailySummary, selectProgressSummary } from "./selectors";

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

			expect(before.rings[2].value).toBe(0.2);
			expect(afterEdit.rings[2].value).toBe(0.5);
			expect(afterDelete.rings[2].value).toBe(0);
		},
	);

	test("semana e mês usam a média dos dias com refeições", () => {
		const state = {
			...baseState,
			meals: [
				meal,
				{ ...meal, id: "anterior", date: "2026-09-19", calories: 800 },
			],
		};

		expect(
			selectProgressSummary(state, "week", referenceDate).rings[2].value,
		).toBeCloseTo(0.3);
		expect(
			selectProgressSummary(state, "month", referenceDate).contributingDays,
		).toBe(2);
	});
});

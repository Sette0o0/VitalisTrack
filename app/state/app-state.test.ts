import { appReducer, initialState } from "./app-state";

describe("estado da aplicação", () => {
	test("adiciona, edita e exclui consumo de água", () => {
		const added = appReducer(initialState, {
			type: "WATER_ADD",
			value: { amountMl: 250, date: "2026-09-19", time: "10:00" },
		});
		expect(added.water).toHaveLength(initialState.water.length + 1);
		const entry = added.water.at(-1)!;
		const updated = appReducer(added, {
			type: "WATER_UPDATE",
			value: { ...entry, amountMl: 300 },
		});
		expect(updated.water.at(-1)?.amountMl).toBe(300);
		expect(
			appReducer(updated, { type: "WATER_DELETE", id: entry.id }).water,
		).toHaveLength(initialState.water.length);
	});
	test("salva e remove refeição", () => {
		const meal = {
			id: "nova",
			name: "Lanche",
			date: "2026-09-19",
			time: "16:00",
			quantity: 100,
			unit: "g" as const,
			calories: 250,
		};
		const saved = appReducer(initialState, { type: "MEAL_SAVE", value: meal });
		expect(saved.meals.find((x) => x.id === "nova")).toEqual(meal);
		const edited = appReducer(saved, {
			type: "MEAL_SAVE",
			value: { ...meal, calories: 375 },
		});
		expect(edited.meals).toHaveLength(saved.meals.length);
		expect(edited.meals.find((x) => x.id === "nova")?.calories).toBe(375);
		expect(
			appReducer(edited, { type: "MEAL_DELETE", id: "nova" }).meals.find(
				(x) => x.id === "nova",
			),
		).toBeUndefined();
	});
	test("novo peso atualiza histórico e perfil", () => {
		const state = appReducer(initialState, {
			type: "WEIGHT_ADD",
			value: { date: "2026-09-19", weightKg: 67.9 },
		});
		expect(state.profile.weightKg).toBe(67.9);
		expect(state.weights.at(-1)?.weightKg).toBe(67.9);
	});
});

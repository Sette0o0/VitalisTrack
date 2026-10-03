import { appReducer, initialState } from "./reducer";

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

test("edição e exclusão de atividade mantêm um único registro", () => {
	const activity = {
		id: "a",
		type: "run" as const,
		date: "2026-10-03",
		durationMinutes: 1,
		durationSeconds: 60,
		distanceKm: 0.1,
		calories: 10,
	};
	const saved = appReducer(initialState, {
		type: "ACTIVITY_SAVE",
		value: activity,
	});
	const edited = appReducer(saved, {
		type: "ACTIVITY_SAVE",
		value: { ...activity, durationSeconds: 90, durationMinutes: 1.5 },
	});
	expect(edited.activities).toHaveLength(1);
	expect(edited.activities[0].durationSeconds).toBe(90);
	expect(
		appReducer(edited, { type: "ACTIVITY_DELETE", id: "a" }).activities,
	).toEqual([]);
});
test("histórico de passos acumula deltas sem apagar os dias anteriores", () => {
	let state = appReducer(initialState, {
		type: "STEPS_SET",
		date: "2026-10-02",
		value: 100,
	});
	state = appReducer(state, {
		type: "STEPS_INCREMENT",
		date: "2026-10-03",
		value: 20,
	});
	state = appReducer(state, {
		type: "STEPS_INCREMENT",
		date: "2026-10-03",
		value: 30,
	});
	expect(state.dailySteps).toEqual([
		{ date: "2026-10-02", steps: 100 },
		{ date: "2026-10-03", steps: 50 },
	]);
});
test("atualizar metas e perfil preserva registros e permite restaurar o tema", () => {
	let state = appReducer(initialState, { type: "LOGIN" });
	state = appReducer(state, { type: "GOALS", value: { waterMl: 3000 } });
	state = appReducer(state, {
		type: "PROFILE",
		value: { ...state.profile, name: "Pessoa", avatar: "foto.jpg" },
	});
	expect(state.goals.steps).toBe(initialState.goals.steps);
	expect(state.profile.avatar).toBe("foto.jpg");
	state = appReducer(state, { type: "SET_DARK", value: true });
	expect(state.themeMode).toBe("dark");
	state = appReducer(state, {
		type: "SET_THEME",
		value: "system",
		dark: false,
	});
	expect(state.themeMode).toBe("system");
	expect(appReducer(state, { type: "LOGOUT" }).authenticated).toBe(false);
});

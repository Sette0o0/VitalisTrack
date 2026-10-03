import { mutationFor } from "./mutations";
import { appReducer, initialState, type Action } from "./reducer";
const value = {
	id: "a",
	type: "run" as const,
	date: "2026-10-03",
	durationMinutes: 0.25,
	durationSeconds: 15,
	distanceKm: 0.1234,
	calories: 3,
	route: [{ latitude: 0, longitude: 0, timestamp: "2026-10-03T12:00:00Z" }],
};
test("atividade preserva segundos, distância precisa e rota na fila", () => {
	const action: Action = { type: "ACTIVITY_SAVE", value };
	expect(
		mutationFor(action, appReducer(initialState, action))?.payload,
	).toMatchObject({ durationSeconds: 15, route: value.route });
	expect(
		mutationFor(action, appReducer(initialState, action))?.payload
			?.distanceMeters,
	).toBeCloseTo(123.4);
});
test("registro local e mutation usam o mesmo ID gerado", () => {
	for (const action of [
		{
			type: "WATER_ADD",
			value: { amountMl: 500, date: "2026-10-03", time: "08:00" },
		},
		{ type: "WEIGHT_ADD", value: { weightKg: 70.5, date: "2026-10-03" } },
	] as Action[]) {
		const next = appReducer(initialState, action);
		const row = action.type === "WATER_ADD" ? next.water[0] : next.weights[0];
		expect(mutationFor(action, next)?.payload?.id).toBe(row.id);
	}
});
test("passos incrementais enviam o total diário para retries idempotentes", () => {
	const action: Action = {
		type: "STEPS_INCREMENT",
		date: "2026-10-03",
		value: 15,
	};
	const state = appReducer(
		{ ...initialState, dailySteps: [{ date: "2026-10-03", steps: 100 }] },
		action,
	);
	expect(mutationFor(action, state)?.payload).toEqual({
		date: "2026-10-03",
		steps: 115,
	});
});
test("somente alterações de dados geram mutações", () => {
	expect(
		mutationFor({ type: "SET_DARK", value: true }, initialState),
	).toBeNull();
	expect(
		mutationFor({ type: "PROFILE", value: initialState.profile }, initialState)
			?.payload,
	).not.toHaveProperty("email");
	expect(
		mutationFor({ type: "GOALS", value: { waterMl: 3000 } }, initialState)
			?.entity,
	).toBe("goals");
	const meal = {
		id: "m",
		name: "Café",
		date: "2026-10-03",
		time: "08:00",
		unit: "mL" as const,
		quantity: 100,
		calories: 50,
	};
	expect(
		mutationFor({ type: "MEAL_SAVE", value: meal }, initialState)?.entityId,
	).toBe("m");
	expect(
		mutationFor(
			{
				type: "WATER_UPDATE",
				value: { id: "w", amountMl: 500, date: "2026-10-03", time: "08:00" },
			},
			initialState,
		)?.entityId,
	).toBe("w");
	for (const type of [
		"WATER_DELETE",
		"MEAL_DELETE",
		"ACTIVITY_DELETE",
	] as const)
		expect(mutationFor({ type, id: "x" }, initialState)).toMatchObject({
			entityId: "x",
			action: "delete",
		});
});

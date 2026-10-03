import { migrateState } from "./migration";
import { initialState, appReducer } from "./reducer";
import { mutationFor } from "./mutations";
test("migra duração legada e passos sem descartar registros", () => {
	const old = { ...initialState, schemaVersion: undefined, dailySteps: undefined, steps: 120, activities: [{ id: "a", type: "run" as const, date: "2026-10-01", durationMinutes: 2.5, distanceKm: 1, calories: 20 }] };
	const result = migrateState(old, "owner");
	expect(result.activities[0].durationSeconds).toBe(150); expect(result.dailySteps?.[0].steps).toBe(120);
	expect(result.schemaVersion).toBe(2);
});
test("estado de outra conta nunca é restaurado", () => {
	expect(migrateState({ ...initialState, userId: "a", steps: 50 }, "b").steps).toBe(0);
	expect(migrateState(null, "b").userId).toBe("b");
});
test("passos de dias diferentes mantêm seu histórico", () => {
	const first = appReducer(initialState, { type: "STEPS_SET", date: "2026-10-01", value: 100 });
	const second = appReducer(first, { type: "STEPS_SET", date: "2026-10-02", value: 50 });
	expect(second.dailySteps).toHaveLength(2);
	expect(mutationFor({ type: "STEPS_SET", date: "2026-10-01", value: 100 }, first)?.payload?.date).toBe("2026-10-01");
});

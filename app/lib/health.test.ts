import {
	calculateActivityCalories,
	calculateAge,
	calculateBmi,
	calculatePace,
	classifyBmi,
	isEmail,
	weightGoalWeeks,
} from "./health";

describe("cálculos de saúde", () => {
	test("calcula idade respeitando o aniversário", () =>
		expect(calculateAge("2000-10-20", new Date("2026-09-19T12:00:00"))).toBe(
			25,
		));
	test("calcula e classifica IMC", () => {
		const bmi = calculateBmi(68.4, 168);
		expect(bmi).toBeCloseTo(24.23, 1);
		expect(classifyBmi(bmi)).toBe("Normal");
	});
	test("calcula gasto por MET e ritmo", () => {
		expect(calculateActivityCalories("run", 68.4, 30)).toBe(298);
		expect(calculatePace(30, 5)).toBe(6);
	});
	test("prevê semanas apenas para perda com déficit", () => {
		expect(weightGoalWeeks(68, 64, 400)).toBe(11);
		expect(weightGoalWeeks(68, 70, 400)).toBeNull();
		expect(weightGoalWeeks(68, 64, 0)).toBeNull();
	});
	test("valida e-mail", () => {
		expect(isEmail("ana@email.com")).toBe(true);
		expect(isEmail("ana@")).toBe(false);
	});
});

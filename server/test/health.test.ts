import { describe, expect, test } from "vitest";
import {
	calculateActivityCalories,
	calculateBmi,
	calculatePaceSeconds,
	weightGoalWeeks,
} from "../src/lib/health.js";
import {
	calculateAge,
	dateWindow,
	formatDate,
	parseDate,
} from "../src/lib/dates.js";

describe("regras de saúde", () => {
	test("calcula calorias e ritmo", () => {
		expect(calculateActivityCalories("run", 70, 1800)).toBe(305);
		expect(calculatePaceSeconds(5000, 1500)).toBe(300);
		expect(calculatePaceSeconds(0, 100)).toBeNull();
	});
	test("calcula e classifica IMC", () => {
		expect(calculateBmi(70, 175)?.classification).toBe("Normal");
		expect(calculateBmi(90, 175)?.classification).toBe("Sobrepeso");
		expect(calculateBmi(null, 175)).toBeNull();
	});
	test("estima meta de peso", () => {
		expect(weightGoalWeeks(70, 65, 500)).toBeGreaterThan(0);
		expect(weightGoalWeeks(65, 70, 500)).toBeNull();
	});
	test("trata datas e janelas", () => {
		expect(
			calculateAge(parseDate("2000-10-10"), new Date("2026-09-20T00:00:00Z")),
		).toBe(25);
		expect(calculateAge(null)).toBeNull();
		expect(formatDate(dateWindow("week", "2026-09-20").start)).toBe(
			"2026-09-14",
		);
		expect(formatDate(dateWindow("month", "2026-09-20").start)).toBe(
			"2026-08-22",
		);
	});
});

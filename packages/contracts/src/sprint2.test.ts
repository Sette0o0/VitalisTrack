import { describe, expect, test } from "vitest";
import {
	basalCalories,
	fromDisplayDistance,
	fromDisplayHeight,
	fromDisplayWeight,
	toDisplayDistance,
	toDisplayHeight,
	toDisplayWeight,
	foodNutrition,
	healthProfileCreateSchema,
	nutritionProfileInputSchema,
	mealInputSchema,
	type FoodProduct,
} from "./index";
describe("Sprint 2 shared business rules", () => {
	test("original Harris-Benedict coefficients and missing inputs", () => {
		expect(basalCalories({ weightKg: 70, heightCm: 175, age: 30, gender: "Masculino" })).toBe(1702);
		expect(basalCalories({ weightKg: 60, heightCm: 165, age: 30, gender: "Feminino" })).toBe(1394);
		for (const input of [
			{ gender: "Outro", age: 30, weightKg: 70, heightCm: 175 },
			{ gender: "Masculino", age: null, weightKg: 70, heightCm: 175 },
			{ gender: "Feminino", age: 30, weightKg: null, heightCm: 175 },
		])
			expect(basalCalories(input)).toBeNull();
	});
	test("imperial round trips preserve canonical measures", () => {
		for (const value of [20, 68.423456, 500])
			expect(fromDisplayWeight(toDisplayWeight(value, "imperial"), "imperial")).toBeCloseTo(
				value,
				12,
			);
		for (const value of [80, 170.54321, 260])
			expect(fromDisplayHeight(toDisplayHeight(value, "imperial"), "imperial")).toBeCloseTo(
				value,
				12,
			);
		expect(fromDisplayDistance(toDisplayDistance(42.195, "imperial"), "imperial")).toBeCloseTo(
			42.195,
			12,
		);
		expect(toDisplayWeight(70, "metric")).toBe(70);
	});
	test("food snapshots scale missing nutrients without manufacturing zeros", () => {
		const product: FoodProduct = {
			code: "12345678",
			name: "Teste",
			brand: null,
			basisUnit: "g",
			source: "openfoodfacts",
			fetchedAt: new Date().toISOString(),
			values: { calories: 200, proteins: 10, carbohydrates: null, fat: 5 },
		};
		expect(foodNutrition(product, 50, "g")).toEqual({
			calories: 100,
			proteins: 5,
			carbohydrates: null,
			fat: 2.5,
		});
		expect(() => foodNutrition(product, 50, "mL")).toThrow();
		expect(() => foodNutrition(product, 0, "g")).toThrow();
	});
	test("profiles and nutritional goals validate real input", () => {
		expect(healthProfileCreateSchema.safeParse({ id: "x", name: "A" }).success).toBe(false);
		expect(
			nutritionProfileInputSchema.safeParse({
				objective: "gain",
				restrictions: [],
				preferences: ["vegetariano"],
			}).success,
		).toBe(true);
		expect(
			nutritionProfileInputSchema.safeParse({
				objective: "invalid",
				restrictions: [],
				preferences: [],
			}).success,
		).toBe(false);
		expect(
			mealInputSchema.safeParse({
				id: crypto.randomUUID(),
				name: "Almoço",
				date: "2026-10-26",
				time: "12:00",
				quantity: 100,
				unit: "g",
				calories: 100,
			}).success,
		).toBe(true);
	});
});

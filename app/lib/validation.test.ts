import { parseDecimal, parseInput } from "./validation";
import {
	waterInputSchema,
	mealInputSchema,
	registerSchema,
	profileUpdateSchema,
	activityInputSchema,
	goalsUpdateSchema,
} from "@vitalis/contracts";
const id = "ae1583fb-ae5a-48dd-8178-63e80a20fdd8";
test.each([
	["70,5", 70.5],
	[" 12.5 ", 12.5],
	["0", 0],
])("aceita decimal %s", (input, expected) =>
	expect(parseDecimal(String(input))).toBe(expected),
);
test.each(["", "1,2,3", "Infinity", "1e3", "12mL", "1.000,50"])(
	"rejeita entrada ambígua %s",
	(value) => expect(parseDecimal(value)).toBeNaN(),
);
test("água exige inteiro positivo, data real e horário válido", () => {
	const valid = { id, amountMl: 500, date: "2024-02-29", time: "23:59" };
	expect(parseInput(waterInputSchema, valid)).toEqual(valid);
	for (const invalid of [
		{ amountMl: 0 },
		{ amountMl: 0.5 },
		{ date: "2026-02-29" },
		{ date: "2026-04-31" },
		{ time: "24:00" },
	])
		expect(() =>
			parseInput(waterInputSchema, { ...valid, ...invalid }),
		).toThrow("inválido");
});
test("quantidade decimal de alimento é aceita, calorias fracionárias não", () => {
	const meal = {
		id,
		name: "Café",
		date: "2026-10-03",
		time: "08:00",
		quantity: 100.5,
		unit: "mL",
		calories: 80,
	};
	expect(parseInput(mealInputSchema, meal).quantity).toBe(100.5);
	expect(() =>
		parseInput(mealInputSchema, { ...meal, calories: 80.5 }),
	).toThrow();
});
test("cadastro exige confirmação, normaliza e-mail e senha mínima", () => {
	const account = {
		name: "Rafael",
		email: "RAFAEL@example.com",
		password: "12345678",
		passwordConfirmation: "12345678",
	};
	expect(parseInput(registerSchema, account).email).toBe("rafael@example.com");
	expect(() =>
		parseInput(registerSchema, { ...account, password: "1234567" }),
	).toThrow();
	expect(() =>
		parseInput(registerSchema, {
			...account,
			passwordConfirmation: "87654321",
		}),
	).toThrow();
});
test("perfil rejeita nascimento futuro, e-mail e medidas incompatíveis", () => {
	expect(() =>
		parseInput(profileUpdateSchema, { birthDate: "2999-01-01" }),
	).toThrow();
	expect(() => parseInput(profileUpdateSchema, { heightCm: 170.5 })).toThrow();
	expect(() => parseInput(profileUpdateSchema, { weightKg: 10 })).toThrow();
	expect(() =>
		parseInput(profileUpdateSchema, { email: "outro@example.com" }),
	).toThrow();
});
test("atividades exigem segundos positivos e metas inteiras", () => {
	expect(() =>
		parseInput(activityInputSchema, {
			id,
			type: "run",
			date: "2026-10-03",
			durationSeconds: 0,
			distanceMeters: 100,
		}),
	).toThrow();
	expect(() => parseInput(goalsUpdateSchema, { calories: 2000.5 })).toThrow();
	expect(() => parseInput(goalsUpdateSchema, {})).toThrow();
});

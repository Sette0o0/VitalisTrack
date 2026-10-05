import type { ZodType } from "zod";
export function parseDecimal(value: string) {
	const input = value.trim();
	// Brazilian thousands and decimal separators; accept an ungrouped dot for older input.
	const grouped = /^[+-]?\d{1,3}(?:\.\d{3})+(?:,\d+)?$/;
	const plain = /^[+-]?\d+(?:[.,]\d+)?$/;
	if (!grouped.test(input) && !plain.test(input)) return NaN;
	const normalized = (grouped.test(input) ? input.replace(/\./g, "") : input)
		.replace(",", ".");
	const result = Number(normalized);
	return Number.isFinite(result) ? result : NaN;
}
const labels: Record<string, string> = {
	name: "Nome",
	email: "E-mail",
	password: "Senha (mínimo de 8 caracteres)",
	passwordConfirmation: "Confirmação de senha",
	birthDate: "Nascimento",
	weightKg: "Peso",
	heightCm: "Altura",
	date: "Data",
	time: "Horário",
	amountMl: "Quantidade em mL",
	quantity: "Quantidade",
	calories: "Calorias",
	durationSeconds: "Duração",
	distanceMeters: "Distância",
	dailyDeficit: "Déficit diário",
	mealCalories: "Limite por refeição",
};
export function parseInput<T>(schema: ZodType<T>, value: unknown): T {
	const result = schema.safeParse(value);
	if (!result.success)
		throw new Error(
			`${labels[String(result.error.issues[0].path[0])] ?? "Dados"}: valor inválido. Revise o campo informado.`,
		);
	return result.data;
}

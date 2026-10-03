import type { ZodType } from "zod";
export function parseDecimal(value: string) {
	const normalized = value.trim().replace(",", ".");
	return /^[+-]?\d+(?:\.\d+)?$/.test(normalized) ? Number(normalized) : NaN;
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

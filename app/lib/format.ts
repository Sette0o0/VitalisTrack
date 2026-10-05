/** Brazilian presentation; dates and numbers keep their API types in storage. */
export function formatDate(value: string) {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!match) return value ? "Data inválida" : "Não informada";
	const [, year, month, day] = match;
	const date = new Date(`${value}T12:00:00`);
	if (
		date.getFullYear() !== Number(year) ||
		date.getMonth() + 1 !== Number(month) ||
		date.getDate() !== Number(day)
	) return "Data inválida";
	return `${day}/${month}/${year}`;
}

export function formatNumber(value: number, fractionDigits?: number) {
	if (!Number.isFinite(value)) return "—";
	// Older Android ICU exposes floating-point noise when asked for 20 places.
	// Request only the decimal places present in the number's representation.
	const [coefficient, exponent = "0"] = String(value).split("e");
	const decimals = Math.max(
		0,
		(coefficient.split(".")[1]?.length ?? 0) - Number(exponent),
	);
	return value.toLocaleString("pt-BR", {
		minimumFractionDigits: fractionDigits ?? 0,
		maximumFractionDigits: fractionDigits ?? Math.min(decimals, 20),
	});
}

/** No grouping or rounding in editable fields, so reopening never changes a value. */
export function decimalInput(value: number | undefined | null) {
	return value == null ? "" : String(value).replace(".", ",");
}

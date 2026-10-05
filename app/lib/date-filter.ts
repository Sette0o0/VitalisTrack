import { isoDate } from "./health";
import { formatDate } from "./format";

export type DateRange = { start: string; end: string };

export function recentDateRange(days: number, today = isoDate()): DateRange {
	const start = new Date(`${today}T12:00:00`);
	start.setDate(start.getDate() - days + 1);
	return { start: isoDate(start), end: today };
}

export function validDateRange(range: DateRange) {
	return formatDate(range.start) !== "Data inválida" && Boolean(range.start) &&
		formatDate(range.end) !== "Data inválida" && Boolean(range.end) &&
		range.start <= range.end;
}

export function filterByDateRange<T extends { date: string }>(
	rows: T[], range: DateRange | null,
) {
	if (!range) return [...rows];
	if (!validDateRange(range)) return [];
	return rows.filter((row) => row.date >= range.start && row.date <= range.end);
}

export function brazilianDateInput(value: string) {
	const digits = value.replace(/\D/g, "").slice(0, 8);
	return digits.slice(0, 2) +
		(digits.length > 2 ? `/${digits.slice(2, 4)}` : "") +
		(digits.length > 4 ? `/${digits.slice(4)}` : "");
}

export function parseBrazilianDate(value: string): string | null {
	const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
	if (!match) return null;
	const [, day, month, year] = match;
	const iso = `${year}-${month}-${day}`;
	return formatDate(iso) === value ? iso : null;
}

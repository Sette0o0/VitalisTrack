export const parseDate = (value: string) => new Date(`${value}T00:00:00.000Z`);
export const formatDate = (value: Date) => value.toISOString().slice(0, 10);
export const iso = (value: Date | null) => value?.toISOString() ?? null;

export function calculateAge(birthDate: Date | null, now = new Date(), timeZone = "UTC") {
	if (!birthDate) return null;
	const today = parseDate(calendarDate(timeZone, now));
	const age = today.getUTCFullYear() - birthDate.getUTCFullYear();
	const birthdayPending =
		today.getUTCMonth() < birthDate.getUTCMonth() ||
		(today.getUTCMonth() === birthDate.getUTCMonth() &&
			today.getUTCDate() < birthDate.getUTCDate());
	return age - Number(birthdayPending);
}

export function dateWindow(
	period: "day" | "week" | "month",
	reference: string,
) {
	const end = parseDate(reference);
	const start = new Date(end);
	start.setUTCDate(
		start.getUTCDate() - (period === "day" ? 0 : period === "week" ? 6 : 29),
	);
	return { start, end };
}
import { calendarDate } from "@vitalis/contracts";

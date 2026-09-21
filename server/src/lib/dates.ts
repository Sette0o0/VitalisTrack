export const parseDate = (value: string) => new Date(`${value}T00:00:00.000Z`);
export const formatDate = (value: Date) => value.toISOString().slice(0, 10);
export const iso = (value: Date | null) => value?.toISOString() ?? null;

export function calculateAge(birthDate: Date | null, now = new Date()) {
	if (!birthDate) return null;
	const age = now.getUTCFullYear() - birthDate.getUTCFullYear();
	const birthdayPending =
		now.getUTCMonth() < birthDate.getUTCMonth() ||
		(now.getUTCMonth() === birthDate.getUTCMonth() &&
			now.getUTCDate() < birthDate.getUTCDate());
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

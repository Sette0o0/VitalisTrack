const MET = { walk: 3.5, run: 8.3, cycling: 7.5 } as const;

export function calculateActivityCalories(
	type: keyof typeof MET,
	weightKg: number,
	durationSeconds: number,
) {
	return Math.round(
		((MET[type] * 3.5 * weightKg) / 200) * (durationSeconds / 60),
	);
}

export function calculatePaceSeconds(
	distanceMeters: number,
	durationSeconds: number,
) {
	return distanceMeters > 0
		? Math.round(durationSeconds / (distanceMeters / 1000))
		: null;
}

export function calculateBmi(weightKg: number | null, heightCm: number | null) {
	if (!weightKg || !heightCm) return null;
	const value = weightKg / (heightCm / 100) ** 2;
	const classification =
		value < 18.5
			? "Abaixo do peso"
			: value < 25
				? "Normal"
				: value < 30
					? "Sobrepeso"
					: "Obesidade";
	return { value, classification };
}

export function weightGoalWeeks(
	current: number | null,
	goal: number,
	dailyDeficit: number,
) {
	if (!current || goal >= current || dailyDeficit <= 0) return null;
	return Math.ceil((current - goal) / ((dailyDeficit * 7) / 7700));
}

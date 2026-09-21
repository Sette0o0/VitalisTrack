import type { ActivityType } from "@/state/types";

export const MET: Record<ActivityType, number> = {
	walk: 3.5,
	run: 8.3,
	cycling: 7.5,
};
export const calculateAge = (birthDate: string, now = new Date()) => {
	const birth = new Date(`${birthDate}T12:00:00`);
	let age = now.getFullYear() - birth.getFullYear();
	const beforeBirthday =
		now.getMonth() < birth.getMonth() ||
		(now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
	return age - Number(beforeBirthday);
};
export const calculateBmi = (weightKg: number, heightCm: number) =>
	weightKg / (heightCm / 100) ** 2;
export const classifyBmi = (bmi: number) =>
	bmi < 18.5
		? "Abaixo do peso"
		: bmi < 25
			? "Normal"
			: bmi < 30
				? "Sobrepeso"
				: "Obesidade";
export const calculateActivityCalories = (
	type: ActivityType,
	weightKg: number,
	durationMinutes: number,
) => Math.round(((MET[type] * 3.5 * weightKg) / 200) * durationMinutes);
export const calculatePace = (durationMinutes: number, distanceKm: number) =>
	distanceKm > 0 ? durationMinutes / distanceKm : 0;
export const formatPace = (pace: number) =>
	`${Math.floor(pace)}'${String(Math.round((pace % 1) * 60)).padStart(2, "0")}\"`;
export const weightGoalWeeks = (
	current: number,
	goal: number,
	dailyDeficit: number,
) =>
	goal < current && dailyDeficit > 0
		? Math.ceil((current - goal) / ((dailyDeficit * 7) / 7700))
		: null;
export const isEmail = (value: string) =>
	/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
export const isoDate = (date = new Date()) =>
	`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const newId = (_prefix?: string) =>
	"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (value) => {
		const random = Math.floor(Math.random() * 16);
		return (value === "x" ? random : (random & 0x3) | 0x8).toString(16);
	});

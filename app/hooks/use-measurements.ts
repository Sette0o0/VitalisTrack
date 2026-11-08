import {
	fromDisplayDistance,
	fromDisplayHeight,
	fromDisplayWeight,
	toDisplayDistance,
	toDisplayHeight,
	toDisplayWeight,
} from "@vitalis/contracts";
import { useAppState } from "@/state/app-state";
import { formatNumber } from "@/lib/format";
export function useMeasurements() {
	const { state } = useAppState();
	const units = state.unitSystem ?? "metric";
	return {
		weightUnit: units === "imperial" ? "lb" : "kg",
		heightUnit: units === "imperial" ? "in" : "cm",
		distanceUnit: units === "imperial" ? "mi" : "km",
		weight: (kg: number) => toDisplayWeight(kg, units),
		weightInput: (value: number) => fromDisplayWeight(value, units),
		height: (cm: number) => toDisplayHeight(cm, units),
		heightInput: (value: number) => fromDisplayHeight(value, units),
		distance: (km: number) => toDisplayDistance(km, units),
		distanceInput: (value: number) => fromDisplayDistance(value, units),
		weightText: (kg: number, digits = 1) =>
			`${formatNumber(toDisplayWeight(kg, units), digits)} ${units === "imperial" ? "lb" : "kg"}`,
		distanceText: (km: number, digits = 2) =>
			`${formatNumber(toDisplayDistance(km, units), digits)} ${units === "imperial" ? "mi" : "km"}`,
	};
}

import { deviceTimeZone, type SyncMutation } from "@vitalis/contracts";
import { newId, isoDate } from "@/lib/health";
import type { AppState, LocalMutation } from "./types";
import type { Action } from "./reducer";
const createMutation = (
	entity: SyncMutation["entity"],
	action: SyncMutation["action"],
	payload?: Record<string, unknown>,
	entityId?: string,
): SyncMutation => ({
	mutationId: newId(),
	entity,
	action,
	payload,
	entityId,
	clientUpdatedAt: new Date().toISOString(),
	...(entity === "profile" ? { clientTimeZone: deviceTimeZone() } : {}),
});
export function mutationFor(
	action: Action,
	next: AppState,
): LocalMutation | null {
	switch (action.type) {
		case "AVATAR_SAVE":
			return { mutationId: action.mutationId, entity: "avatar", action: "upsert", payload: { uri: action.uri, mimeType: action.mimeType }, clientUpdatedAt: new Date().toISOString() };
		case "PROFILE": {
			const { name, birthDate, weightKg, heightCm, gender } = action.value;
			return createMutation("profile", "upsert", {
				name,
				birthDate,
				weightKg,
				heightCm,
				gender,
			});
		}
		case "GOALS":
			return createMutation(
				"goals",
				"upsert",
				action.value as Record<string, unknown>,
			);
		case "WATER_ADD":
			return createMutation(
				"water",
				"upsert",
				next.water.at(-1) as unknown as Record<string, unknown>,
			);
		case "WATER_UPDATE":
			return createMutation(
				"water",
				"upsert",
				action.value as unknown as Record<string, unknown>,
				action.value.id,
			);
		case "WATER_DELETE":
			return createMutation("water", "delete", undefined, action.id);
		case "MEAL_SAVE":
			return createMutation(
				"meal",
				"upsert",
				action.value as unknown as Record<string, unknown>,
				action.value.id,
			);
		case "MEAL_DELETE":
			return createMutation("meal", "delete", undefined, action.id);
		case "ACTIVITY_SAVE":
			return createMutation(
				"activity",
				"upsert",
				{
					id: action.value.id,
					type: action.value.type,
					date: action.value.date,
					durationSeconds:
						action.value.durationSeconds ??
						Math.round(action.value.durationMinutes * 60),
					distanceMeters: action.value.distanceKm * 1000,
					route: action.value.route ?? [],
				},
				action.value.id,
			);
		case "ACTIVITY_DELETE":
			return createMutation("activity", "delete", undefined, action.id);
		case "WEIGHT_ADD":
			return createMutation(
				"weight",
				"upsert",
				next.weights.at(-1) as unknown as Record<string, unknown>,
			);
		case "STEPS_INCREMENT":
		case "STEPS_SET":
			return createMutation("steps", "upsert", {
				date: action.date ?? isoDate(),
				steps:
					next.dailySteps?.find(
						(row) => row.date === (action.date ?? isoDate()),
					)?.steps ?? action.value,
			});
		default:
			return null;
	}
}

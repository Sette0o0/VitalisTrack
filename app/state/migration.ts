import { isoDate } from "@/lib/health";
import { initialState } from "./reducer";
import type { AppState } from "./types";

export function migrateState(saved: Partial<AppState> | null, userId: string): AppState {
	if (!saved || (saved.userId && saved.userId !== userId)) return { ...initialState, userId };
	return {
		...initialState, ...saved, userId, schemaVersion: 2,
		dailySteps: saved.dailySteps ?? (saved.steps ? [{ date: isoDate(), steps: saved.steps }] : []),
		activities: (saved.activities ?? []).map((row) => ({ ...row, durationSeconds: row.durationSeconds ?? Math.round(row.durationMinutes * 60) })),
	};
}

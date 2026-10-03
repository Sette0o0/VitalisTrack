import { activityTypeSchema, routePointSchema } from "@vitalis/contracts";
import { isoDate, newId } from "./health";
import type { ActivityType, Activity } from "@/state/types";
export type Point = NonNullable<Activity["route"]>[number];
export type Workout = {
	version: 2;
	id: string;
	type: ActivityType;
	date: string;
	elapsedMs: number;
	paused: boolean;
	route: Point[];
	segmentStarts: number[];
	distance: number;
	lastTick: number;
	previousPoint: Point | null;
};
export const createWorkout = (
	type: ActivityType,
	now = Date.now(),
): Workout => ({
	version: 2,
	id: newId(),
	type,
	date: isoDate(new Date(now)),
	elapsedMs: 0,
	paused: false,
	route: [],
	segmentStarts: [0],
	distance: 0,
	lastTick: now,
	previousPoint: null,
});
export function restoreWorkout(
	raw: string | null,
	type: ActivityType,
	now = Date.now(),
): Workout {
	if (!raw) return createWorkout(type, now);
	try {
		const saved = JSON.parse(raw);
		if (
			!activityTypeSchema.safeParse(saved.type).success ||
			!Array.isArray(saved.route) ||
			!saved.route.every((p: unknown) => routePointSchema.safeParse(p).success)
		)
			return createWorkout(type, now);
		// Restored sessions start paused: movement while the process was absent is unknown.
		return {
			...createWorkout(saved.type, now),
			...saved,
			version: 2,
			id: saved.id ?? newId(),
			date: saved.date ?? isoDate(new Date(now)),
			elapsedMs: saved.elapsedMs ?? (saved.seconds ?? 0) * 1000,
			distance: Math.max(0, saved.distance ?? 0),
			segmentStarts: saved.segmentStarts ?? [0],
			paused: true,
			previousPoint: null,
			lastTick: now,
		};
	} catch {
		return createWorkout(type, now);
	}
}
export function tickWorkout(workout: Workout, now = Date.now()): Workout {
	return {
		...workout,
		elapsedMs:
			workout.elapsedMs +
			(workout.paused ? 0 : Math.max(0, now - workout.lastTick)),
		lastTick: now,
	};
}
export function pauseWorkout(
	workout: Workout,
	paused: boolean,
	now = Date.now(),
): Workout {
	return { ...tickWorkout(workout, now), paused, previousPoint: null };
}
const radians = (x: number) => (x * Math.PI) / 180;
export function distanceMeters(a: Point, b: Point) {
	const value =
		Math.sin(radians(b.latitude - a.latitude) / 2) ** 2 +
		Math.cos(radians(a.latitude)) *
			Math.cos(radians(b.latitude)) *
			Math.sin(radians(b.longitude - a.longitude) / 2) ** 2;
	return (
		6_371_000 *
		2 *
		Math.atan2(Math.sqrt(value), Math.sqrt(Math.max(0, 1 - value)))
	);
}
export function recordPoint(workout: Workout, point: Point): Workout {
	if (
		workout.paused ||
		(point.accuracy != null && point.accuracy > 50) ||
		!routePointSchema.safeParse(point).success
	)
		return workout;
	if (
		workout.previousPoint &&
		point.timestamp <= workout.previousPoint.timestamp
	)
		return workout;
	const starts =
		!workout.previousPoint && workout.route.length
			? [...workout.segmentStarts, workout.route.length]
			: workout.segmentStarts;
	return {
		...workout,
		route: [...workout.route, point],
		segmentStarts: starts,
		distance:
			workout.distance +
			(workout.previousPoint
				? distanceMeters(workout.previousPoint, point)
				: 0),
		previousPoint: point,
	};
}
export function routeSegments(workout: Workout) {
	return workout.segmentStarts.map((start, i) =>
		workout.route.slice(start, workout.segmentStarts[i + 1]),
	);
}

import {
	createWorkout,
	restoreWorkout,
	tickWorkout,
	pauseWorkout,
	recordPoint,
	distanceMeters,
	routeSegments,
} from "./workout";
const point = (latitude: number, second: number, accuracy = 5) => ({
	latitude,
	longitude: 0,
	accuracy,
	timestamp: new Date(second * 1000).toISOString(),
});
test("restaura o treino inteiro antes de continuar e migra segundos legados", () => {
	let workout = tickWorkout(createWorkout("run", 0), 15_000);
	workout = recordPoint(workout, point(0, 1));
	const restored = restoreWorkout(JSON.stringify(workout), "walk", 30_000);
	expect(restored).toMatchObject({
		id: workout.id,
		type: "run",
		elapsedMs: 15000,
		route: workout.route,
		paused: true,
		previousPoint: null,
	});
	expect(tickWorkout(restored, 40_000).elapsedMs).toBe(15000);
	expect(
		restoreWorkout(
			JSON.stringify({ type: "run", seconds: 31, route: [], distance: 100 }),
			"run",
		).elapsedMs,
	).toBe(31000);
	expect(restoreWorkout("invalid", "walk").type).toBe("walk");
});
test("pausa exclui tempo e deslocamento, retoma com novo segmento", () => {
	let w = createWorkout("run", 0);
	w = recordPoint(w, point(0, 1));
	w = recordPoint(w, point(0.001, 2));
	w = pauseWorkout(w, true, 10_000);
	const before = w.distance;
	expect(recordPoint(w, point(1, 3))).toBe(w);
	w = pauseWorkout(w, false, 60_000);
	w = recordPoint(w, point(1, 61));
	expect(w.distance).toBe(before);
	w = recordPoint(w, point(1.001, 62));
	expect(w.distance).toBeCloseTo(222.39, 1);
	expect(tickWorkout(w, 65_000).elapsedMs).toBe(15000);
	expect(routeSegments(w).map((x) => x.length)).toEqual([2, 2]);
});
test("ignora localização imprecisa, inválida e fora de ordem", () => {
	let w = recordPoint(createWorkout("cycling"), point(0, 2));
	for (const p of [point(1, 3, 100), point(100, 4), point(1, 1)])
		expect(recordPoint(w, p)).toBe(w);
	expect(distanceMeters(point(0, 0), point(0, 1))).toBe(0);
	expect(restoreWorkout(null, "run").elapsedMs).toBe(0);
});

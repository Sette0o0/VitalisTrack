import { createWorkout, pauseWorkout, recordPoint } from "./workout";
import { workoutMapData } from "./workout-map";

const point = (longitude: number, latitude: number, seconds: number) => ({
	longitude,
	latitude,
	accuracy: 5,
	timestamp: new Date(seconds * 1000).toISOString(),
});

test("converte GPS para longitude/latitude sem ligar deslocamentos feitos na pausa", () => {
	let workout = createWorkout("run", 0);
	workout = recordPoint(workout, point(-38.52, -3.73, 1));
	workout = recordPoint(workout, point(-38.521, -3.731, 2));
	workout = pauseWorkout(workout, true, 3000);
	workout = recordPoint(workout, point(-38.6, -3.8, 4));
	workout = pauseWorkout(workout, false, 5000);
	workout = recordPoint(workout, point(-38.53, -3.74, 6));
	workout = recordPoint(workout, point(-38.531, -3.741, 7));
	const data = workoutMapData(workout);
	expect(data.lines.features.map((feature) => feature.geometry.coordinates)).toEqual([
		[[-38.52, -3.73], [-38.521, -3.731]],
		[[-38.53, -3.74], [-38.531, -3.741]],
	]);
	expect(data.markers.features.map((feature) => feature.geometry.coordinates)).toEqual([
		[-38.52, -3.73], [-38.531, -3.741],
	]);
});

test("um treino vazio ou com um ponto não produz linha inválida", () => {
	const empty = createWorkout("walk", 0);
	expect(workoutMapData(empty)).toEqual({
		lines: { type: "FeatureCollection", features: [] },
		markers: { type: "FeatureCollection", features: [] },
	});
	const single = workoutMapData(recordPoint(empty, point(-38.52, -3.73, 1)));
	expect(single.lines.features).toHaveLength(0);
	expect(single.markers.features.every((feature) => feature.geometry.coordinates[0] === -38.52)).toBe(true);
});

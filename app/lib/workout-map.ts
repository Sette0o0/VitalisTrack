import type { StyleSpecification } from "@maplibre/maplibre-react-native";
import type { FeatureCollection, LineString, Point as GeoPoint } from "geojson";
import { routeSegments, type Workout } from "./workout";

export const osmStyle: StyleSpecification = {
	version: 8,
	sources: {
		osm: {
			type: "raster",
			tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
			tileSize: 256,
			maxzoom: 19,
			attribution:
				'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
		},
	},
	layers: [{ id: "osm", type: "raster", source: "osm" }],
};

export function workoutMapData(workout: Workout) {
	const lines: FeatureCollection<LineString> = {
		type: "FeatureCollection",
		features: routeSegments(workout)
			.filter((segment) => segment.length > 1)
			.map((segment) => ({
				type: "Feature",
				properties: {},
				geometry: {
					type: "LineString",
					coordinates: segment.map((point) => [point.longitude, point.latitude]),
				},
			})),
	};
	const markers: FeatureCollection<GeoPoint> = {
		type: "FeatureCollection",
		features: workout.route.length
			? [workout.route[0], workout.route[workout.route.length - 1]].map(
					(point, index) => ({
						type: "Feature",
						properties: { position: index === 0 ? "start" : "current" },
						geometry: {
							type: "Point",
							coordinates: [point.longitude, point.latitude],
						},
					}),
				)
			: [],
	};
	return { lines, markers };
}

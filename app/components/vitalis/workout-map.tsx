import {
	Camera,
	GeoJSONSource,
	Layer,
	Map,
	TransformRequestManager,
	type CameraRef,
} from "@maplibre/maplibre-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { Text, TouchableRipple } from "react-native-paper";
import { useAppTheme } from "@/hooks/use-app-theme";
import { osmStyle, workoutMapData } from "@/lib/workout-map";
import type { Workout } from "@/lib/workout";

// Identify the app to OSM before any tile request. MapLibre's HTTP cache honors
// server cache headers; only visible tiles are requested, with no offline packs.
TransformRequestManager.addHeader({
	id: "vitalis-osm-user-agent",
	match: "^https://tile\\.openstreetmap\\.org/",
	name: "User-Agent",
	value: "VitalisTrack/1.0 (com.vitalistrack.app)",
});

export function WorkoutMap({ workout }: { workout: Workout }) {
	const theme = useAppTheme();
	const camera = useRef<CameraRef>(null);
	const [failed, setFailed] = useState(false);
	const { lines, markers } = useMemo(() => workoutMapData(workout), [workout]);
	const latest = workout.route[workout.route.length - 1];
	useEffect(() => {
		if (latest)
			camera.current?.easeTo({
				center: [latest.longitude, latest.latitude],
				zoom: 16,
				duration: 500,
			});
	}, [latest]);
	return (
		<View style={styles.container}>
			<Map
				style={styles.map}
				mapStyle={osmStyle}
				androidView="texture"
				attribution={false}
				logo={false}
				compass={false}
				onDidFailLoadingMap={() => setFailed(true)}
				onDidFinishLoadingMap={() => setFailed(false)}
			>
				<Camera
					ref={camera}
					maxZoom={19}
					initialViewState={{
						center: latest
							? [latest.longitude, latest.latitude]
							: [-38.5267, -3.7319],
						zoom: 16,
					}}
				/>
				<GeoJSONSource id="workout-route" data={lines}>
					<Layer
						id="workout-route-line"
						type="line"
						layout={{ "line-cap": "round", "line-join": "round" }}
						paint={{ "line-color": theme.primary, "line-width": 6 }}
					/>
				</GeoJSONSource>
				<GeoJSONSource id="workout-markers" data={markers}>
					<Layer
						id="workout-marker-circles"
						type="circle"
						paint={{
							"circle-radius": 7,
							"circle-color": [
								"match", ["get", "position"], "start", "#198754", "#1565c0",
							],
							"circle-stroke-color": "#ffffff",
							"circle-stroke-width": 2,
						}}
					/>
				</GeoJSONSource>
			</Map>
			{failed && (
				<Text
					style={[styles.error, { backgroundColor: theme.surface, color: theme.onSurface }]}
					accessibilityLiveRegion="polite"
				>
					Mapa indisponível. O GPS continua registrando a rota.
				</Text>
			)}
			<TouchableRipple
				style={[styles.attribution, { backgroundColor: theme.surface }]}
				accessibilityRole="link"
				accessibilityLabel="Créditos do OpenStreetMap"
				onPress={() => void Linking.openURL("https://www.openstreetmap.org/copyright")}
			>
				<Text variant="labelSmall">© OpenStreetMap contributors</Text>
			</TouchableRipple>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { height: 240, borderRadius: 24, overflow: "hidden" },
	map: { flex: 1 },
	attribution: {
		position: "absolute",
		bottom: 0,
		right: 0,
		minHeight: 48,
		paddingHorizontal: 12,
		justifyContent: "center",
		borderTopLeftRadius: 12,
	},
	error: { position: "absolute", top: 8, left: 8, right: 8, padding: 8, borderRadius: 8 },
});

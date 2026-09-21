import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { Header, Screen } from "@/components/vitalis/ui";
import type { ThemeTokens } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { calculatePace, formatPace, isoDate } from "@/lib/health";
import { getValue, setValue } from "@/lib/local-database";
import { useAppState } from "@/state/app-state";
import type { ActivityType } from "@/state/types";

type Point = {
	latitude: number;
	longitude: number;
	altitude?: number | null;
	accuracy?: number | null;
	timestamp: string;
};
const radians = (value: number) => (value * Math.PI) / 180;
function distanceMeters(a: Point, b: Point) {
	const earth = 6_371_000,
		dLat = radians(b.latitude - a.latitude),
		dLon = radians(b.longitude - a.longitude);
	const value =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(radians(a.latitude)) *
			Math.cos(radians(b.latitude)) *
			Math.sin(dLon / 2) ** 2;
	return earth * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export default function WorkoutScreen() {
	const theme = useAppTheme(),
		styles = useMemo(() => createStyles(theme), [theme]);
	const params = useLocalSearchParams<{ type?: ActivityType }>();
	const type = params.type ?? "run";
	const { addActivity } = useAppState();
	const [seconds, setSeconds] = useState(0),
		[paused, setPaused] = useState(false);
	const [route, setRoute] = useState<Point[]>([]),
		[distance, setDistance] = useState(0);
	const [gpsError, setGpsError] = useState("");
	const map = useRef<MapView>(null);

	useEffect(() => {
		void (async () => {
			const saved = await getValue("active-workout");
			if (!saved) return;
			try {
				const value = JSON.parse(saved);
				if (value.type === type) {
					setSeconds(value.seconds ?? 0);
					setDistance(value.distance ?? 0);
					setRoute(value.route ?? []);
					setPaused(Boolean(value.paused));
				}
			} catch {
				/* estado incompleto é ignorado */
			}
		})();
	}, [type]);
	useEffect(() => {
		void setValue(
			"active-workout",
			JSON.stringify({ type, seconds, paused, route, distance }),
		);
	}, [type, seconds, paused, route, distance]);
	useEffect(() => {
		if (paused) return;
		const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
		return () => clearInterval(timer);
	}, [paused]);
	useEffect(() => {
		if (paused) return;
		let subscription: Location.LocationSubscription | undefined;
		void (async () => {
			const permission = await Location.requestForegroundPermissionsAsync();
			if (!permission.granted) {
				setGpsError(
					"Permissão de localização necessária para registrar a rota.",
				);
				return;
			}
			subscription = await Location.watchPositionAsync(
				{
					accuracy: Location.Accuracy.High,
					timeInterval: 2000,
					distanceInterval: 3,
				},
				(location) => {
					const point: Point = {
						latitude: location.coords.latitude,
						longitude: location.coords.longitude,
						altitude: location.coords.altitude,
						accuracy: location.coords.accuracy,
						timestamp: new Date(location.timestamp).toISOString(),
					};
					setRoute((current) => {
						const previous = current.at(-1);
						if (previous)
							setDistance((value) => value + distanceMeters(previous, point));
						return [...current, point];
					});
					map.current?.animateCamera({ center: point, zoom: 16 });
				},
				(message) => setGpsError(message),
			);
		})();
		return () => subscription?.remove();
	}, [paused]);

	const finish = () =>
		Alert.alert("Finalizar atividade?", "O treino será salvo e sincronizado.", [
			{ text: "Continuar" },
			{
				text: "Finalizar",
				onPress: () => {
					addActivity({
						type,
						date: isoDate(),
						durationMinutes: Math.max(1, Math.round(seconds / 60)),
						distanceKm: Number((distance / 1000).toFixed(3)),
						route,
					});
					void setValue("active-workout", "");
					router.replace("/activities");
				},
			},
		]);
	const timer = `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
	const distanceKm = distance / 1000;
	return (
		<Screen scroll={false} style={{ padding: 0, gap: 0 }}>
			<View style={{ paddingHorizontal: 16 }}>
				<Header
					title="Atividade em andamento"
					onBack={() =>
						Alert.alert("Cancelar treino?", "Os dados atuais serão perdidos.", [
							{ text: "Continuar" },
							{
								text: "Cancelar treino",
								style: "destructive",
								onPress: () => {
									void setValue("active-workout", "");
									router.back();
								},
							},
						])
					}
				/>
			</View>
			<View style={styles.map}>
				<MapView
					ref={map}
					style={StyleSheet.absoluteFill}
					initialRegion={{
						latitude: -3.7319,
						longitude: -38.5267,
						latitudeDelta: 0.02,
						longitudeDelta: 0.02,
					}}
					showsUserLocation
				>
					{route.length > 1 ? (
						<Polyline
							coordinates={route}
							strokeColor={theme.primary}
							strokeWidth={6}
						/>
					) : null}
					{route[0] ? <Marker coordinate={route[0]} title="Início" /> : null}
				</MapView>
				<View style={styles.gps}>
					<View
						style={[styles.dot, gpsError && { backgroundColor: theme.error }]}
					/>
					<Text style={styles.gpsText}>
						{gpsError || (paused ? "GPS pausado" : "GPS ativo")}
					</Text>
				</View>
			</View>
			<View style={styles.data}>
				<Text style={styles.label}>TEMPO</Text>
				<Text style={styles.timer}>{timer}</Text>
				<View style={styles.metrics}>
					<View>
						<Text style={styles.value}>{distanceKm.toFixed(2)}</Text>
						<Text style={styles.muted}>Distância (km)</Text>
					</View>
					<View>
						<Text style={styles.value}>
							{distanceKm
								? formatPace(calculatePace(seconds / 60, distanceKm))
								: "0'00\""}
						</Text>
						<Text style={styles.muted}>Ritmo (/km)</Text>
					</View>
					<View>
						<Text style={styles.value}>{route.length}</Text>
						<Text style={styles.muted}>Pontos GPS</Text>
					</View>
				</View>
				<View style={styles.actions}>
					<Pressable
						onPress={() => setPaused((value) => !value)}
						style={[styles.round, { backgroundColor: theme.primaryContainer }]}
					>
						<MaterialCommunityIcons
							name={paused ? "play" : "pause"}
							size={32}
							color={theme.onPrimaryContainer}
						/>
						<Text style={styles.actionLabel}>
							{paused ? "Retomar" : "Pausar"}
						</Text>
					</Pressable>
					<Pressable
						onPress={finish}
						style={[styles.round, { backgroundColor: theme.errorContainer }]}
					>
						<MaterialCommunityIcons
							name="stop"
							size={32}
							color={theme.onErrorContainer}
						/>
						<Text style={styles.actionLabel}>Finalizar</Text>
					</Pressable>
				</View>
			</View>
		</Screen>
	);
}
const createStyles = (theme: ThemeTokens) =>
	StyleSheet.create({
		map: { height: 300, backgroundColor: theme.surfaceVariant },
		gps: {
			position: "absolute",
			top: 15,
			left: 15,
			maxWidth: "90%",
			flexDirection: "row",
			alignItems: "center",
			gap: 6,
			backgroundColor: theme.surface,
			borderRadius: 16,
			paddingHorizontal: 10,
			paddingVertical: 7,
		},
		dot: {
			width: 8,
			height: 8,
			borderRadius: 4,
			backgroundColor: theme.success,
		},
		gpsText: { color: theme.onSurface, fontWeight: "700", fontSize: 11 },
		data: { flex: 1, padding: 20, alignItems: "center", gap: 12 },
		label: {
			color: theme.primary,
			fontWeight: "900",
			fontSize: 11,
			letterSpacing: 1,
		},
		timer: {
			color: theme.onSurface,
			fontSize: 42,
			fontWeight: "300",
			fontVariant: ["tabular-nums"],
		},
		metrics: {
			flexDirection: "row",
			alignSelf: "stretch",
			justifyContent: "space-around",
		},
		value: {
			textAlign: "center",
			color: theme.onSurface,
			fontWeight: "900",
			fontSize: 19,
		},
		muted: { color: theme.onSurfaceVariant, fontSize: 10, textAlign: "center" },
		actions: { flexDirection: "row", gap: 36, marginTop: 8 },
		round: {
			width: 82,
			height: 82,
			borderRadius: 41,
			alignItems: "center",
			justifyContent: "center",
		},
		actionLabel: { color: theme.onSurface, fontWeight: "700", fontSize: 11 },
	});

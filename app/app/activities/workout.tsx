import { formatNumber } from "@/lib/format";
import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState as Lifecycle, BackHandler } from "react-native";
import { ActivityIndicator, Chip, HelperText, Text } from "react-native-paper";
import { WorkoutMap } from "@/components/vitalis/workout-map";
import { Button, Card, Header, Screen } from "@/components/vitalis/ui";
import { useConfirm } from "@/components/vitalis/confirmation";
import {
	calculateActivityCalories,
	calculatePace,
	formatPace,
} from "@/lib/health";
import { getValue, setValue } from "@/lib/local-database";
import {
	createWorkout,
	restoreWorkout,
	tickWorkout,
	pauseWorkout,
	recordPoint,
	type Workout,
} from "@/lib/workout";
import { useAppState } from "@/state/app-state";
import type { ActivityType } from "@/state/types";

export default function WorkoutScreen() {
	const { type } = useLocalSearchParams<{
		type?: ActivityType;
	}>();
	const requested: ActivityType =
		type === "walk" || type === "cycling" ? type : "run";
	const { state, dispatch } = useAppState(),
		owner = state.userId;
	const confirm = useConfirm();
	const [workout, setWorkout] = useState<Workout>(() =>
		createWorkout(requested),
	);
	const current = useRef(workout),
		writes = useRef(Promise.resolve()),
		finished = useRef(false);
	const [ready, setReady] = useState(false),
		[gpsError, setGpsError] = useState(""),
		[gpsReady, setGpsReady] = useState(false);
	const [foreground, setForeground] = useState(
			Lifecycle.currentState === "active",
		),
		[retry, setRetry] = useState(0);
	const update = (next: Workout) => {
		current.current = next;
		setWorkout(next);
	};
	const persist = useCallback(() => {
		const snapshot = current.current;
		const operation = writes.current.then(() =>
			finished.current
				? undefined
				: setValue("active-workout", JSON.stringify(snapshot), owner),
		);
		writes.current = operation.catch(() => {
			setGpsError(
				"Não foi possível salvar o treino no aparelho. Tente novamente.",
			);
		});
		return operation;
	}, [owner]);
	useEffect(() => {
		let stopped = false;
		void getValue("active-workout", owner)
			.then((raw) => {
				if (stopped) return;
				const restored = restoreWorkout(raw, requested);
				update(restored);
				setReady(true);
			})
			.catch(() =>
				setGpsError(
					"Não foi possível restaurar o treino. Volte e tente novamente.",
				),
			);
		return () => {
			stopped = true;
		};
	}, [owner, requested]);
	useEffect(() => {
		if (ready) void persist().catch(() => {});
	}, [ready, workout, persist]);
	useEffect(() => {
		const subscription = Lifecycle.addEventListener("change", (status) => {
			setForeground(status === "active");
			if (status !== "active" && ready) {
				update(pauseWorkout(current.current, true));
				void persist().catch(() => {});
			}
		});
		return () => subscription.remove();
	}, [ready, persist]);
	useEffect(() => {
		if (!ready || workout.paused || !foreground || !gpsReady) return;
		update({ ...current.current, lastTick: Date.now() });
		const timer = setInterval(() => update(tickWorkout(current.current)), 1000);
		return () => clearInterval(timer);
	}, [ready, workout.paused, foreground, gpsReady]);
	useEffect(() => {
		if (!ready || workout.paused || !foreground) {
			setGpsReady(false);
			return;
		}
		let stopped = false,
			subscription: Location.LocationSubscription | undefined;
		const fail = (message: string) => {
			if (!stopped) {
				setGpsError(message);
				setGpsReady(false);
				update(pauseWorkout(current.current, true));
			}
		};
		void (async () => {
			try {
				let permission = await Location.getForegroundPermissionsAsync();
				if (stopped) return;
				// Reopening Android's permission activity pauses the workout even if
				// permission was already granted. Request only when it is necessary.
				if (!permission.granted)
					permission = await Location.requestForegroundPermissionsAsync();
				if (stopped) return;
				if (!permission.granted)
					return fail(
						"Permita a localização para iniciar a rota. Você pode registrar uma atividade manualmente.",
					);
				if (!(await Location.hasServicesEnabledAsync()))
					return fail("Ative a localização do celular para retomar o treino.");
				if (stopped) return;
				const listener = await Location.watchPositionAsync(
					{
						accuracy: Location.Accuracy.High,
						timeInterval: 2000,
						distanceInterval: 3,
					},
					(location) => {
						if (stopped) return;
						const point = {
							...location.coords,
							timestamp: new Date(location.timestamp).toISOString(),
						};
						update(recordPoint(current.current, point));
					},
					() =>
						fail("GPS indisponível. Confira a localização e retome o treino."),
				);
				if (stopped) listener.remove();
				else {
					subscription = listener;
					setGpsError("");
					setGpsReady(true);
				}
			} catch {
				fail("Não foi possível iniciar o GPS. Confira a permissão e retome.");
			}
		})();
		return () => {
			stopped = true;
			subscription?.remove();
		};
	}, [ready, workout.paused, foreground, retry]);
	const leave = () => {
		if (!ready) {
			router.replace("/activities");
			return;
		}
		update(pauseWorkout(current.current, true));
		confirm(
			"Sair do treino?",
			"O treino ficará salvo e pausado para você continuar depois.",
			async () => {
				await persist();
				router.replace("/activities");
			},
			"Salvar e sair",
		);
	};
	useEffect(() => {
		const listener = BackHandler.addEventListener("hardwareBackPress", () => {
			leave();
			return true;
		});
		return () => listener.remove();
	});
	const finish = () => {
		update(pauseWorkout(current.current, true));
		confirm(
			"Finalizar atividade?",
			"O registro ficará salvo neste aparelho e será sincronizado quando houver conexão.",
			async () => {
				if (finished.current) return;
				const saved = current.current,
					seconds = Math.floor(saved.elapsedMs / 1000);
				if (seconds < 1)
					throw new Error("Registre ao menos um segundo de atividade.");
				finished.current = true;
				try {
					await writes.current;
					await dispatch({
						type: "ACTIVITY_SAVE",
						value: {
							id: saved.id,
							type: saved.type,
							date: saved.date,
							durationSeconds: seconds,
							durationMinutes: seconds / 60,
							distanceKm: saved.distance / 1000,
							route: saved.route,
							calories: calculateActivityCalories(
								saved.type,
								state.profile.weightKg,
								seconds / 60,
							),
						},
					});
					await setValue("active-workout", "", owner);
					router.replace("/activities");
				} catch (error) {
					finished.current = false;
					throw error;
				}
			},
			"Finalizar",
		);
	};
	const seconds = Math.floor(workout.elapsedMs / 1000),
		distanceKm = workout.distance / 1000;
	const timer = `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
	return (
		<Screen>
			<Header title="Atividade em andamento" onBack={leave} />
			{!ready ? (
				<ActivityIndicator accessibilityLabel="Restaurando treino" />
			) : (
				<>
					<WorkoutMap workout={workout} />
					<Chip icon={gpsReady ? "map-marker-check" : "map-marker-off"}>
						{workout.paused
							? "Treino pausado"
							: gpsReady
								? "GPS ativo"
								: "Iniciando GPS"}
					</Chip>
					{gpsError ? (
						<HelperText type="error" accessibilityLiveRegion="polite">
							{gpsError}
						</HelperText>
					) : null}
					<Card>
						<Text variant="labelLarge">Tempo</Text>
						<Text variant="displaySmall" accessibilityLabel={`Tempo ${timer}`}>
							{timer}
						</Text>
						<Text variant="titleLarge">{formatNumber(distanceKm, 2)} km</Text>
						<Text variant="bodyLarge">
							Ritmo:{" "}
							{distanceKm
								? formatPace(calculatePace(seconds / 60, distanceKm))
								: "—"}{" "}
							/km
						</Text>
					</Card>
					<Button
						title={workout.paused ? "Retomar" : "Pausar"}
						icon={workout.paused ? "play" : "pause"}
						onPress={() => {
							update(pauseWorkout(current.current, !current.current.paused));
							setRetry((x) => x + 1);
						}}
					/>
					<Button
						title="Finalizar"
						variant="outline"
						icon="stop"
						onPress={finish}
					/>
				</>
			)}
		</Screen>
	);
}

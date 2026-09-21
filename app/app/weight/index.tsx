import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import Svg, { Line, Polyline } from "react-native-svg";
import {
	Button,
	Card,
	Field,
	Header,
	Screen,
	Subtitle,
	Title,
} from "@/components/vitalis/ui";
import type { ThemeTokens } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import {
	calculateBmi,
	classifyBmi,
	isoDate,
	weightGoalWeeks,
} from "@/lib/health";
import { useAppState } from "@/state/app-state";

export default function WeightScreen() {
	const theme = useAppTheme();
	const styles = useMemo(() => createStyles(theme), [theme]);
	const { state, dispatch } = useAppState();
	const [weight, setWeight] = useState(String(state.profile.weightKg));
	const [goal, setGoal] = useState(String(state.goals.weightKg));
	const [deficit, setDeficit] = useState(String(state.goals.dailyDeficit));
	const bmi = calculateBmi(state.profile.weightKg, state.profile.heightCm);
	const weeks = weightGoalWeeks(
		state.profile.weightKg,
		state.goals.weightKg,
		state.goals.dailyDeficit,
	);
	const entries = state.weights.slice(-8);
	const currentAverage =
		entries.slice(-4).reduce((s, x) => s + x.weightKg, 0) /
		Math.max(entries.slice(-4).length, 1);
	const previousAverage =
		entries.slice(0, 4).reduce((s, x) => s + x.weightKg, 0) /
		Math.max(entries.slice(0, 4).length, 1);
	const points = useMemo(
		() =>
			entries
				.map((x, i) => `${10 + i * 42},${100 - (70 - x.weightKg) * 30}`)
				.join(" "),
		[entries],
	);
	const saveGoal = () => {
		const g = Number(goal),
			d = Number(deficit);
		if (g <= 0 || d < 0) return Alert.alert("Valores inválidos");
		dispatch({ type: "GOALS", value: { weightKg: g, dailyDeficit: d } });
	};
	const add = () => {
		const w = Number(weight);
		if (w <= 0) return Alert.alert("Peso inválido");
		dispatch({ type: "WEIGHT_ADD", value: { date: isoDate(), weightKg: w } });
	};
	return (
		<Screen>
			<Header title="Peso e evolução" onBack={() => router.back()} />
			<Title>{state.profile.weightKg.toFixed(1)} kg</Title>
			<View style={styles.stats}>
				<Card style={{ flex: 1 }}>
					<Text style={styles.label}>IMC</Text>
					<Text style={styles.value}>{bmi.toFixed(1)}</Text>
					<Text style={styles.muted}>{classifyBmi(bmi)}</Text>
				</Card>
				<Card style={{ flex: 1 }}>
					<Text style={styles.label}>PREVISÃO</Text>
					<Text style={styles.value}>{weeks ? `${weeks} sem.` : "—"}</Text>
					<Text style={styles.muted}>
						{weeks ? "para atingir a meta" : "Déficit insuficiente"}
					</Text>
				</Card>
			</View>
			<Card>
				<Subtitle>Evolução semanal</Subtitle>
				<Svg width="100%" height={120} viewBox="0 0 320 120">
					<Line x1="0" y1="100" x2="320" y2="100" stroke={theme.outline} />
					<Polyline
						points={points}
						fill="none"
						stroke={theme.weight}
						strokeWidth={4}
						strokeLinejoin="round"
						strokeLinecap="round"
					/>
				</Svg>
				<Text style={styles.muted}>
					Últimos registros · atual {entries.at(-1)?.weightKg.toFixed(1)} kg
				</Text>
				<View style={styles.comparison}>
					<View>
						<Text style={styles.label}>SEMANA ANTERIOR</Text>
						<Text style={styles.value}>{previousAverage.toFixed(1)} kg</Text>
					</View>
					<View>
						<Text style={styles.label}>SEMANA ATUAL</Text>
						<Text style={styles.value}>{currentAverage.toFixed(1)} kg</Text>
					</View>
					<Text
						style={[
							styles.delta,
							{
								color:
									currentAverage <= previousAverage
										? theme.success
										: theme.error,
							},
						]}
					>
						{(currentAverage - previousAverage).toFixed(1)} kg
					</Text>
				</View>
			</Card>
			<Card>
				<Subtitle>Novo registro</Subtitle>
				<Field
					label="Peso atual (kg)"
					value={weight}
					keyboardType="decimal-pad"
					onChangeText={setWeight}
				/>
				<Button title="Registrar peso" onPress={add} />
			</Card>
			<Card>
				<Subtitle>Meta de peso</Subtitle>
				<Field
					label="Meta (kg)"
					value={goal}
					keyboardType="decimal-pad"
					onChangeText={setGoal}
				/>
				<Field
					label="Déficit diário estimado (kcal)"
					value={deficit}
					keyboardType="numeric"
					onChangeText={setDeficit}
				/>
				<Button title="Salvar meta" onPress={saveGoal} />
			</Card>
		</Screen>
	);
}
const createStyles = (theme: ThemeTokens) =>
	StyleSheet.create({
		stats: { flexDirection: "row", gap: 10 },
		label: { color: theme.primary, fontSize: 11, fontWeight: "900" },
		value: { color: theme.onSurface, fontSize: 25, fontWeight: "900" },
		muted: { color: theme.onSurfaceVariant, fontSize: 12 },
		comparison: {
			borderTopWidth: 1,
			borderTopColor: theme.outline,
			paddingTop: 12,
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
		},
		delta: { fontWeight: "900" },
	});

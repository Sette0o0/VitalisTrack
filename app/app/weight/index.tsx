import { decimalInput, formatDate, formatNumber } from "@/lib/format";
import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { HelperText, Text } from "react-native-paper";
import Svg, { Circle, Line, Polyline } from "react-native-svg";
import { useMeasurements } from "@/hooks/use-measurements";
import { basalCalories } from "@vitalis/contracts";
import { goalsUpdateSchema, weightInputSchema } from "@vitalis/contracts";
import { Button, Card, Field, Header, Screen, Subtitle, Title } from "@/components/vitalis/ui";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useSubmit } from "@/hooks/use-submit";
import {
	calculateBmi,
	classifyBmi,
	isoDate,
	newId,
	weightGoalWeeks,
	calculateAge,
} from "@/lib/health";
import { parseInput, parseDecimal } from "@/lib/validation";
import { goBackOrReplace } from "@/lib/navigation";
import { useAppState } from "@/state/app-state";
import { selectWeightComparison } from "@/state/selectors";
export default function WeightScreen() {
	const theme = useAppTheme(),
		{ state, dispatch } = useAppState(),
		{ submit, saving, error } = useSubmit();
	const m = useMeasurements();
	const basal = basalCalories({
		weightKg: state.profile.hasWeight === false ? null : state.profile.weightKg,
		heightCm: state.profile.hasHeight === false ? null : state.profile.heightCm,
		age: state.profile.birthDate ? calculateAge(state.profile.birthDate) : null,
		gender: state.profile.gender,
	});
	const [weight, setWeight] = useState(
			state.profile.hasWeight === false ? "" : decimalInput(m.weight(state.profile.weightKg)),
		),
		[goal, setGoal] = useState(decimalInput(m.weight(state.goals.weightKg))),
		[deficit, setDeficit] = useState(String(state.goals.dailyDeficit));
	const bmi = calculateBmi(state.profile.weightKg, state.profile.heightCm),
		weeks = weightGoalWeeks(state.profile.weightKg, state.goals.weightKg, state.goals.dailyDeficit);
	const comparison = selectWeightComparison(state),
		entries = comparison.current;
	const min = entries.length ? Math.min(...entries.map((x) => x.weightKg)) - 1 : 0,
		max = entries.length ? Math.max(...entries.map((x) => x.weightKg)) + 1 : 1;
	const reference = new Date(`${isoDate()}T12:00:00`).getTime();
	const points = entries.map((x) => ({
		x:
			16 +
			(6 - Math.round((reference - new Date(`${x.date}T12:00:00`).getTime()) / 86_400_000)) * 48,
		y: 116 - ((x.weightKg - min) / (max - min)) * 92,
	}));
	const saveGoal = () =>
		submit(async () => {
			await dispatch({
				type: "GOALS",
				value: parseInput(goalsUpdateSchema, {
					weightKg:
						goal === decimalInput(m.weight(state.goals.weightKg))
							? state.goals.weightKg
							: m.weightInput(parseDecimal(goal)),
					dailyDeficit: parseDecimal(deficit),
				}),
			});
		});
	const add = () =>
		submit(async () => {
			const row = parseInput(weightInputSchema, {
				id: newId(),
				date: isoDate(),
				weightKg:
					weight === decimalInput(m.weight(state.profile.weightKg))
						? state.profile.weightKg
						: m.weightInput(parseDecimal(weight)),
			});
			await dispatch({ type: "WEIGHT_ADD", value: row });
		});
	const averages = [comparison.previousAverage, comparison.currentAverage],
		largest = Math.max(...averages.filter((x): x is number => x !== null), 1);
	return (
		<Screen>
			<Header title="Peso e evolução" onBack={() => goBackOrReplace(router, "/(tabs)/progress")} />
			<Title>
				{state.profile.hasWeight === false
					? "Peso não informado"
					: m.weightText(state.profile.weightKg)}
			</Title>
			<Card>
				<Text variant="titleLarge">
					{state.profile.hasHeight === false || state.profile.hasWeight === false
						? "Complete suas medidas no perfil"
						: `IMC ${formatNumber(bmi, 1)}`}
				</Text>
				<Text>
					{state.profile.hasHeight === false || state.profile.hasWeight === false
						? "IMC ainda indisponível"
						: classifyBmi(bmi)}
				</Text>
				<Text>
					Previsão:{" "}
					{state.profile.hasWeight === false
						? "Informe seu peso atual"
						: state.profile.weightKg === state.goals.weightKg
							? "Meta atingida"
							: weeks
								? `${weeks} semanas`
								: "Sem previsão para a meta e o déficit informados"}
				</Text>
			</Card>
			<Card>
				<Subtitle>Gasto calórico basal</Subtitle>
				<Text>
					{basal === null
						? "Estimativa indisponível para os dados do perfil."
						: `${formatNumber(basal)} kcal/dia · Harris-Benedict`}
				</Text>
				<Subtitle>Evolução dos últimos 7 dias</Subtitle>
				{entries.length ? (
					<View
						accessible
						accessibilityLabel={entries
							.map((x) => `${formatDate(x.date)}: ${m.weightText(x.weightKg)}`)
							.join("; ")}
					>
						<Svg width="100%" height={150} viewBox="0 0 320 150" accessible={false}>
							<Line x1="16" y1="120" x2="304" y2="120" stroke={theme.outline} />
							<Polyline
								points={points.map((x) => `${x.x},${x.y}`).join(" ")}
								fill="none"
								stroke={theme.weight}
								strokeWidth={3}
							/>
							{points.map((p, i) => (
								<Circle key={entries[i].id} cx={p.x} cy={p.y} r={4} fill={theme.weight} />
							))}
						</Svg>
						<Text>
							{formatDate(entries[0].date)} a {formatDate(entries.at(-1)!.date)}
						</Text>
					</View>
				) : (
					<Text>Nenhuma pesagem nesta semana.</Text>
				)}
				<Subtitle>Comparação semanal</Subtitle>
				<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
					{averages.map((value, i) => (
						<View key={i} style={{ flex: 1, minWidth: 120, gap: 8 }}>
							<Text>{i ? "Semana atual" : "Semana anterior"}</Text>
							<Text variant="titleLarge">
								{value === null ? "Sem registros" : m.weightText(value)}
							</Text>
							{value !== null && (
								<View
									accessible
									accessibilityLabel={m.weightText(value)}
									style={{
										height: (value / largest) * 90,
										width: 48,
										borderRadius: 8,
										backgroundColor: i ? theme.weight : theme.outline,
									}}
								/>
							)}
						</View>
					))}
				</View>
				{comparison.currentAverage !== null && comparison.previousAverage !== null && (
					<Text>
						Variação: {m.weightText(comparison.currentAverage - comparison.previousAverage)}
					</Text>
				)}
			</Card>
			<Card>
				<Subtitle>Novo registro</Subtitle>
				<Field
					label={`Peso atual (${m.weightUnit})`}
					value={weight}
					keyboardType="decimal-pad"
					onChangeText={setWeight}
				/>
				<Button title="Registrar peso" loading={saving} onPress={add} />
			</Card>
			<Card>
				<Subtitle>Meta de peso</Subtitle>
				<Field
					label={`Meta (${m.weightUnit})`}
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
				<Button title="Salvar meta" loading={saving} onPress={saveGoal} />
			</Card>
			{error && <HelperText type="error">{error}</HelperText>}
		</Screen>
	);
}

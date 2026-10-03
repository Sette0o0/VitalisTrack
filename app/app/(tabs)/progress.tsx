import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { SegmentedButtons, Text } from "react-native-paper";
import {
	Button,
	Card,
	Eyebrow,
	ProgressRing,
	Screen,
	Subtitle,
	Title,
	Muted,
} from "@/components/vitalis/ui";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppState, useProgress } from "@/state/app-state";
import { selectActivityStats } from "@/state/selectors";
import type { Period } from "@/state/types";
export default function ProgressScreen() {
	const theme = useAppTheme(),
		{ state } = useAppState();
	const [period, setPeriod] = useState<Period>("week"),
		progress = useProgress(period),
		stats = selectActivityStats(state, period === "month" ? "month" : "week");
	return (
		<Screen>
			<Eyebrow>Acompanhamento</Eyebrow>
			<Title>Progresso</Title>
			<SegmentedButtons
				value={period}
				onValueChange={(x) => setPeriod(x as Period)}
				buttons={[
					{
						value: "day",
						label: "Dia",
						style: { minHeight: 48, justifyContent: "center" },
						labelStyle: { lineHeight: 30 },
					},
					{
						value: "week",
						label: "Semana",
						style: { minHeight: 48, justifyContent: "center" },
						labelStyle: { lineHeight: 30 },
					},
					{
						value: "month",
						label: "Mês",
						style: { minHeight: 48, justifyContent: "center" },
						labelStyle: { lineHeight: 30 },
					},
				]}
			/>
			<Card>
				<Subtitle>Suas metas</Subtitle>
				<Muted>
					Média de todos os {progress.windowDays} dias da janela;{" "}
					{progress.contributingDays} com registros.
				</Muted>
				<View
					style={{
						flexDirection: "row",
						flexWrap: "wrap",
						gap: 16,
						justifyContent: "space-around",
					}}
				>
					{progress.rings.map((ring, i) => (
						<ProgressRing
							key={ring.label}
							value={ring.value}
							label={ring.label}
							color={[theme.activity, theme.water, theme.food][i]}
						/>
					))}
				</View>
				{!progress.contributingDays && (
					<Muted>Nenhum registro neste período.</Muted>
				)}
			</Card>
			<Card>
				<Subtitle>Passos</Subtitle>
				<Text variant="bodyLarge">
					Média dos últimos 7 dias:{" "}
					{Math.round(stats.stepAverage).toLocaleString("pt-BR")}
				</Text>
				<Muted>
					{stats.trend === "flat"
						? "Estável"
						: stats.trend === "up"
							? "Em crescimento"
							: "Em queda"}{" "}
					·{" "}
					{stats.trendPercent === null
						? "sem base na semana anterior"
						: `${Math.abs(stats.trendPercent).toFixed(1)}% em relação aos 7 dias anteriores`}
				</Muted>
				<Text variant="bodyLarge">
					{stats.steps.toLocaleString("pt-BR")} passos nos últimos{" "}
					{period === "month" ? 30 : 7} dias
				</Text>
			</Card>
			<Subtitle>Outras métricas</Subtitle>
			<Button
				title="Peso e composição"
				icon="scale-bathroom"
				variant="outline"
				onPress={() => router.push("/weight")}
			/>
			<Button
				title={`Atividades · ${progress.activityMinutes.toFixed(1)} min`}
				icon="run"
				variant="outline"
				onPress={() => router.push("/activities")}
			/>
		</Screen>
	);
}

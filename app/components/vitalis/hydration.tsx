import { View } from "react-native";
import { Text } from "react-native-paper";
import { useDailySummary, useAppState } from "@/state/app-state";
import { useAppTheme } from "@/hooks/use-app-theme";
import { Card, ProgressBar, ProgressRing } from "./ui";
export function HydrationSummary({ compact = false }: { compact?: boolean }) {
	const summary = useDailySummary(),
		{ state } = useAppState(),
		t = useAppTheme();
	return (
		<Card style={{ backgroundColor: t.waterContainer }}>
			<View
				style={{
					flexDirection: "row",
					flexWrap: "wrap",
					gap: 16,
					alignItems: "center",
				}}
			>
				{!compact && (
					<ProgressRing
						value={summary.waterProgress}
						color={t.water}
						valueColor={t.onWaterContainer}
						size={110}
						label="da meta"
						labelColor={t.onWaterContainer}
					/>
				)}
				<View style={{ flex: 1, minWidth: 150, gap: 8 }}>
					<Text variant="titleMedium" style={{ color: t.onWaterContainer }}>
						Água
					</Text>
					<Text
						variant={compact ? "headlineSmall" : "headlineMedium"}
						style={{ color: t.onWaterContainer }}
					>
						{summary.water.toLocaleString("pt-BR")} mL
					</Text>
					<Text style={{ color: t.onWaterContainer }}>
						Meta {state.goals.waterMl.toLocaleString("pt-BR")} mL ·{" "}
						{Math.round(summary.waterProgress * 100)}%
					</Text>
					<ProgressBar value={summary.waterProgress} color={t.water} />
				</View>
			</View>
		</Card>
	);
}

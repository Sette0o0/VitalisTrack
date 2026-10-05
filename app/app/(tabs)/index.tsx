import { useQaReady } from "@/hooks/use-qa-ready";
import { formatNumber } from "@/lib/format";
import { router } from "expo-router";
import { View } from "react-native";
import { Text } from "react-native-paper";
import { HydrationSummary } from "@/components/vitalis/hydration";
import { ProfileAvatar } from "@/components/vitalis/avatar";
import {
	Button,
	Card,
	Eyebrow,
	Muted,
	ProgressBar,
	ProgressRing,
	Screen,
	Subtitle,
	Title,
} from "@/components/vitalis/ui";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppState, useDailySummary } from "@/state/app-state";
export default function HomeScreen() {
	const onReady = useQaReady("home");
	const { state } = useAppState(),
		summary = useDailySummary(),
		theme = useAppTheme(),
		remaining = state.goals.calories - summary.calories;
	return (
		<Screen onLayout={onReady}>
			<View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
				<ProfileAvatar profile={state.profile} size={48} />
				<View style={{ flex: 1 }}>
					<Muted>Olá,</Muted>
					<Subtitle>{state.profile.name.split(" ")[0]}</Subtitle>
				</View>
			</View>
			<Eyebrow>Hoje</Eyebrow>
			<Title>Seu resumo</Title>
			<Card style={{ backgroundColor: theme.primaryContainer }}>
				<Text variant="labelLarge" style={{ color: theme.onPrimaryContainer }}>
					Passos
				</Text>
				<View
					style={{
						flexDirection: "row",
						flexWrap: "wrap",
						gap: 16,
						alignItems: "center",
						justifyContent: "space-between",
					}}
				>
					<View>
						<Text
							variant="displaySmall"
							style={{ color: theme.onPrimaryContainer }}
						>
							{formatNumber(summary.steps)}
						</Text>
						<Text style={{ color: theme.onPrimaryContainer }}>
							Meta {formatNumber(state.goals.steps)}
						</Text>
					</View>
					<ProgressRing
						value={summary.stepProgress}
						color={theme.activity}
						valueColor={theme.onPrimaryContainer}
					/>
				</View>
			</Card>
			<HydrationSummary onPress={() => router.push("/water")} />
			<Card
				style={{ backgroundColor: theme.foodContainer }}
				accessibilityLabel="Abrir alimentação"
				testID="calories-summary-card"
				onPress={() => router.push("/(tabs)/meals")}
			>
				<Text variant="titleMedium" style={{ color: theme.onFoodContainer }}>
					Calorias
				</Text>
				<Text variant="headlineMedium" style={{ color: theme.onFoodContainer }}>
					{formatNumber(summary.calories)} kcal
				</Text>
				<Text style={{ color: theme.onFoodContainer }}>
					{formatNumber(Math.abs(remaining))} {remaining < 0 ? "acima da meta" : "restantes"}
				</Text>
				<ProgressBar value={summary.calorieProgress} color={theme.food} />
				<Text variant="labelLarge" style={{ color: theme.onFoodContainer }}>
					Abrir alimentação
				</Text>
			</Card>
			<Button
				title="Registrar atividade física"
				icon="run"
				variant="outline"
				onPress={() => router.push("/activities")}
			/>
		</Screen>
	);
}

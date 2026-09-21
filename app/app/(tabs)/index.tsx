import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router } from "expo-router";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
	Card,
	Eyebrow,
	ProgressBar,
	ProgressRing,
	Screen,
	Subtitle,
	Title,
} from "@/components/vitalis/ui";
import { radius, spacing, ThemeTokens } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppState, useDailySummary } from "@/state/app-state";

type MetricProps = {
	icon: keyof typeof MaterialCommunityIcons.glyphMap;
	title: string;
	value: string;
	note: string;
	progress: number;
	color: string;
	container: string;
	onPress: () => void;
};
function Metric({
	icon,
	title,
	value,
	note,
	progress,
	color,
	container,
	onPress,
}: MetricProps) {
	const theme = useAppTheme();
	const styles = useMemo(() => createStyles(theme), [theme]);
	return (
		<Pressable onPress={onPress} style={styles.metric}>
			<View style={[styles.metricIcon, { backgroundColor: container }]}>
				<MaterialCommunityIcons name={icon} size={25} color={color} />
			</View>
			<Text style={styles.metricLabel}>{title}</Text>
			<Text style={styles.metricValue}>{value}</Text>
			<Text style={styles.note}>{note}</Text>
			<ProgressBar value={progress} color={color} />
		</Pressable>
	);
}

export default function HomeScreen() {
	const theme = useAppTheme();
	const styles = useMemo(() => createStyles(theme), [theme]);
	const { state } = useAppState();
	const summary = useDailySummary();
	return (
		<Screen>
			<View style={styles.top}>
				<View style={styles.avatar}>
					<Text style={styles.avatarText}>
						{state.profile.name
							.split(" ")
							.map((part) => part[0])
							.slice(0, 2)}
					</Text>
				</View>
				<View style={{ flex: 1 }}>
					<Text style={styles.note}>Bom dia,</Text>
					<Subtitle>{state.profile.name.split(" ")[0]}</Subtitle>
				</View>
				<MaterialCommunityIcons
					name="bell-outline"
					size={25}
					color={theme.onSurface}
				/>
			</View>
			<View>
				<Eyebrow>Hoje</Eyebrow>
				<Title>Seu resumo</Title>
			</View>
			<Card style={styles.hero}>
				<View>
					<Text style={styles.heroLabel}>PASSOS</Text>
					<Text style={styles.heroValue}>
						{summary.steps.toLocaleString("pt-BR")}
					</Text>
					<Text style={styles.heroNote}>
						de {state.goals.steps.toLocaleString("pt-BR")} passos
					</Text>
				</View>
				<ProgressRing
					value={summary.stepProgress}
					color={theme.activity}
					trackColor={`${theme.onPrimaryContainer}35`}
					valueColor={theme.onPrimaryContainer}
				/>
			</Card>
			<View style={styles.grid}>
				<Metric
					icon="water"
					title="Água"
					value={`${(summary.water / 1000).toLocaleString("pt-BR")} L`}
					note={`Meta ${(state.goals.waterMl / 1000).toLocaleString("pt-BR")} L`}
					progress={summary.waterProgress}
					color={theme.water}
					container={theme.waterContainer}
					onPress={() => router.push("/water")}
				/>
				<Metric
					icon="fire"
					title="Calorias"
					value={`${summary.calories} kcal`}
					note={`${state.goals.calories - summary.calories} restantes`}
					progress={summary.calorieProgress}
					color={theme.food}
					container={theme.foodContainer}
					onPress={() => router.push("/(tabs)/meals")}
				/>
			</View>
			<Eyebrow>Próximo passo</Eyebrow>
			<Pressable style={styles.next} onPress={() => router.push("/activities")}>
				<View style={styles.nextIcon}>
					<MaterialCommunityIcons name="run" size={27} color={theme.activity} />
				</View>
				<View style={{ flex: 1 }}>
					<Subtitle>Atividade física</Subtitle>
					<Text style={styles.note}>Registre ou inicie um treino</Text>
				</View>
				<MaterialCommunityIcons
					name="chevron-right"
					size={26}
					color={theme.onSurfaceVariant}
				/>
			</Pressable>
			<Card style={styles.tip}>
				<MaterialCommunityIcons
					name="lightbulb-on-outline"
					size={25}
					color={theme.primary}
				/>
				<View style={{ flex: 1 }}>
					<Text style={styles.tipTitle}>Dica do dia</Text>
					<Text style={styles.tipText}>
						Uma pausa curta para se alongar também conta como cuidado.
					</Text>
				</View>
			</Card>
		</Screen>
	);
}

const createStyles = (theme: ThemeTokens) =>
	StyleSheet.create({
		top: { flexDirection: "row", alignItems: "center", gap: 12 },
		avatar: {
			width: 46,
			height: 46,
			borderRadius: 23,
			backgroundColor: theme.primaryContainer,
			alignItems: "center",
			justifyContent: "center",
		},
		avatarText: { color: theme.onPrimaryContainer, fontWeight: "900" },
		note: { color: theme.onSurfaceVariant, fontSize: 12 },
		hero: {
			backgroundColor: theme.primaryContainer,
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
		},
		heroLabel: { color: theme.primary, fontWeight: "800", fontSize: 12 },
		heroValue: {
			color: theme.onPrimaryContainer,
			fontSize: 34,
			fontWeight: "900",
		},
		heroNote: { color: theme.onPrimaryContainer, opacity: 0.8 },
		grid: { flexDirection: "row", gap: 10 },
		metric: {
			flex: 1,
			backgroundColor: theme.surface,
			borderRadius: radius.lg,
			padding: 15,
			gap: 5,
			elevation: 2,
		},
		metricIcon: {
			width: 38,
			height: 38,
			borderRadius: 13,
			alignItems: "center",
			justifyContent: "center",
		},
		metricLabel: { color: theme.onSurfaceVariant, fontSize: 12 },
		metricValue: { color: theme.onSurface, fontSize: 19, fontWeight: "900" },
		next: {
			minHeight: 78,
			borderRadius: radius.md,
			backgroundColor: theme.surface,
			flexDirection: "row",
			alignItems: "center",
			gap: 12,
			padding: spacing.md,
			elevation: 1,
		},
		nextIcon: {
			width: 48,
			height: 48,
			borderRadius: 15,
			backgroundColor: theme.activityContainer,
			alignItems: "center",
			justifyContent: "center",
		},
		tip: { backgroundColor: theme.primaryContainer, flexDirection: "row" },
		tipTitle: { fontWeight: "800", color: theme.onPrimaryContainer },
		tipText: { color: theme.onPrimaryContainer, opacity: 0.82, fontSize: 12 },
	});

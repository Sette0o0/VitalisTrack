import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
	Card,
	Eyebrow,
	ProgressRing,
	Screen,
	Subtitle,
	Title,
} from "@/components/vitalis/ui";
import { radius, ThemeTokens } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useProgress } from "@/state/app-state";
import type { Period } from "@/state/types";

const labels: Record<Period, string> = {
	day: "Dia",
	week: "Semana",
	month: "Mês",
};

export default function ProgressScreen() {
	const theme = useAppTheme();
	const styles = useMemo(() => createStyles(theme), [theme]);
	const [period, setPeriod] = useState<Period>("week");
	const progress = useProgress(period);
	const bars = [42, 66, 53, 80, 68, 92, 72];
	const summaryForeground = theme.isDark
		? theme.onPrimaryContainer
		: theme.onPrimary;
	const ringColors = theme.isDark
		? [theme.activity, theme.water, theme.food]
		: [theme.activityContainer, theme.waterContainer, theme.foodContainer];
	return (
		<Screen>
			<View>
				<Eyebrow>Acompanhamento</Eyebrow>
				<Title>Progresso</Title>
			</View>
			<View style={styles.tabs}>
				{(["day", "week", "month"] as Period[]).map((value) => (
					<Pressable
						key={value}
						onPress={() => setPeriod(value)}
						style={[styles.tab, period === value && styles.active]}
					>
						<Text
							style={[styles.tabText, period === value && styles.activeText]}
						>
							{labels[value]}
						</Text>
					</Pressable>
				))}
			</View>
			<Card style={styles.summary}>
				<Text style={styles.summaryEyebrow}>Seu ritmo está consistente</Text>
				<Text style={styles.summaryTitle}>Metas em movimento</Text>
				<Text style={styles.summaryText}>
					Média calculada com {progress.contributingDays}{" "}
					{progress.contributingDays === 1
						? "dia registrado"
						: "dias registrados"}{" "}
					nos últimos {progress.windowDays}.
				</Text>
				<View style={styles.rings}>
					{progress.rings.map((ring, index) => (
						<ProgressRing
							key={ring.label}
							size={90}
							value={ring.value}
							label={ring.label}
							color={ringColors[index]}
							trackColor={`${summaryForeground}35`}
							valueColor={summaryForeground}
							labelColor={summaryForeground}
						/>
					))}
				</View>
			</Card>
			<Card>
				<View style={styles.heading}>
					<View>
						<Eyebrow>Passos</Eyebrow>
						<Subtitle>Média de 8.420</Subtitle>
					</View>
					<View style={styles.trend}>
						<MaterialCommunityIcons
							name="trending-up"
							size={20}
							color={theme.success}
						/>
						<Text style={styles.trendText}>8%</Text>
					</View>
				</View>
				<View style={styles.chart}>
					{bars.map((height, index) => (
						<View key={index} style={styles.barColumn}>
							<View
								style={[
									styles.bar,
									{
										height,
										backgroundColor:
											index === 6 ? theme.primary : theme.primaryContainer,
									},
								]}
							/>
							<Text style={styles.day}>
								{["S", "T", "Q", "Q", "S", "S", "D"][index]}
							</Text>
						</View>
					))}
				</View>
			</Card>
			<Subtitle>Outras métricas</Subtitle>
			<Pressable style={styles.linkCard} onPress={() => router.push("/weight")}>
				<View style={styles.weightIcon}>
					<MaterialCommunityIcons
						name="scale-bathroom"
						size={25}
						color={theme.weight}
					/>
				</View>
				<View style={{ flex: 1 }}>
					<Text style={styles.linkTitle}>Peso e composição</Text>
					<Text style={styles.muted}>Meta, IMC e evolução semanal</Text>
				</View>
				<MaterialCommunityIcons
					name="chevron-right"
					size={24}
					color={theme.onSurfaceVariant}
				/>
			</Pressable>
			<Pressable
				style={styles.linkCard}
				onPress={() => router.push("/activities")}
			>
				<View style={styles.activityIcon}>
					<MaterialCommunityIcons name="run" size={25} color={theme.activity} />
				</View>
				<View style={{ flex: 1 }}>
					<Text style={styles.linkTitle}>Atividades</Text>
					<Text style={styles.muted}>
						{progress.activityMinutes} minutos registrados
					</Text>
				</View>
				<MaterialCommunityIcons
					name="chevron-right"
					size={24}
					color={theme.onSurfaceVariant}
				/>
			</Pressable>
		</Screen>
	);
}

const createStyles = (theme: ThemeTokens) =>
	StyleSheet.create({
		tabs: {
			flexDirection: "row",
			padding: 4,
			borderRadius: radius.pill,
			backgroundColor: theme.surfaceVariant,
		},
		tab: {
			flex: 1,
			alignItems: "center",
			paddingVertical: 9,
			borderRadius: radius.pill,
		},
		active: { backgroundColor: theme.primary },
		tabText: { color: theme.onSurfaceVariant, fontWeight: "800" },
		activeText: { color: theme.onPrimary },
		summary: {
			backgroundColor: theme.isDark ? theme.primaryContainer : theme.primary,
		},
		summaryEyebrow: {
			color: theme.isDark ? theme.primary : theme.primaryContainer,
			fontSize: 11,
			fontWeight: "800",
			letterSpacing: 1.1,
			textTransform: "uppercase",
		},
		summaryTitle: {
			color: theme.isDark ? theme.onPrimaryContainer : theme.onPrimary,
			fontSize: 24,
			fontWeight: "900",
		},
		summaryText: {
			color: theme.isDark ? theme.onPrimaryContainer : theme.onPrimary,
			opacity: 0.86,
		},
		rings: { flexDirection: "row", justifyContent: "space-around" },
		heading: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
		},
		trend: { flexDirection: "row", alignItems: "center" },
		trendText: { color: theme.success, fontWeight: "800" },
		chart: {
			height: 120,
			flexDirection: "row",
			alignItems: "flex-end",
			justifyContent: "space-between",
		},
		barColumn: {
			flex: 1,
			alignItems: "center",
			justifyContent: "flex-end",
			gap: 5,
		},
		bar: { width: 23, borderRadius: 6 },
		day: { color: theme.onSurfaceVariant, fontSize: 10 },
		linkCard: {
			flexDirection: "row",
			minHeight: 72,
			alignItems: "center",
			gap: 12,
			backgroundColor: theme.surface,
			padding: 12,
			borderRadius: radius.md,
			elevation: 1,
		},
		weightIcon: {
			width: 46,
			height: 46,
			borderRadius: 15,
			backgroundColor: theme.weightContainer,
			alignItems: "center",
			justifyContent: "center",
		},
		activityIcon: {
			width: 46,
			height: 46,
			borderRadius: 15,
			backgroundColor: theme.activityContainer,
			alignItems: "center",
			justifyContent: "center",
		},
		linkTitle: { color: theme.onSurface, fontWeight: "800" },
		muted: { color: theme.onSurfaceVariant, fontSize: 12 },
	});

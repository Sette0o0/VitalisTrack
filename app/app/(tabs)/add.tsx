import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router } from "expo-router";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Eyebrow, Screen, Title } from "@/components/vitalis/ui";
import { radius, ThemeTokens } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";

export default function AddScreen() {
	const theme = useAppTheme();
	const styles = useMemo(() => createStyles(theme), [theme]);
	const actions = [
		{
			title: "Água",
			icon: "water" as const,
			color: theme.water,
			bg: theme.waterContainer,
			route: "/water" as const,
		},
		{
			title: "Refeição",
			icon: "silverware-fork-knife" as const,
			color: theme.food,
			bg: theme.foodContainer,
			route: "/meals/form" as const,
		},
		{
			title: "Atividade",
			icon: "run" as const,
			color: theme.activity,
			bg: theme.activityContainer,
			route: "/activities" as const,
		},
		{
			title: "Peso",
			icon: "scale-bathroom" as const,
			color: theme.weight,
			bg: theme.weightContainer,
			route: "/weight" as const,
		},
	];
	return (
		<Screen>
			<View>
				<Eyebrow>Registro rápido</Eyebrow>
				<Title>O que você quer registrar?</Title>
			</View>
			<View style={styles.grid}>
				{actions.map((action) => (
					<Pressable
						key={action.title}
						onPress={() => router.push(action.route)}
						style={styles.action}
					>
						<View style={[styles.icon, { backgroundColor: action.bg }]}>
							<MaterialCommunityIcons
								name={action.icon}
								size={34}
								color={action.color}
							/>
						</View>
						<Text style={styles.label}>{action.title}</Text>
						<MaterialCommunityIcons
							name="chevron-right"
							size={22}
							color={theme.onSurfaceVariant}
						/>
					</Pressable>
				))}
			</View>
		</Screen>
	);
}

const createStyles = (theme: ThemeTokens) =>
	StyleSheet.create({
		grid: { gap: 12 },
		action: {
			padding: 16,
			minHeight: 82,
			borderRadius: radius.lg,
			backgroundColor: theme.surface,
			flexDirection: "row",
			alignItems: "center",
			gap: 14,
			elevation: 2,
		},
		icon: {
			width: 52,
			height: 52,
			borderRadius: 17,
			alignItems: "center",
			justifyContent: "center",
		},
		label: { flex: 1, color: theme.onSurface, fontSize: 17, fontWeight: "800" },
	});

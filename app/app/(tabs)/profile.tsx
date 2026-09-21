import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router } from "expo-router";
import { useMemo } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { Button, Card, Eyebrow, Screen, Title } from "@/components/vitalis/ui";
import { radius, ThemeTokens } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { calculateAge, calculateBmi, classifyBmi } from "@/lib/health";
import { useAppState } from "@/state/app-state";

export default function ProfileScreen() {
	const theme = useAppTheme();
	const styles = useMemo(() => createStyles(theme), [theme]);
	const { state, dispatch, logout } = useAppState();
	const initials = state.profile.name
		.split(" ")
		.map((part) => part[0])
		.slice(0, 2)
		.join("");
	const bmi = calculateBmi(state.profile.weightKg, state.profile.heightCm);
	return (
		<Screen>
			<View style={styles.header}>
				<Eyebrow>Perfil</Eyebrow>
				<Pressable
					accessibilityLabel="Editar perfil"
					onPress={() => router.push("/profile/edit")}
				>
					<MaterialCommunityIcons
						name="pencil"
						size={24}
						color={theme.primary}
					/>
				</Pressable>
			</View>
			<View style={styles.hero}>
				<View style={styles.avatar}>
					<Text style={styles.initials}>{initials}</Text>
				</View>
				<View>
					<Title>{state.profile.name}</Title>
					<Text style={styles.muted}>{state.profile.email}</Text>
					<Text style={styles.muted}>
						{state.syncStatus === "offline"
							? "Offline · alterações na fila"
							: state.syncStatus === "syncing"
								? "Sincronizando…"
								: "Dados sincronizados"}
					</Text>
				</View>
			</View>
			<View style={styles.stats}>
				<View style={styles.statItem}>
					<Text style={styles.stat}>
						{calculateAge(state.profile.birthDate)}
					</Text>
					<Text style={styles.muted}>anos</Text>
				</View>
				<View style={styles.statItem}>
					<Text style={styles.stat}>{state.profile.weightKg.toFixed(1)}</Text>
					<Text style={styles.muted}>kg</Text>
				</View>
				<View style={styles.statItem}>
					<Text style={styles.stat}>
						{(state.profile.heightCm / 100).toFixed(2)}
					</Text>
					<Text style={styles.muted}>m</Text>
				</View>
			</View>
			<Pressable onPress={() => router.push("/weight")}>
				<Card style={styles.metricCard}>
					<View style={styles.itemIcon}>
						<MaterialCommunityIcons
							name="scale-bathroom"
							size={25}
							color={theme.weight}
						/>
					</View>
					<View style={{ flex: 1 }}>
						<Text style={styles.itemTitle}>IMC {bmi.toFixed(1)}</Text>
						<Text style={styles.muted}>{classifyBmi(bmi)} · ver evolução</Text>
					</View>
					<MaterialCommunityIcons
						name="chevron-right"
						size={24}
						color={theme.onSurfaceVariant}
					/>
				</Card>
			</Pressable>
			<Eyebrow>Preferências</Eyebrow>
			<Card style={styles.setting}>
				<View style={styles.itemIcon}>
					<MaterialCommunityIcons
						name="theme-light-dark"
						size={25}
						color={theme.weight}
					/>
				</View>
				<View style={{ flex: 1 }}>
					<Text style={styles.itemTitle}>Modo escuro</Text>
					<Text style={styles.muted}>Alternar aparência do aplicativo</Text>
				</View>
				<Switch
					value={state.darkMode}
					onValueChange={(value) => dispatch({ type: "SET_DARK", value })}
					trackColor={{ false: theme.surfaceVariant, true: theme.primary }}
					thumbColor={state.darkMode ? theme.onPrimary : theme.outline}
				/>
			</Card>
			<Eyebrow>Sessão</Eyebrow>
			<Button
				title="Sair da conta"
				icon="logout"
				variant="danger"
				onPress={() =>
					void logout().then(() => router.replace("/(auth)/login"))
				}
			/>
		</Screen>
	);
}

const createStyles = (theme: ThemeTokens) =>
	StyleSheet.create({
		header: { flexDirection: "row", justifyContent: "space-between" },
		hero: { flexDirection: "row", alignItems: "center", gap: 16 },
		avatar: {
			width: 76,
			height: 76,
			borderRadius: 38,
			backgroundColor: theme.primaryContainer,
			alignItems: "center",
			justifyContent: "center",
		},
		initials: {
			color: theme.onPrimaryContainer,
			fontWeight: "900",
			fontSize: 24,
		},
		muted: { color: theme.onSurfaceVariant, fontSize: 12 },
		stats: {
			flexDirection: "row",
			backgroundColor: theme.surface,
			borderRadius: radius.md,
			padding: 16,
			justifyContent: "space-around",
			elevation: 1,
		},
		statItem: { minWidth: 70, alignItems: "center" },
		stat: {
			textAlign: "center",
			color: theme.onSurface,
			fontSize: 20,
			fontWeight: "900",
		},
		metricCard: { flexDirection: "row", alignItems: "center" },
		itemIcon: {
			width: 45,
			height: 45,
			backgroundColor: theme.weightContainer,
			borderRadius: 15,
			alignItems: "center",
			justifyContent: "center",
		},
		itemTitle: { color: theme.onSurface, fontWeight: "800" },
		setting: { flexDirection: "row", alignItems: "center" },
	});

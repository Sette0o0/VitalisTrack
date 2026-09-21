import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import {
	Button,
	Card,
	Field,
	Header,
	Screen,
	Subtitle,
} from "@/components/vitalis/ui";
import { radius, ThemeTokens } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppState } from "@/state/app-state";
import type { ActivityType } from "@/state/types";

const meta = {
	run: { label: "Corrida", icon: "run" as const },
	walk: { label: "Caminhada", icon: "walk" as const },
	cycling: { label: "Ciclismo", icon: "bike" as const },
};
export default function ActivitiesScreen() {
	const theme = useAppTheme();
	const styles = useMemo(() => createStyles(theme), [theme]);
	const { state, dispatch } = useAppState();
	const [filter, setFilter] = useState<ActivityType | "all">("all");
	const [filterDate, setFilterDate] = useState("");
	const [sort, setSort] = useState<"date" | "type">("date");
	const list = useMemo(
		() =>
			state.activities
				.filter(
					(x) =>
						(filter === "all" || x.type === filter) &&
						(!filterDate || x.date === filterDate),
				)
				.sort((a, b) =>
					sort === "date"
						? b.date.localeCompare(a.date)
						: a.type.localeCompare(b.type),
				),
		[state.activities, filter, filterDate, sort],
	);
	const totalMinutes = state.activities.reduce(
		(s, x) => s + x.durationMinutes,
		0,
	);
	const remove = (id: string) =>
		Alert.alert("Excluir atividade?", "As estatísticas serão atualizadas.", [
			{ text: "Cancelar" },
			{
				text: "Excluir",
				style: "destructive",
				onPress: () => dispatch({ type: "ACTIVITY_DELETE", id }),
			},
		]);
	return (
		<Screen>
			<Header title="Atividades" onBack={() => router.back()} />
			<Card style={styles.highlight}>
				<View>
					<Text style={styles.eyebrow}>ESTA SEMANA</Text>
					<Text style={styles.big}>{state.activities.length} atividades</Text>
					<Text style={styles.onDark}>
						{Math.floor(totalMinutes / 60)}h {totalMinutes % 60}min ·{" "}
						{state.activities.reduce((s, x) => s + x.distanceKm, 0).toFixed(1)}{" "}
						km
					</Text>
				</View>
				<MaterialCommunityIcons
					name="run-fast"
					size={52}
					color={theme.onActivityContainer}
				/>
			</Card>
			<Subtitle>Iniciar atividade</Subtitle>
			<View style={styles.types}>
				{(["run", "walk", "cycling"] as ActivityType[]).map((type) => (
					<Pressable
						key={type}
						style={styles.type}
						onPress={() =>
							router.push({ pathname: "/activities/workout", params: { type } })
						}
					>
						<MaterialCommunityIcons
							name={meta[type].icon}
							size={28}
							color={theme.activity}
						/>
						<Text style={styles.typeText}>{meta[type].label}</Text>
					</Pressable>
				))}
			</View>
			<Button
				title="Registrar atividade manual"
				icon="plus"
				onPress={() => router.push("/activities/form")}
			/>
			<View style={styles.heading}>
				<Subtitle>Histórico</Subtitle>
				<Pressable
					onPress={() => setSort((x) => (x === "date" ? "type" : "date"))}
				>
					<Text style={styles.link}>
						Ordenar: {sort === "date" ? "data" : "tipo"}
					</Text>
				</Pressable>
			</View>
			<Field
				label="Filtrar por data (opcional)"
				placeholder="AAAA-MM-DD"
				value={filterDate}
				onChangeText={setFilterDate}
			/>
			<View style={styles.filters}>
				{(["all", "run", "walk", "cycling"] as const).map((x) => (
					<Pressable
						key={x}
						onPress={() => setFilter(x)}
						style={[styles.chip, filter === x && styles.chipActive]}
					>
						<Text
							style={[
								styles.chipText,
								filter === x && { color: theme.onPrimary },
							]}
						>
							{x === "all" ? "Todas" : meta[x].label}
						</Text>
					</Pressable>
				))}
			</View>
			{list.map((item) => (
				<Card key={item.id} style={styles.row}>
					<View style={styles.activityIcon}>
						<MaterialCommunityIcons
							name={meta[item.type].icon}
							size={24}
							color={theme.activity}
						/>
					</View>
					<View style={{ flex: 1 }}>
						<Text style={styles.name}>{meta[item.type].label}</Text>
						<Text style={styles.muted}>
							{item.date} · {item.distanceKm.toFixed(1)} km ·{" "}
							{item.durationMinutes} min · {item.calories} kcal
						</Text>
					</View>
					<Pressable
						onPress={() =>
							router.push({
								pathname: "/activities/form",
								params: { id: item.id },
							})
						}
					>
						<MaterialCommunityIcons
							name="pencil-outline"
							size={22}
							color={theme.primary}
						/>
					</Pressable>
					<Pressable onPress={() => remove(item.id)}>
						<MaterialCommunityIcons
							name="delete-outline"
							size={22}
							color={theme.error}
						/>
					</Pressable>
				</Card>
			))}
		</Screen>
	);
}
const createStyles = (theme: ThemeTokens) =>
	StyleSheet.create({
		highlight: {
			backgroundColor: theme.activityContainer,
			flexDirection: "row",
			justifyContent: "space-between",
			alignItems: "center",
		},
		eyebrow: { color: theme.activity, fontSize: 11, fontWeight: "800" },
		big: { color: theme.onActivityContainer, fontSize: 23, fontWeight: "900" },
		onDark: { color: theme.onActivityContainer, opacity: 0.82 },
		types: { flexDirection: "row", gap: 8 },
		type: {
			flex: 1,
			minHeight: 86,
			backgroundColor: theme.activityContainer,
			borderRadius: radius.md,
			alignItems: "center",
			justifyContent: "center",
			gap: 5,
		},
		typeText: {
			color: theme.onActivityContainer,
			fontSize: 12,
			fontWeight: "800",
		},
		heading: {
			flexDirection: "row",
			justifyContent: "space-between",
			alignItems: "center",
		},
		link: { color: theme.primary, fontWeight: "800", fontSize: 12 },
		filters: { flexDirection: "row", gap: 7, flexWrap: "wrap" },
		chip: {
			paddingHorizontal: 13,
			paddingVertical: 8,
			borderRadius: 18,
			borderWidth: 1,
			borderColor: theme.outline,
		},
		chipActive: {
			backgroundColor: theme.primary,
			borderColor: theme.primary,
		},
		chipText: { fontSize: 12, color: theme.onSurface, fontWeight: "700" },
		row: {
			flexDirection: "row",
			gap: 10,
			alignItems: "center",
			paddingVertical: 12,
		},
		activityIcon: {
			width: 42,
			height: 42,
			borderRadius: 14,
			backgroundColor: theme.activityContainer,
			alignItems: "center",
			justifyContent: "center",
		},
		name: { color: theme.onSurface, fontWeight: "800" },
		muted: { color: theme.onSurfaceVariant, fontSize: 11 },
	});

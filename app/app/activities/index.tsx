import { router } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, View } from "react-native";
import { Chip, IconButton, SegmentedButtons, Text } from "react-native-paper";
import {
	Button,
	Card,
	EmptyState,
	Header,
	Screen,
} from "@/components/vitalis/ui";
import { DateField } from "@/components/vitalis/date-field";
import { useAppTheme } from "@/hooks/use-app-theme";
import { goBackOrReplace } from "@/lib/navigation";
import { useAppState } from "@/state/app-state";
import { selectActivityStats } from "@/state/selectors";
import type { ActivityType } from "@/state/types";
import { useConfirm } from "@/components/vitalis/confirmation";
const names = { run: "Corrida", walk: "Caminhada", cycling: "Ciclismo" };
export default function ActivitiesScreen() {
	const { state, dispatch } = useAppState(),
		theme = useAppTheme(),
		confirm = useConfirm();
	const [filter, setFilter] = useState<ActivityType | "all">("all"),
		[date, setDate] = useState(""),
		[sort, setSort] = useState<"date" | "type">("date"),
		[period, setPeriod] = useState<"week" | "month">("week");
	const stats = selectActivityStats(state, period);
	const list = useMemo(
		() =>
			state.activities
				.filter(
					(x) =>
						(filter === "all" || x.type === filter) &&
						(!date || x.date === date),
				)
				.sort((a, b) =>
					sort === "date"
						? b.date.localeCompare(a.date)
						: a.type.localeCompare(b.type),
				),
		[state.activities, filter, date, sort],
	);
	return (
		<Screen scroll={false}>
			<Header
				title="Atividades"
				onBack={() => goBackOrReplace(router, "/(tabs)")}
			/>
			<FlatList
				data={list}
				keyExtractor={(x) => x.id}
				keyboardShouldPersistTaps="handled"
				contentContainerStyle={{ gap: 12, paddingBottom: 16 }}
				ListHeaderComponent={
					<View style={{ gap: 16 }}>
						<SegmentedButtons
							value={period}
							onValueChange={(x) => setPeriod(x as "week" | "month")}
							buttons={[
								{
									value: "week",
									label: "7 dias",
									style: { minHeight: 48, justifyContent: "center" },
									labelStyle: { lineHeight: 30 },
								},
								{
									value: "month",
									label: "30 dias",
									style: { minHeight: 48, justifyContent: "center" },
									labelStyle: { lineHeight: 30 },
								},
							]}
						/>
						<Card>
							<Text variant="titleLarge">{stats.activityCount} atividades</Text>
							<Text>
								{(stats.durationSeconds / 60).toFixed(1)} min ·{" "}
								{(stats.distanceMeters / 1000).toFixed(2)} km · {stats.calories}{" "}
								kcal
							</Text>
							<Text>{stats.steps.toLocaleString("pt-BR")} passos</Text>
							<Text>
								{stats.trend === "up"
									? "↑"
									: stats.trend === "down"
										? "↓"
										: "→"}{" "}
								Média de passos: {stats.stepAverage.toFixed(0)} · anterior:{" "}
								{stats.previousStepAverage.toFixed(0)}
							</Text>
						</Card>
						<Text variant="titleLarge">Iniciar atividade</Text>
						<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
							{(Object.keys(names) as ActivityType[]).map((type) => (
								<Button
									key={type}
									title={names[type]}
									variant="outline"
									onPress={() =>
										router.push({
											pathname: "/activities/workout",
											params: { type },
										})
									}
								/>
							))}
						</View>
						<Button
							title="Registrar atividade manual"
							icon="plus"
							onPress={() => router.push("/activities/form")}
						/>
						<DateField
							label="Filtrar por data"
							value={date}
							onChange={setDate}
							optional
						/>
						<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
							{(["all", "run", "walk", "cycling"] as const).map((type) => (
								<Chip
									key={type}
									style={{ minHeight: 48 }}
									textStyle={{ minHeight: 36 }}
									selected={filter === type}
									onPress={() => setFilter(type)}
									accessibilityLabel={
										type === "all" ? "Todas as atividades" : names[type]
									}
								>
									{type === "all" ? "Todas" : names[type]}
								</Chip>
							))}
						</View>
						<Button
							title={`Ordenar: ${sort === "date" ? "data" : "tipo"}`}
							variant="text"
							onPress={() => setSort(sort === "date" ? "type" : "date")}
						/>
					</View>
				}
				ListEmptyComponent={
					<EmptyState
						icon="run"
						title="Sem atividades"
						text="Registre um exercício ou ajuste os filtros."
					/>
				}
				renderItem={({ item }) => (
					<Card>
						<Text variant="titleMedium">{names[item.type]}</Text>
						<Text>
							{item.date} · {item.distanceKm.toFixed(2)} km ·{" "}
							{(item.durationSeconds
								? item.durationSeconds / 60
								: item.durationMinutes
							).toFixed(1)}{" "}
							min · {item.calories} kcal
						</Text>
						<View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
							<IconButton
								style={{ width: 48, height: 48 }}
								icon="pencil-outline"
								size={24}
								accessibilityLabel={`Editar ${names[item.type]}`}
								onPress={() =>
									router.push({
										pathname: "/activities/form",
										params: { id: item.id },
									})
								}
							/>
							<IconButton
								style={{ width: 48, height: 48 }}
								icon="delete-outline"
								iconColor={theme.error}
								size={24}
								accessibilityLabel={`Excluir ${names[item.type]}`}
								onPress={() =>
									confirm(
										"Excluir atividade?",
										"As estatísticas serão atualizadas.",
										() => dispatch({ type: "ACTIVITY_DELETE", id: item.id }),
									)
								}
							/>
						</View>
					</Card>
				)}
			/>
		</Screen>
	);
}

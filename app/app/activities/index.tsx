import { StepTrend } from "@/components/vitalis/step-trend";
import { selectActivityStats } from "@/state/selectors";
import { formatDate, formatNumber } from "@/lib/format";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, View } from "react-native";
import { Chip, IconButton, Text } from "react-native-paper";
import {
	Button,
	Card,
	EmptyState,
	Header,
	Screen,
} from "@/components/vitalis/ui";
import { DateRangeFilter } from "@/components/vitalis/date-range-filter";
import { filterByDateRange, recentDateRange, type DateRange } from "@/lib/date-filter";
import { useAppTheme } from "@/hooks/use-app-theme";
import { goBackOrReplace } from "@/lib/navigation";
import { useAppState } from "@/state/app-state";
import type { ActivityType } from "@/state/types";
import { useConfirm } from "@/components/vitalis/confirmation";
const names = { run: "Corrida", walk: "Caminhada", cycling: "Ciclismo" };
export default function ActivitiesScreen() {
	const { state, dispatch } = useAppState(),
		theme = useAppTheme(),
		confirm = useConfirm();
	const [filter, setFilter] = useState<ActivityType | "all">("all"),
		[range, setRange] = useState<DateRange | null>(() => recentDateRange(7)),
		[sort, setSort] = useState<"date" | "type">("date");
	const list = useMemo(
		() =>
			filterByDateRange(state.activities, range)
				.filter((x) => filter === "all" || x.type === filter)
				.sort((a, b) =>
					sort === "date"
						? b.date.localeCompare(a.date) || b.id.localeCompare(a.id)
						: a.type.localeCompare(b.type) || b.date.localeCompare(a.date) || b.id.localeCompare(a.id),
				),
		[state.activities, filter, range, sort],
	);
	const stats = list.reduce((totals, activity) => ({
		durationSeconds: totals.durationSeconds + (activity.durationSeconds ?? activity.durationMinutes * 60),
		distanceMeters: totals.distanceMeters + activity.distanceKm * 1000,
		calories: totals.calories + activity.calories,
	}), { durationSeconds: 0, distanceMeters: 0, calories: 0 });
	const trend = selectActivityStats(state, "week");
	const steps = filterByDateRange(state.dailySteps ?? [], range)
		.reduce((total, row) => total + row.steps, 0);
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
						<DateRangeFilter value={range} onChange={setRange} />
						<Card>
							<Text variant="titleLarge">{formatNumber(list.length)} {list.length === 1 ? "atividade" : "atividades"}</Text>
							<StepTrend trend={trend.trend} trendPercent={trend.trendPercent} />
							<Text>
								{formatNumber(stats.durationSeconds / 60, 1)} min ·{" "}
								{formatNumber(stats.distanceMeters / 1000, 2)} km · {formatNumber(stats.calories)}{" "}
								kcal
							</Text>
							<Text>{formatNumber(steps)} passos no período</Text>
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
							{formatDate(item.date)} · {formatNumber(item.distanceKm, 2)} km ·{" "}
							{formatNumber(item.durationSeconds
								? item.durationSeconds / 60
								: item.durationMinutes, 1)}{" "}
							min · {formatNumber(item.calories)} kcal
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

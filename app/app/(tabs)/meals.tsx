import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import {
	Button,
	Card,
	Eyebrow,
	Field,
	ProgressBar,
	Screen,
	Subtitle,
	Title,
} from "@/components/vitalis/ui";
import { radius, ThemeTokens } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { isoDate } from "@/lib/health";
import { useAppState, useDailySummary } from "@/state/app-state";

export default function MealsScreen() {
	const theme = useAppTheme();
	const styles = useMemo(() => createStyles(theme), [theme]);
	const { state, dispatch } = useAppState();
	const [date, setDate] = useState(isoDate());
	const summary = useDailySummary(date);
	const meals = useMemo(
		() =>
			state.meals
				.filter((meal) => meal.date === date)
				.sort((a, b) => a.time.localeCompare(b.time)),
		[state.meals, date],
	);
	const [editingGoals, setEditingGoals] = useState(false);
	const [goal, setGoal] = useState(String(state.goals.calories));
	const [limit, setLimit] = useState(String(state.goals.mealCalories));
	const remaining = state.goals.calories - summary.calories;
	const remove = (id: string) =>
		Alert.alert("Excluir refeição?", "As calorias serão recalculadas.", [
			{ text: "Cancelar" },
			{
				text: "Excluir",
				style: "destructive",
				onPress: () => dispatch({ type: "MEAL_DELETE", id }),
			},
		]);
	return (
		<Screen>
			<View>
				<Eyebrow>Diário alimentar</Eyebrow>
				<Title>Alimentação</Title>
			</View>
			<Field
				label="Data"
				value={date}
				onChangeText={setDate}
				placeholder="AAAA-MM-DD"
			/>
			<Card style={styles.summaryCard}>
				<Text
					style={[styles.remaining, remaining < 0 && { color: theme.error }]}
				>
					{remaining}
				</Text>
				<Text style={styles.summaryMuted}>
					{remaining < 0 ? "kcal acima da meta" : "kcal restantes"}
				</Text>
				<View style={styles.equation}>
					<Text style={styles.equationText}>{state.goals.calories} meta</Text>
					<Text style={styles.equationText}>−</Text>
					<Text style={styles.equationText}>{summary.calories} consumidas</Text>
				</View>
				<ProgressBar value={summary.calorieProgress} color={theme.food} />
				<Button
					title={editingGoals ? "Fechar metas" : "Configurar metas"}
					variant="text"
					onPress={() => setEditingGoals((value) => !value)}
				/>
				{editingGoals ? (
					<View style={{ gap: 10 }}>
						<Field
							label="Meta diária (kcal)"
							keyboardType="numeric"
							value={goal}
							onChangeText={setGoal}
						/>
						<Field
							label="Limite por refeição (kcal)"
							keyboardType="numeric"
							value={limit}
							onChangeText={setLimit}
						/>
						<Button
							title="Salvar metas"
							onPress={() => {
								const calorieGoal = Number(goal);
								const mealLimit = Number(limit);
								if (calorieGoal > 0 && mealLimit > 0) {
									dispatch({
										type: "GOALS",
										value: { calories: calorieGoal, mealCalories: mealLimit },
									});
									setEditingGoals(false);
								}
							}}
						/>
					</View>
				) : null}
			</Card>
			<View style={styles.section}>
				<Subtitle>Refeições</Subtitle>
				<Button
					title="Adicionar"
					variant="text"
					onPress={() => router.push("/meals/form")}
				/>
			</View>
			{meals.map((meal) => (
				<Card key={meal.id}>
					<View style={styles.mealTop}>
						<View style={styles.mealIcon}>
							<MaterialCommunityIcons
								name="food-apple-outline"
								size={24}
								color={theme.food}
							/>
						</View>
						<View style={{ flex: 1 }}>
							<Text style={styles.mealName}>{meal.name}</Text>
							<Text style={styles.muted}>
								{meal.time} · {meal.calories} kcal · {meal.quantity} {meal.unit}
							</Text>
						</View>
					</View>
					{meal.calories > state.goals.mealCalories ? (
						<Text style={styles.warning}>
							Esta refeição excedeu o limite de {state.goals.mealCalories} kcal.
						</Text>
					) : null}
					<View style={styles.actions}>
						<Button
							title="Editar"
							variant="text"
							onPress={() =>
								router.push({
									pathname: "/meals/form",
									params: { id: meal.id },
								})
							}
						/>
						<Button
							title="Excluir"
							variant="danger"
							onPress={() => remove(meal.id)}
						/>
					</View>
				</Card>
			))}
			{!meals.length ? (
				<Card>
					<Text style={styles.muted}>
						Nenhuma refeição registrada nesta data.
					</Text>
				</Card>
			) : null}
			<Pressable
				accessibilityLabel="Adicionar refeição"
				style={styles.fab}
				onPress={() => router.push("/meals/form")}
			>
				<MaterialCommunityIcons name="plus" size={28} color={theme.onPrimary} />
			</Pressable>
		</Screen>
	);
}

const createStyles = (theme: ThemeTokens) =>
	StyleSheet.create({
		summaryCard: { backgroundColor: theme.foodContainer },
		remaining: {
			fontSize: 35,
			fontWeight: "900",
			color: theme.onFoodContainer,
		},
		summaryMuted: { color: theme.onFoodContainer, opacity: 0.8, fontSize: 12 },
		equation: { flexDirection: "row", justifyContent: "space-between" },
		equationText: { color: theme.onFoodContainer, fontWeight: "700" },
		section: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
		},
		mealTop: { flexDirection: "row", gap: 12, alignItems: "center" },
		mealIcon: {
			width: 45,
			height: 45,
			borderRadius: 15,
			backgroundColor: theme.foodContainer,
			alignItems: "center",
			justifyContent: "center",
		},
		mealName: { color: theme.onSurface, fontWeight: "800", fontSize: 15 },
		muted: { color: theme.onSurfaceVariant, fontSize: 12 },
		warning: {
			color: theme.onWarningContainer,
			backgroundColor: theme.warningContainer,
			padding: 10,
			borderRadius: radius.sm,
			fontSize: 12,
		},
		actions: { flexDirection: "row", justifyContent: "flex-end" },
		fab: {
			alignSelf: "flex-end",
			width: 58,
			height: 58,
			borderRadius: 18,
			backgroundColor: theme.primary,
			alignItems: "center",
			justifyContent: "center",
			elevation: 5,
		},
	});

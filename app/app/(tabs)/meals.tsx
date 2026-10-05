import { formatDate, formatNumber } from "@/lib/format";
import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { FAB, HelperText, Text } from "react-native-paper";
import { goalsUpdateSchema } from "@vitalis/contracts";
import { DateRangeFilter } from "@/components/vitalis/date-range-filter";
import { filterByDateRange, recentDateRange, type DateRange } from "@/lib/date-filter";
import { FormDialog } from "@/components/vitalis/form-dialog";
import { useConfirm } from "@/components/vitalis/confirmation";
import {
	Button,
	Card,
	Eyebrow,
	Field,
	Muted,
	ProgressBar,
	Screen,
	Subtitle,
	Title,
} from "@/components/vitalis/ui";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useSubmit } from "@/hooks/use-submit";
import { parseInput, parseDecimal } from "@/lib/validation";
import { useAppState, useDailySummary } from "@/state/app-state";
export default function MealsScreen() {
	const { state, dispatch } = useAppState(),
		theme = useAppTheme(),
		confirm = useConfirm(),
		{ submit, saving, error } = useSubmit();
	const [range, setRange] = useState<DateRange | null>(() => recentDateRange(7)),
		[editing, setEditing] = useState(false),
		[goal, setGoal] = useState(String(state.goals.calories)),
		[limit, setLimit] = useState(String(state.goals.mealCalories));
	const summary = useDailySummary(),
		remaining = state.goals.calories - summary.calories,
		meals = filterByDateRange(state.meals, range)
			.sort((a, b) => b.date.localeCompare(a.date) || a.time.localeCompare(b.time));
	const save = () =>
		submit(async () => {
			const value = parseInput(goalsUpdateSchema, {
				calories: parseDecimal(goal),
				mealCalories: parseDecimal(limit),
			});
			await dispatch({ type: "GOALS", value });
			setEditing(false);
		});
	return (
		<Screen>
			<Eyebrow>Diário alimentar</Eyebrow>
			<Title>Alimentação</Title>
			<Card style={{ backgroundColor: theme.foodContainer }}>
				<Text variant="titleMedium" style={{ color: theme.onFoodContainer }}>Resumo de hoje</Text>
				<Text
					variant="displaySmall"
					style={{ color: remaining < 0 ? theme.error : theme.onFoodContainer }}
				>
					{formatNumber(Math.abs(remaining))}
				</Text>
				<Text style={{ color: theme.onFoodContainer }}>
					{remaining < 0 ? "kcal acima da meta" : "kcal restantes"}
				</Text>
				<Text style={{ color: theme.onFoodContainer }}>
					Meta {formatNumber(state.goals.calories)} − consumidas {formatNumber(summary.calories)}
				</Text>
				<ProgressBar value={summary.calorieProgress} color={theme.food} />
				<Button
					title="Configurar metas"
					variant="text"
					onPress={() => {
						setGoal(String(state.goals.calories));
						setLimit(String(state.goals.mealCalories));
						setEditing(true);
					}}
				/>
			</Card>
			<Subtitle>Refeições</Subtitle>
			<DateRangeFilter value={range} onChange={setRange} />
			<Muted>{formatNumber(meals.length)} {meals.length === 1 ? "refeição" : "refeições"} · {formatNumber(meals.reduce((total, meal) => total + meal.calories, 0))} kcal no período</Muted>
			{meals.map((meal) => (
				<Card key={meal.id}>
					<Text variant="titleMedium">{meal.name}</Text>
					<Muted>
						{formatDate(meal.date)} · {meal.time} · {formatNumber(meal.calories)} kcal · {formatNumber(meal.quantity)} {meal.unit}
					</Muted>
					{meal.calories > state.goals.mealCalories && (
						<Text
							accessibilityLiveRegion="polite"
							style={{
								backgroundColor: theme.warningContainer,
								color: theme.onWarningContainer,
								padding: 12,
								borderRadius: 12,
							}}
						>
							Esta refeição excedeu o limite de {formatNumber(state.goals.mealCalories)} kcal.
						</Text>
					)}
					<View
						style={{
							flexDirection: "row",
							flexWrap: "wrap",
							justifyContent: "flex-end",
						}}
					>
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
							onPress={() =>
								confirm(
									"Excluir refeição?",
									"As calorias serão recalculadas.",
									() => dispatch({ type: "MEAL_DELETE", id: meal.id }),
								)
							}
						/>
					</View>
				</Card>
			))}
			{!meals.length && <Muted>Nenhuma refeição no período selecionado.</Muted>}
			<FAB
				icon="plus"
				label="Adicionar refeição"
				onPress={() => router.push("/meals/form")}
			/>
			<FormDialog
				visible={editing}
				dismissable={!saving}
				onDismiss={() => setEditing(false)}
				title="Metas de alimentação"
				actions={[
					<Button
						key="cancel"
						title="Cancelar"
						variant="text"
						disabled={saving}
						onPress={() => setEditing(false)}
					/>,
					<Button
						key="save"
						title="Salvar metas"
						loading={saving}
						onPress={save}
					/>,
				]}
			>
				<Field
					label="Meta diária (kcal)"
					value={goal}
					onChangeText={setGoal}
					keyboardType="numeric"
				/>
				<Field
					label="Limite por refeição (kcal)"
					value={limit}
					onChangeText={setLimit}
					keyboardType="numeric"
				/>
				{error && <HelperText type="error">{error}</HelperText>}
			</FormDialog>
		</Screen>
	);
}

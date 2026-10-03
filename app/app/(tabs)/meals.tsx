import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { FAB, HelperText, Text } from "react-native-paper";
import { goalsUpdateSchema } from "@vitalis/contracts";
import { DateField } from "@/components/vitalis/date-field";
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
import { isoDate } from "@/lib/health";
import { parseInput, parseDecimal } from "@/lib/validation";
import { useAppState, useDailySummary } from "@/state/app-state";
export default function MealsScreen() {
	const { state, dispatch } = useAppState(),
		theme = useAppTheme(),
		confirm = useConfirm(),
		{ submit, saving, error } = useSubmit();
	const [date, setDate] = useState(isoDate()),
		[editing, setEditing] = useState(false),
		[goal, setGoal] = useState(String(state.goals.calories)),
		[limit, setLimit] = useState(String(state.goals.mealCalories));
	const summary = useDailySummary(date),
		remaining = state.goals.calories - summary.calories,
		meals = state.meals
			.filter((x) => x.date === date)
			.sort((a, b) => a.time.localeCompare(b.time));
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
			<DateField value={date} onChange={setDate} />
			<Card style={{ backgroundColor: theme.foodContainer }}>
				<Text
					variant="displaySmall"
					style={{ color: remaining < 0 ? theme.error : theme.onFoodContainer }}
				>
					{Math.abs(remaining)}
				</Text>
				<Text style={{ color: theme.onFoodContainer }}>
					{remaining < 0 ? "kcal acima da meta" : "kcal restantes"}
				</Text>
				<Text style={{ color: theme.onFoodContainer }}>
					Meta {state.goals.calories} − consumidas {summary.calories}
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
			{meals.map((meal) => (
				<Card key={meal.id}>
					<Text variant="titleMedium">{meal.name}</Text>
					<Muted>
						{meal.time} · {meal.calories} kcal · {meal.quantity} {meal.unit}
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
							Esta refeição excedeu o limite de {state.goals.mealCalories} kcal.
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
			{!meals.length && <Muted>Nenhuma refeição nesta data.</Muted>}
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

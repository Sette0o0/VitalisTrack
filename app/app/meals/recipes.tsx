import { useState } from "react";
import { router } from "expo-router";
import { HelperText, Text } from "react-native-paper";
import { recipeInputSchema, type Recipe, type NutritionValues } from "@vitalis/contracts";
import {
	Button,
	Card,
	Field,
	Header,
	Screen,
	Subtitle,
	Title,
	Muted,
} from "@/components/vitalis/ui";
import { useAppState } from "@/state/app-state";
import { useSubmit } from "@/hooks/use-submit";
import { newId } from "@/lib/health";
import { parseDecimal, parseInput } from "@/lib/validation";
import { formatNumber } from "@/lib/format";
import { goBackOrReplace } from "@/lib/navigation";
const labels = {
	calories: "Calorias (kcal)",
	proteins: "Proteínas (g)",
	carbohydrates: "Carboidratos (g)",
	fat: "Gorduras (g)",
};
export default function RecipesScreen() {
	const { state, dispatch } = useAppState(),
		{ submit, saving, error } = useSubmit();
	const [creating, setCreating] = useState(false),
		[selected, setSelected] = useState<Recipe | null>(null);
	const [name, setName] = useState(""),
		[ingredients, setIngredients] = useState(""),
		[instructions, setInstructions] = useState("");
	const [values, setValues] = useState({ calories: "", proteins: "", carbohydrates: "", fat: "" });
	const rows = state.recipes ?? [];
	return (
		<Screen>
			<Header title="Minhas receitas" onBack={() => goBackOrReplace(router, "/(tabs)/meals")} />
			<Title>{state.profile.name}</Title>
			{!creating && (
				<Button
					title="Cadastrar receita"
					onPress={() => {
						setCreating(true);
						setSelected(null);
					}}
				/>
			)}
			{creating && (
				<Card>
					<Field label="Nome da receita" value={name} onChangeText={setName} />
					<Field label="Ingredientes" value={ingredients} onChangeText={setIngredients} multiline />
					<Field
						label="Modo de preparo"
						value={instructions}
						onChangeText={setInstructions}
						multiline
					/>
					<Subtitle>Informações nutricionais estimadas</Subtitle>
					<Muted>Valores para a receita inteira. Os campos são opcionais.</Muted>
					{(Object.keys(labels) as (keyof NutritionValues)[]).map((key) => (
						<Field
							key={key}
							label={labels[key]}
							value={values[key]}
							onChangeText={(value) => setValues((p) => ({ ...p, [key]: value }))}
							keyboardType="decimal-pad"
						/>
					))}
					<Button
						title="Salvar receita"
						loading={saving}
						onPress={() =>
							void submit(async () => {
								const nutrition = Object.fromEntries(
									Object.entries(values).map(([k, v]) => [k, v.trim() ? parseDecimal(v) : null]),
								);
								const input = parseInput(recipeInputSchema, {
									id: newId(),
									name,
									ingredients,
									instructions,
									nutrition: Object.values(values).some((v) => v.trim()) ? nutrition : null,
								});
								const now = new Date().toISOString();
								await dispatch({
									type: "RECIPE_SAVE",
									value: { ...input, createdAt: now, updatedAt: now, deletedAt: null },
								});
								setCreating(false);
								setName("");
								setIngredients("");
								setInstructions("");
								setValues({ calories: "", proteins: "", carbohydrates: "", fat: "" });
							})
						}
					/>
					<Button
						title="Cancelar"
						variant="text"
						disabled={saving}
						onPress={() => setCreating(false)}
					/>
				</Card>
			)}
			{error && (
				<HelperText type="error" accessibilityLiveRegion="polite">
					{error}
				</HelperText>
			)}
			{!rows.length && !creating && <Muted>Nenhuma receita cadastrada neste perfil.</Muted>}
			{rows.map((row) => (
				<Card key={row.id}>
					<Button
						title={row.name}
						variant="text"
						onPress={() => setSelected(selected?.id === row.id ? null : row)}
					/>
					{selected?.id === row.id && (
						<>
							<Subtitle>Ingredientes</Subtitle>
							<Text>{row.ingredients}</Text>
							<Subtitle>Modo de preparo</Subtitle>
							<Text>{row.instructions}</Text>
							{row.nutrition &&
								(Object.keys(labels) as (keyof NutritionValues)[]).map((key) => (
									<Text key={key}>
										{labels[key]}:{" "}
										{row.nutrition?.[key] == null
											? "Não informado"
											: formatNumber(row.nutrition[key]!, 1)}
									</Text>
								))}
						</>
					)}
				</Card>
			))}
		</Screen>
	);
}

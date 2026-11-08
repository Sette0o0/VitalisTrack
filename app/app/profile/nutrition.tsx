import { useState } from "react";
import { router } from "expo-router";
import { HelperText, RadioButton } from "react-native-paper";
import { nutritionProfileInputSchema } from "@vitalis/contracts";
import { Button, Field, Header, Screen, Title, Muted } from "@/components/vitalis/ui";
import { useAppState } from "@/state/app-state";
import { useSubmit } from "@/hooks/use-submit";
import { parseInput } from "@/lib/validation";
import { goBackOrReplace } from "@/lib/navigation";
export default function NutritionScreen() {
	const { state, dispatch } = useAppState(),
		{ submit, saving, error } = useSubmit();
	const [objective, setObjective] = useState(state.nutrition?.objective ?? "maintain");
	const [restrictions, setRestrictions] = useState(
		(state.nutrition?.restrictions ?? []).join("\n"),
	);
	const [preferences, setPreferences] = useState((state.nutrition?.preferences ?? []).join("\n"));
	const items = (text: string) =>
		text
			.split(/[,\n]/)
			.map((s) => s.trim())
			.filter(Boolean);
	return (
		<Screen>
			<Header
				title="Perfil nutricional"
				onBack={() => goBackOrReplace(router, "/(tabs)/profile")}
			/>
			<Title>{state.profile.name}</Title>
			<Muted>Defina seu objetivo e informe uma preferência ou restrição por linha.</Muted>
			<RadioButton.Group
				value={objective}
				onValueChange={(v) => setObjective(v as typeof objective)}
			>
				{[
					["lose", "Perder peso"],
					["maintain", "Manter peso"],
					["gain", "Ganhar peso"],
				].map(([value, label]) => (
					<RadioButton.Item key={value} value={value} label={label} style={{ minHeight: 48 }} labelStyle={{lineHeight:undefined}} />
				))}
			</RadioButton.Group>
			<Field
				label="Restrições alimentares"
				value={restrictions}
				onChangeText={setRestrictions}
				multiline
			/>
			<Field
				label="Preferências alimentares"
				value={preferences}
				onChangeText={setPreferences}
				multiline
			/>
			<Button
				title="Salvar perfil nutricional"
				loading={saving}
				onPress={() =>
					void submit(async () => {
						const input = parseInput(nutritionProfileInputSchema, {
							objective,
							restrictions: items(restrictions),
							preferences: items(preferences),
						});
						await dispatch({
							type: "NUTRITION",
							value: { ...input, updatedAt: new Date().toISOString() },
						});
						goBackOrReplace(router, "/(tabs)/profile");
					})
				}
			/>
			{error && (
				<HelperText type="error" accessibilityLiveRegion="polite">
					{error}
				</HelperText>
			)}
		</Screen>
	);
}

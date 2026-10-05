import { decimalInput } from "@/lib/format";
import { mealInputSchema } from "@vitalis/contracts";
import { parseInput, parseDecimal } from "@/lib/validation";
import { useSubmit } from "@/hooks/use-submit";
import { HelperText, SegmentedButtons } from "react-native-paper";
import { DateField, TimeField } from "@/components/vitalis/date-field";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
	Button,
	Field,
	Header,
	Muted,
	Screen,
	Title,
} from "@/components/vitalis/ui";
import { radius, ThemeTokens } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { isoDate, newId } from "@/lib/health";
import { goBackOrReplace } from "@/lib/navigation";
import { useAppState } from "@/state/app-state";

export default function MealFormScreen() {
	const theme = useAppTheme();
	const styles = useMemo(() => createStyles(theme), [theme]);
	const { id } = useLocalSearchParams<{ id?: string }>();
	const { submit, saving, error } = useSubmit();
	const { state, dispatch } = useAppState();
	const existing = state.meals.find((x) => x.id === id);
	const [name, setName] = useState(existing?.name ?? "");
	const [date, setDate] = useState(existing?.date ?? isoDate());
	const [time, setTime] = useState(
		existing?.time ??
			new Date().toLocaleTimeString("pt-BR", {
				hour: "2-digit",
				minute: "2-digit",
				hour12: false,
			}),
	);
	const [quantity, setQuantity] = useState(decimalInput(existing?.quantity));
	const [unit, setUnit] = useState<"g" | "mL">(existing?.unit ?? "g");
	const [calories, setCalories] = useState(String(existing?.calories ?? ""));
	const save = () =>
		submit(async () => {
			const meal = parseInput(mealInputSchema, {
				id: existing?.id ?? newId(),
				name: name.trim(),
				date,
				time,
				quantity: parseDecimal(quantity),
				unit,
				calories: parseDecimal(calories),
			});
			await dispatch({ type: "MEAL_SAVE", value: meal });
			goBackOrReplace(router, "/(tabs)/meals");
		});
	return (
		<Screen>
			<Header
				title={existing ? "Editar refeição" : "Nova refeição"}
				onBack={() => goBackOrReplace(router, "/(tabs)/meals")}
			/>
			<Title>{existing ? "Atualize o registro" : "O que você comeu?"}</Title>
			<Muted>
				Os registros ficam salvos no celular e são sincronizados quando há
				conexão.
			</Muted>
			<Field label="Alimento ou refeição" value={name} onChangeText={setName} />
			<View style={styles.row}>
				<View style={{ flex: 1 }}>
					<DateField value={date} onChange={setDate} />
				</View>
				<View style={{ flex: 1 }}>
					<TimeField value={time} onChange={setTime} />
				</View>
			</View>
			<View>
				<View>
					<Field
						label="Quantidade"
						keyboardType="decimal-pad"
						value={quantity}
						onChangeText={setQuantity}
					/>
				</View>
				<SegmentedButtons
					value={unit}
					onValueChange={(x) => setUnit(x as "g" | "mL")}
					buttons={[
						{
							value: "g",
							label: "Gramas",
							style: { minHeight: 48, justifyContent: "center" },
							labelStyle: { lineHeight: 30 },
						},
						{
							value: "mL",
							label: "mL",
							style: { minHeight: 48, justifyContent: "center" },
							labelStyle: { lineHeight: 30 },
						},
					]}
				/>
			</View>
			<Field
				label="Calorias (kcal)"
				keyboardType="numeric"
				value={calories}
				onChangeText={setCalories}
			/>
			<Button title="Salvar refeição" loading={saving} onPress={save} />
			{error ? (
				<HelperText type="error" accessibilityLiveRegion="polite">
					{error}
				</HelperText>
			) : null}
		</Screen>
	);
}
const createStyles = (theme: ThemeTokens) =>
	StyleSheet.create({
		row: { gap: 10 },
		segment: {
			height: 52,
			flexDirection: "row",
			borderWidth: 1,
			borderColor: theme.outline,
			borderRadius: radius.sm,
			overflow: "hidden",
		},
		segmentButton: {
			width: 58,
			alignItems: "center",
			justifyContent: "center",
		},
		segmentSelected: { backgroundColor: theme.primary },
	});

import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
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
import { useAppState } from "@/state/app-state";
import type { Meal } from "@/state/types";

export default function MealFormScreen() {
	const theme = useAppTheme();
	const styles = useMemo(() => createStyles(theme), [theme]);
	const { id } = useLocalSearchParams<{ id?: string }>();
	const { state, dispatch } = useAppState();
	const existing = state.meals.find((x) => x.id === id);
	const [name, setName] = useState(existing?.name ?? "");
	const [date, setDate] = useState(existing?.date ?? isoDate());
	const [time, setTime] = useState(
		existing?.time ??
			new Date().toLocaleTimeString("pt-BR", {
				hour: "2-digit",
				minute: "2-digit",
			}),
	);
	const [quantity, setQuantity] = useState(String(existing?.quantity ?? ""));
	const [unit, setUnit] = useState<"g" | "mL">(existing?.unit ?? "g");
	const [calories, setCalories] = useState(String(existing?.calories ?? ""));
	const save = () => {
		const q = Number(quantity),
			c = Number(calories);
		if (!name.trim() || q <= 0 || c < 0 || !/^\d{2}:\d{2}$/.test(time))
			return Alert.alert(
				"Dados inválidos",
				"Preencha nome, horário, quantidade e calorias corretamente.",
			);
		const meal: Meal = {
			id: existing?.id ?? newId("meal"),
			name: name.trim(),
			date,
			time,
			quantity: q,
			unit,
			calories: c,
		};
		dispatch({ type: "MEAL_SAVE", value: meal });
		router.back();
	};
	return (
		<Screen>
			<Header
				title={existing ? "Editar refeição" : "Nova refeição"}
				onBack={() => router.back()}
			/>
			<Title>{existing ? "Atualize o registro" : "O que você comeu?"}</Title>
			<Muted>Os dados ficam apenas nesta sessão.</Muted>
			<Field label="Alimento ou refeição" value={name} onChangeText={setName} />
			<View style={styles.row}>
				<View style={{ flex: 1 }}>
					<Field label="Data" value={date} onChangeText={setDate} />
				</View>
				<View style={{ flex: 1 }}>
					<Field label="Horário" value={time} onChangeText={setTime} />
				</View>
			</View>
			<View style={styles.row}>
				<View style={{ flex: 1 }}>
					<Field
						label="Quantidade"
						keyboardType="decimal-pad"
						value={quantity}
						onChangeText={setQuantity}
					/>
				</View>
				<View style={styles.segment}>
					{(["g", "mL"] as const).map((x) => (
						<Pressable
							key={x}
							onPress={() => setUnit(x)}
							style={[
								styles.segmentButton,
								unit === x && styles.segmentSelected,
							]}
						>
							<Text
								style={{
									color: unit === x ? theme.onPrimary : theme.onSurface,
									fontWeight: "800",
								}}
							>
								{x}
							</Text>
						</Pressable>
					))}
				</View>
			</View>
			<Field
				label="Calorias (kcal)"
				keyboardType="numeric"
				value={calories}
				onChangeText={setCalories}
			/>
			<Button title="Salvar refeição" onPress={save} />
		</Screen>
	);
}
const createStyles = (theme: ThemeTokens) =>
	StyleSheet.create({
		row: { flexDirection: "row", gap: 10, alignItems: "flex-end" },
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

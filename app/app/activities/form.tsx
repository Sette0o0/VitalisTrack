import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Button, Field, Header, Screen, Title } from "@/components/vitalis/ui";
import { radius, ThemeTokens } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { calculateActivityCalories, isoDate, newId } from "@/lib/health";
import { useAppState } from "@/state/app-state";
import type { ActivityType } from "@/state/types";

export default function ActivityForm() {
	const theme = useAppTheme();
	const styles = useMemo(() => createStyles(theme), [theme]);
	const { id } = useLocalSearchParams<{ id?: string }>();
	const { state, dispatch } = useAppState();
	const item = state.activities.find((x) => x.id === id);
	const [type, setType] = useState<ActivityType>(item?.type ?? "run");
	const [date, setDate] = useState(item?.date ?? isoDate());
	const [duration, setDuration] = useState(String(item?.durationMinutes ?? ""));
	const [distance, setDistance] = useState(String(item?.distanceKm ?? ""));
	const save = () => {
		const d = Number(duration),
			km = Number(distance);
		if (d <= 0 || km < 0)
			return Alert.alert("Dados inválidos", "Duração deve ser maior que zero.");
		dispatch({
			type: "ACTIVITY_SAVE",
			value: {
				id: item?.id ?? newId("activity"),
				type,
				date,
				durationMinutes: d,
				distanceKm: km,
				calories: calculateActivityCalories(type, state.profile.weightKg, d),
			},
		});
		router.back();
	};
	return (
		<Screen>
			<Header
				title={item ? "Editar atividade" : "Nova atividade"}
				onBack={() => router.back()}
			/>
			<Title>Detalhes do exercício</Title>
			<View style={styles.segment}>
				{(["walk", "run", "cycling"] as ActivityType[]).map((x) => (
					<Pressable
						key={x}
						onPress={() => setType(x)}
						style={[styles.option, type === x && styles.active]}
					>
						<Text
							style={{
								color: type === x ? theme.onPrimary : theme.onSurface,
								fontWeight: "800",
							}}
						>
							{x === "walk"
								? "Caminhada"
								: x === "run"
									? "Corrida"
									: "Ciclismo"}
						</Text>
					</Pressable>
				))}
			</View>
			<Field label="Data" value={date} onChangeText={setDate} />
			<Field
				label="Duração (minutos)"
				value={duration}
				keyboardType="numeric"
				onChangeText={setDuration}
			/>
			<Field
				label="Distância (km)"
				value={distance}
				keyboardType="decimal-pad"
				onChangeText={setDistance}
			/>
			<Button title="Salvar atividade" onPress={save} />
		</Screen>
	);
}
const createStyles = (theme: ThemeTokens) =>
	StyleSheet.create({
		segment: {
			flexDirection: "row",
			borderWidth: 1,
			borderColor: theme.outline,
			borderRadius: radius.sm,
			overflow: "hidden",
		},
		option: {
			flex: 1,
			minHeight: 46,
			alignItems: "center",
			justifyContent: "center",
		},
		active: { backgroundColor: theme.primary },
	});

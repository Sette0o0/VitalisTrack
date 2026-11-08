import { useMeasurements } from "@/hooks/use-measurements";
import { decimalInput } from "@/lib/format";
import { activityInputSchema } from "@vitalis/contracts";
import { parseInput, parseDecimal } from "@/lib/validation";
import { useSubmit } from "@/hooks/use-submit";
import { HelperText, RadioButton } from "react-native-paper";
import { DateField } from "@/components/vitalis/date-field";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Button, Field, Header, Screen, Title } from "@/components/vitalis/ui";
import { calculateActivityCalories, isoDate, newId } from "@/lib/health";
import { goBackOrReplace } from "@/lib/navigation";
import { useAppState } from "@/state/app-state";
import type { ActivityType } from "@/state/types";

export default function ActivityForm() {
	const m = useMeasurements();
	const { id } = useLocalSearchParams<{ id?: string }>();
	const { submit, saving, error } = useSubmit();
	const { state, dispatch } = useAppState();
	const item = state.activities.find((x) => x.id === id);
	const [visibility,setVisibility]=useState<"private"|"friends">(item?.visibility??"private");
 const [heartRate,setHeartRate]=useState(item?.heartRate?.averageBpm == null ? "" : String(item.heartRate.averageBpm));
 const [type, setType] = useState<ActivityType>(item?.type ?? "run");
	const [date, setDate] = useState(item?.date ?? isoDate());
	const [duration, setDuration] = useState(decimalInput(item?.durationMinutes));
	const [distance, setDistance] = useState(
		decimalInput(item?.distanceKm == null ? undefined : m.distance(item.distanceKm)),
	);
	const save = () =>
		submit(async () => {
			const input = parseInput(activityInputSchema, {
				id: item?.id ?? newId(),
 visibility,
 heartRate:heartRate.trim() ? (item?.heartRate && heartRate===String(item.heartRate.averageBpm) ? item.heartRate : {source:"manual",averageBpm:parseDecimal(heartRate)}) : null,
				type,
				date,
				durationSeconds: Math.round(parseDecimal(duration) * 60),
				distanceMeters:
					(item && distance === decimalInput(m.distance(item.distanceKm))
						? item.distanceKm
						: m.distanceInput(parseDecimal(distance))) * 1000,
				route: item?.route ?? [],
			});
			await dispatch({
				type: "ACTIVITY_SAVE",
				value: {
					...input,
					durationMinutes: input.durationSeconds / 60,
					distanceKm: input.distanceMeters / 1000,
					calories: calculateActivityCalories(
						input.type,
						state.profile.weightKg,
						input.durationSeconds / 60,
					),
				},
			});
			goBackOrReplace(router, "/activities");
		});
	return (
		<Screen>
			<Header
				title={item ? "Editar atividade" : "Nova atividade"}
				onBack={() => goBackOrReplace(router, "/activities")}
			/>
			<Title>Detalhes do exercício</Title>
			<RadioButton.Group value={type} onValueChange={(x) => setType(x as ActivityType)}>
				<RadioButton.Item value="walk" label="Caminhada" style={{ minHeight: 48 }} />
				<RadioButton.Item value="run" label="Corrida" style={{ minHeight: 48 }} />
				<RadioButton.Item value="cycling" label="Ciclismo" style={{ minHeight: 48 }} />
			</RadioButton.Group>
			<RadioButton.Group value={visibility} onValueChange={v=>setVisibility(v as "private"|"friends")}><RadioButton.Item value="private" label="Atividade privada"/><RadioButton.Item value="friends" label="Visível para amigos"/></RadioButton.Group>
 <Field label="Frequência cardíaca média (bpm, opcional)" value={heartRate} onChangeText={setHeartRate} keyboardType="number-pad"/>
 <DateField value={date} onChange={setDate} />
			<Field
				label="Duração (minutos)"
				value={duration}
				keyboardType="decimal-pad"
				onChangeText={setDuration}
			/>
			<Field
				label={`Distância (${m.distanceUnit})`}
				value={distance}
				keyboardType="decimal-pad"
				onChangeText={setDistance}
			/>
			<Button title="Salvar atividade" loading={saving} onPress={save} />
			{error ? (
				<HelperText type="error" accessibilityLiveRegion="polite">
					{error}
				</HelperText>
			) : null}
		</Screen>
	);
}

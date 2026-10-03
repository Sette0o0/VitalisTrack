import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import {
	Dialog,
	HelperText,
	IconButton,
	Portal,
	Text,
} from "react-native-paper";
import { goalsUpdateSchema, waterInputSchema } from "@vitalis/contracts";
import {
	Button,
	Card,
	Field,
	Header,
	Screen,
	Subtitle,
} from "@/components/vitalis/ui";
import { HydrationSummary } from "@/components/vitalis/hydration";
import { useConfirm } from "@/components/vitalis/confirmation";
import { useSubmit } from "@/hooks/use-submit";
import { isoDate, newId } from "@/lib/health";
import { parseDecimal, parseInput } from "@/lib/validation";
import { goBackOrReplace } from "@/lib/navigation";
import { useAppState } from "@/state/app-state";
import type { WaterEntry } from "@/state/types";
export default function WaterScreen() {
	const { state, dispatch } = useAppState(),
		confirm = useConfirm(),
		{ submit, saving, error } = useSubmit();
	const [modal, setModal] = useState<"amount" | "goal" | null>(null),
		[value, setValue] = useState("350"),
		[editing, setEditing] = useState<WaterEntry | null>(null);
	const now = () =>
		new Date().toLocaleTimeString("pt-BR", {
			hour: "2-digit",
			minute: "2-digit",
		});
	const open = (entry?: WaterEntry) => {
		setEditing(entry ?? null);
		setValue(String(entry?.amountMl ?? 350));
		setModal("amount");
	};
	const quick = (amountMl: number) =>
		submit(async () => {
			await dispatch({
				type: "WATER_ADD",
				value: { amountMl, date: isoDate(), time: now() },
			});
		});
	const save = () =>
		submit(async () => {
			if (modal === "goal")
				await dispatch({
					type: "GOALS",
					value: parseInput(goalsUpdateSchema, {
						waterMl: parseDecimal(value),
					}),
				});
			else {
				const row = parseInput(waterInputSchema, {
					id: editing?.id ?? newId(),
					amountMl: parseDecimal(value),
					date: editing?.date ?? isoDate(),
					time: editing?.time ?? now(),
				});
				await dispatch(
					editing
						? { type: "WATER_UPDATE", value: row }
						: { type: "WATER_ADD", value: row },
				);
			}
			setModal(null);
		});
	return (
		<Screen>
			<Header
				title="Hidratação"
				onBack={() => goBackOrReplace(router, "/(tabs)")}
			/>
			<HydrationSummary />
			<Button
				title="Editar meta"
				variant="text"
				onPress={() => {
					setValue(String(state.goals.waterMl));
					setModal("goal");
				}}
			/>
			<Subtitle>Quanto você bebeu?</Subtitle>
			<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
				{[200, 500, 1000].map((n) => (
					<Button
						key={n}
						testID={`water-${n}`}
						title={n === 1000 ? "1 L" : `${n} mL`}
						variant="outline"
						disabled={saving}
						onPress={() => quick(n)}
					/>
				))}
			</View>
			<Button title="Informar outro valor" onPress={() => open()} />
			{error && !modal && <HelperText type="error">{error}</HelperText>}
			<Subtitle>Registros de hoje</Subtitle>
			{state.water
				.filter((x) => x.date === isoDate())
				.sort((a, b) => b.time.localeCompare(a.time))
				.map((row) => (
					<Card
						key={row.id}
						style={{ flexDirection: "row", alignItems: "center" }}
					>
						<View style={{ flex: 1 }}>
							<Text variant="titleMedium">{row.amountMl} mL</Text>
							<Text>{row.time}</Text>
						</View>
						<IconButton
							style={{ width: 48, height: 48 }}
							icon="pencil-outline"
							accessibilityLabel={`Editar água das ${row.time}`}
							onPress={() => open(row)}
						/>
						<IconButton
							style={{ width: 48, height: 48 }}
							icon="delete-outline"
							accessibilityLabel={`Excluir água das ${row.time}`}
							onPress={() =>
								confirm(
									"Excluir registro?",
									"O total diário será recalculado.",
									() => dispatch({ type: "WATER_DELETE", id: row.id }),
								)
							}
						/>
					</Card>
				))}
			<Portal>
				<Dialog
					visible={Boolean(modal)}
					dismissable={!saving}
					onDismiss={() => setModal(null)}
				>
					<Dialog.Title>
						{modal === "goal"
							? "Meta diária de água"
							: editing
								? "Editar consumo"
								: "Registrar água"}
					</Dialog.Title>
					<Dialog.Content>
						<Field
							label="Quantidade em mL"
							value={value}
							onChangeText={setValue}
							keyboardType="numeric"
							error={error}
						/>
					</Dialog.Content>
					<Dialog.Actions>
						<Button
							title="Cancelar"
							variant="text"
							disabled={saving}
							onPress={() => setModal(null)}
						/>
						<Button title="Salvar" loading={saving} onPress={save} />
					</Dialog.Actions>
				</Dialog>
			</Portal>
		</Screen>
	);
}

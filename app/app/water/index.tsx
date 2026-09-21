import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import {
	Button,
	Card,
	Field,
	Header,
	ProgressRing,
	Screen,
	Subtitle,
} from "@/components/vitalis/ui";
import { radius, ThemeTokens } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { isoDate } from "@/lib/health";
import { useAppState, useDailySummary } from "@/state/app-state";
import type { WaterEntry } from "@/state/types";

export default function WaterScreen() {
	const theme = useAppTheme();
	const styles = useMemo(() => createStyles(theme), [theme]);
	const { state, dispatch } = useAppState();
	const summary = useDailySummary();
	const [modal, setModal] = useState<"amount" | "goal" | null>(null);
	const [value, setValue] = useState("350");
	const [editing, setEditing] = useState<WaterEntry | null>(null);
	const entries = useMemo(
		() =>
			state.water
				.filter((x) => x.date === isoDate())
				.sort((a, b) => b.time.localeCompare(a.time)),
		[state.water],
	);
	const now = () =>
		new Date().toLocaleTimeString("pt-BR", {
			hour: "2-digit",
			minute: "2-digit",
		});
	const openAmount = (entry?: WaterEntry) => {
		setEditing(entry ?? null);
		setValue(String(entry?.amountMl ?? 350));
		setModal("amount");
	};
	const save = () => {
		const n = Number(value);
		if (!Number.isFinite(n) || n <= 0)
			return Alert.alert(
				"Valor inválido",
				"Informe uma quantidade maior que zero.",
			);
		if (modal === "goal") dispatch({ type: "GOALS", value: { waterMl: n } });
		else if (editing)
			dispatch({ type: "WATER_UPDATE", value: { ...editing, amountMl: n } });
		else
			dispatch({
				type: "WATER_ADD",
				value: { amountMl: n, date: isoDate(), time: now() },
			});
		setModal(null);
	};
	const remove = (id: string) =>
		Alert.alert("Excluir registro?", "O total diário será recalculado.", [
			{ text: "Cancelar" },
			{
				text: "Excluir",
				style: "destructive",
				onPress: () => dispatch({ type: "WATER_DELETE", id }),
			},
		]);
	return (
		<Screen>
			<Header title="Hidratação" onBack={() => router.back()} />
			<View style={styles.visual}>
				<ProgressRing
					value={summary.waterProgress}
					size={150}
					color={theme.water}
					label="da meta diária"
				/>
				<View style={{ alignItems: "center" }}>
					<Text style={styles.total}>
						{summary.water.toLocaleString("pt-BR")} mL
					</Text>
					<Text style={styles.muted}>
						de {state.goals.waterMl.toLocaleString("pt-BR")} mL
					</Text>
				</View>
				<Button
					title="Editar meta"
					variant="text"
					icon="target"
					onPress={() => {
						setValue(String(state.goals.waterMl));
						setModal("goal");
					}}
				/>
			</View>
			<Subtitle>Quanto você bebeu?</Subtitle>
			<View style={styles.quick}>
				{[200, 500, 1000].map((n) => (
					<Pressable
						key={n}
						style={styles.quickButton}
						onPress={() =>
							dispatch({
								type: "WATER_ADD",
								value: { amountMl: n, date: isoDate(), time: now() },
							})
						}
					>
						<MaterialCommunityIcons
							name={n === 200 ? "cup-water" : "bottle-soda-outline"}
							size={28}
							color={theme.water}
						/>
						<Text style={styles.quickValue}>
							{n === 1000 ? "1 L" : `${n} mL`}
						</Text>
					</Pressable>
				))}
			</View>
			<Button
				title="Informar outro valor"
				variant="outline"
				icon="pencil"
				onPress={() => openAmount()}
			/>
			<Subtitle>Registros de hoje</Subtitle>
			{entries.map((entry) => (
				<Card key={entry.id} style={styles.row}>
					<View style={styles.drop}>
						<MaterialCommunityIcons
							name="water"
							color={theme.water}
							size={23}
						/>
					</View>
					<View style={{ flex: 1 }}>
						<Text style={styles.rowTitle}>{entry.amountMl} mL</Text>
						<Text style={styles.muted}>{entry.time}</Text>
					</View>
					<Pressable
						accessibilityLabel="Editar registro"
						onPress={() => openAmount(entry)}
					>
						<MaterialCommunityIcons
							name="pencil-outline"
							size={22}
							color={theme.primary}
						/>
					</Pressable>
					<Pressable
						accessibilityLabel="Excluir registro"
						onPress={() => remove(entry.id)}
					>
						<MaterialCommunityIcons
							name="delete-outline"
							size={22}
							color={theme.error}
						/>
					</Pressable>
				</Card>
			))}
			<Modal
				transparent
				visible={modal !== null}
				animationType="fade"
				onRequestClose={() => setModal(null)}
			>
				<Pressable style={styles.scrim} onPress={() => setModal(null)}>
					<Pressable style={styles.dialog} onPress={() => {}}>
						<Subtitle>
							{modal === "goal"
								? "Meta diária"
								: editing
									? "Editar consumo"
									: "Adicionar consumo"}
						</Subtitle>
						<Field
							label="Quantidade (mL)"
							keyboardType="numeric"
							value={value}
							onChangeText={setValue}
						/>
						<View style={styles.dialogActions}>
							<Button
								title="Cancelar"
								variant="text"
								onPress={() => setModal(null)}
							/>
							<Button title="Salvar" onPress={save} />
						</View>
					</Pressable>
				</Pressable>
			</Modal>
		</Screen>
	);
}
const createStyles = (theme: ThemeTokens) =>
	StyleSheet.create({
		visual: { alignItems: "center", gap: 8 },
		total: { color: theme.onSurface, fontSize: 25, fontWeight: "900" },
		muted: { color: theme.onSurfaceVariant, fontSize: 12 },
		quick: { flexDirection: "row", gap: 8 },
		quickButton: {
			flex: 1,
			minHeight: 90,
			borderRadius: radius.md,
			backgroundColor: theme.waterContainer,
			alignItems: "center",
			justifyContent: "center",
			gap: 6,
		},
		quickValue: { color: theme.onWaterContainer, fontWeight: "800" },
		row: {
			flexDirection: "row",
			alignItems: "center",
			gap: 12,
			paddingVertical: 12,
		},
		drop: {
			width: 42,
			height: 42,
			borderRadius: 14,
			backgroundColor: theme.waterContainer,
			alignItems: "center",
			justifyContent: "center",
		},
		rowTitle: { color: theme.onSurface, fontWeight: "800" },
		scrim: {
			flex: 1,
			backgroundColor: theme.scrim,
			justifyContent: "center",
			padding: 24,
		},
		dialog: {
			backgroundColor: theme.surface,
			borderRadius: radius.lg,
			padding: 22,
			gap: 16,
		},
		dialogActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
	});

import { useState } from "react";
import { View } from "react-native";
import { Chip, HelperText, SegmentedButtons, Text } from "react-native-paper";
import { formatDate } from "@/lib/format";
import { recentDateRange, validDateRange, type DateRange } from "@/lib/date-filter";
import { Button } from "./ui";
import { DateField } from "./date-field";
import { FormDialog } from "./form-dialog";

export function DateRangeFilter({ value, onChange }: {
	value: DateRange | null;
	onChange: (value: DateRange | null) => void;
}) {
	const [open, setOpen] = useState(false);
	const [mode, setMode] = useState("period");
	const [draft, setDraft] = useState(() => value ?? recentDateRange(7));
	const valid = validDateRange(draft);
	const summary = !value ? "Todas as datas" : value.start === value.end
		? formatDate(value.start) : `${formatDate(value.start)} a ${formatDate(value.end)}`;
	return (
		<View style={{ gap: 8 }}>
			<Text variant="titleMedium">Filtrar por período</Text>
			<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
				{[{ label: "Hoje", days: 1 }, { label: "7 dias", days: 7 },
					{ label: "30 dias", days: 30 }, { label: "Todas as datas", days: 0 }]
					.map(({ label, days }) => {
						const range = days ? recentDateRange(days) : null;
						return <Chip key={label}
							style={{ minHeight: 48 }} textStyle={{ minHeight: 36 }}
							selected={value?.start === range?.start && value?.end === range?.end}
							onPress={() => onChange(range)}>{label}</Chip>;
					})}
			</View>
			<Button title={value ? summary : "Escolher período ou dia"}
				testID="date-range-customize" icon="calendar-range" variant="outline"
				onPress={() => {
					setDraft(value ?? recentDateRange(7));
					setMode(value?.start === value?.end && value ? "day" : "period");
					setOpen(true);
				}} />
			<FormDialog visible={open} title="Escolher datas" onDismiss={() => setOpen(false)}
				actions={[
					<Button key="cancel" title="Cancelar" variant="text" onPress={() => setOpen(false)} />,
					<Button key="apply" title="Aplicar filtro" disabled={!valid} onPress={() => {
						if (!valid) return;
						onChange(draft);
						setOpen(false);
					}} />,
				]}>
				<SegmentedButtons value={mode} onValueChange={(next) => {
					setMode(next);
					if (next === "day") setDraft({ start: draft.end, end: draft.end });
				}} buttons={[
					{ value: "period", label: "Período", style: { minHeight: 48 }, labelStyle: { lineHeight: 30 } },
					{ value: "day", label: "Um dia", style: { minHeight: 48 }, labelStyle: { lineHeight: 30 } },
				]} />
				{mode === "day" ? <DateField label="Dia específico" value={draft.start}
					onChange={(date) => setDraft({ start: date, end: date })} /> : <>
					<DateField label="Data inicial" value={draft.start}
						onChange={(start) => setDraft({ ...draft, start })} />
					<DateField label="Data final" value={draft.end}
						onChange={(end) => setDraft({ ...draft, end })} />
				</>}
				{!valid && <HelperText type="error" accessibilityLiveRegion="polite">
					A data final deve ser igual ou posterior à inicial.
				</HelperText>}
			</FormDialog>
		</View>
	);
}

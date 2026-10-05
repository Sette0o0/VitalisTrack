import { useState } from "react";
import { View } from "react-native";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { TextInput } from "react-native-paper";
import { brazilianDateInput, parseBrazilianDate } from "@/lib/date-filter";
import { formatDate } from "@/lib/format";
import { isoDate } from "@/lib/health";
import { birthDateError, deviceTimeZone } from "@vitalis/contracts";
import { Field, Muted } from "./ui";

export function BirthDateField({ value, onChange }: {
	value: string;
	onChange: (value: string) => void;
}) {
	const [touched, setTouched] = useState(false);
	const text = /^\d{4}-\d{2}-\d{2}$/.test(value) ? formatDate(value) : value;
	const date = parseBrazilianDate(text);
	const today = isoDate();
	const error = value && (touched || text.length === 10)
		? birthDateError(date ?? value, deviceTimeZone())
		: undefined;
	return <View style={{ gap: 4 }}>
		<Field label="Nascimento (dd/mm/aaaa)" placeholder="Ex.: 08/04/2000"
			value={text} keyboardType="number-pad" maxLength={10} error={error || undefined}
			onBlur={() => setTouched(true)}
			onChangeText={(input) => {
				const masked = brazilianDateInput(input);
				onChange(parseBrazilianDate(masked) ?? masked);
			}}
			right={<TextInput.Icon icon="calendar" style={{ width: 48, height: 48 }} accessibilityLabel="Selecionar dia, mês e ano de nascimento"
				forceTextInputFocus={false} onPress={() => DateTimePickerAndroid.open({
					value: date && date <= today ? new Date(`${date}T12:00:00`) : new Date(2000, 0, 1, 12),
					mode: "date", display: "spinner", maximumDate: new Date(),
					positiveButton: { label: "Confirmar" }, negativeButton: { label: "Cancelar" },
					onChange: (event, selected) => {
						if (event.type === "set" && selected) {
							onChange(isoDate(selected));
							setTouched(false);
						}
					},
				})} />}
		/>
		<Muted>Digite a data ou use o seletor de dia, mês e ano.</Muted>
	</View>;
}

import { formatDate } from "@/lib/format";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Button } from "./ui";
import { View, PixelRatio } from "react-native";
import { isoDate } from "@/lib/health";
export function DateField({
	label = "Data",
	value,
	onChange,
	optional = false,
	maximumDate,
}: {
	label?: string;
	value: string;
	onChange: (value: string) => void;
	optional?: boolean;
	maximumDate?: Date;
}) {
	return (
		<View>
			<Button
				variant="outline"
				icon="calendar"
				accessibilityLabel={label}
    title={`${label}: ${value ? formatDate(value) : "Selecionar"}`}

				onPress={() =>
					DateTimePickerAndroid.open({
						value: /^\d{4}-\d{2}-\d{2}$/.test(value)
							? new Date(`${value}T12:00:00`)
							: new Date(),
						mode: "date",
						// Keep both native dialog actions within small screens at large font scales.
						display: PixelRatio.getFontScale() >= 1.5 ? "spinner" : "default",
						maximumDate,
						positiveButton: { label: "Confirmar" },
						negativeButton: { label: "Cancelar" },
						onChange: (event, date) => {
							if (event.type === "set" && date) onChange(isoDate(date));
						},
					})
				}
			/>
			{optional && value && (
				<Button title="Limpar filtro" variant="text" onPress={() => onChange("")} />
			)}
		</View>
	);
}
export function TimeField({
	value,
	onChange,
}: {
	value: string;
	onChange: (value: string) => void;
}) {
	return (
		<Button
			variant="outline"
			icon="clock-outline"
			accessibilityLabel="Horário"
   title={`Horário: ${value}`}

			onPress={() => {
				const date = new Date();
				const [h, m] = value.split(":").map(Number);
				date.setHours(h || 0, m || 0);
				DateTimePickerAndroid.open({
					value: date,
					mode: "time",
					is24Hour: true,
					onChange: (event, selected) => {
						if (event.type === "set" && selected)
							onChange(
								`${String(selected.getHours()).padStart(2, "0")}:${String(selected.getMinutes()).padStart(2, "0")}`,
							);
					},
				});
			}}
		/>
	);
}

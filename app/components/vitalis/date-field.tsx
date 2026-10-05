import { formatDate } from "@/lib/format";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Button } from "react-native-paper";
import { View } from "react-native";
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
				mode="outlined"
				icon="calendar"
				accessibilityLabel={label}
				contentStyle={{ minHeight: 52 }}
				onPress={() =>
					DateTimePickerAndroid.open({
						value: /^\d{4}-\d{2}-\d{2}$/.test(value)
							? new Date(`${value}T12:00:00`)
							: new Date(),
						mode: "date",
						maximumDate,
						positiveButton: { label: "Confirmar" },
						negativeButton: { label: "Cancelar" },
						onChange: (event, date) => {
							if (event.type === "set" && date) onChange(isoDate(date));
						},
					})
				}
			>
				{label}:{" "}
				{value
					? formatDate(value)
					: "Selecionar"}
			</Button>
			{optional && value && (
				<Button contentStyle={{ minHeight: 48 }} onPress={() => onChange("")}>
					Limpar filtro
				</Button>
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
			mode="outlined"
			icon="clock-outline"
			accessibilityLabel="Horário"
			contentStyle={{ minHeight: 52 }}
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
		>
			Horário: {value}
		</Button>
	);
}

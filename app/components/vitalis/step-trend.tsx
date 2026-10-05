import { View } from "react-native";
import { Icon } from "react-native-paper";
import { Muted } from "./ui";
import { formatNumber } from "@/lib/format";

export function StepTrend({ trend, trendPercent }: { trend: "up" | "down" | "flat"; trendPercent: number | null }) {
	const text = trend === "up" ? "Em crescimento" : trend === "down" ? "Em queda" : "Estável";
	const comparison = trendPercent === null ? "sem base na semana anterior" : `${formatNumber(Math.abs(trendPercent), 1)}% em relação aos 7 dias anteriores`;
	return <View accessible accessibilityLabel={`Tendência de passos: ${text}, ${comparison}`} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
		<View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
			<Icon source={trend === "up" ? "arrow-up" : trend === "down" ? "arrow-down" : "minus"} size={24} />
		</View>
		<View style={{ flex: 1 }}><Muted>{text} · {comparison}</Muted></View>
	</View>;
}

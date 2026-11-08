import { View } from "react-native";
import Svg, { Circle, Line, Text as SvgText } from "react-native-svg";
import { useAppTheme } from "@/hooks/use-app-theme";
import type { DailyMetrics } from "@vitalis/contracts";
export function EnergyPlot({ days }: {
    days: DailyMetrics[];
}) {
    const theme = useAppTheme(), points = days.filter(p => p.hasMeals || p.activityCount);
    const xMax = Math.max(1, ...points.map(p => p.consumedKcal)), yMax = Math.max(1, ...points.map(p => p.activityKcal));
    return <View><Svg width="100%" height={240} viewBox="0 0 320 240" accessibilityRole="image" accessibilityLabel="Gráfico de dispersão: calorias consumidas no eixo horizontal e calorias gastas nas atividades no eixo vertical. Valores por data na lista abaixo.">
    <Line x1={42} y1={195} x2={302} y2={195} stroke={theme.outline}/><Line x1={42} y1={15} x2={42} y2={195} stroke={theme.outline}/>
    <SvgText x={42} y={213} fill={theme.onSurfaceVariant} fontSize={11}>0</SvgText><SvgText x={265} y={213} fill={theme.onSurfaceVariant} fontSize={11}>{Math.ceil(xMax)}</SvgText>
    <SvgText x={3} y={20} fill={theme.onSurfaceVariant} fontSize={10}>{Math.ceil(yMax)}</SvgText><SvgText x={65} y={234} fill={theme.onSurfaceVariant} fontSize={12}>Consumo alimentar (kcal)</SvgText>
    <SvgText x={12} y={172} transform="rotate(-90 12 172)" fill={theme.onSurfaceVariant} fontSize={11}>Atividades (kcal)</SvgText>
    {points.map(p => <Circle key={p.date} cx={42 + p.consumedKcal / xMax * 252} cy={195 - p.activityKcal / yMax * 172} r={5} fill={theme.primary} stroke={theme.background}/>)}
  </Svg></View>;
}

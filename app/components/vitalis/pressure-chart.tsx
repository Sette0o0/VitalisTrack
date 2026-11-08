import { View, useWindowDimensions } from "react-native";
import { Text } from "react-native-paper";
import Svg, { Polyline, Line, Circle, G } from "react-native-svg";
import type { WellbeingRecord } from "@vitalis/contracts";
import { useAppTheme } from "@/hooks/use-app-theme";
export function PressureChart({
  records,
}: {
  records: Extract<WellbeingRecord, { kind: "bloodPressure" }>[];
}) {
  const theme = useAppTheme(),
    { width } = useWindowDimensions();
  const w = Math.max(200, width - 80),
    h = 170;
  if (!records.length)
    return <Text>Sem medições para o gráfico dos últimos 30 dias.</Text>;
  const min = Math.min(...records.map((r) => r.data.diastolic)) - 10,
    max = Math.max(...records.map((r) => r.data.systolic)) + 10;
  const times = records.map((r) => Date.parse(r.data.occurredAt)),
    first = Math.min(...times),
    last = Math.max(...times);
  const point = (i: number, value: number) => ({
    x: 18 + ((times[i] - first) / Math.max(1, last - first)) * (w - 36),
    y: 12 + ((max - value) / (max - min)) * (h - 30),
  });
  return (
    <View
      accessibilityLabel={`Pressão arterial em mmHg, ${records.length} medições nos últimos 30 dias; sistólica e diastólica`}
    >
      <Text>
        <Text style={{ color: theme.primary }}>Sistólica</Text> /{" "}
        <Text style={{ color: theme.error }}>Diastólica</Text> · mmHg
      </Text>
      <Svg width={w} height={h}>
        <Line
          x1={18}
          y1={h - 18}
          x2={w - 18}
          y2={h - 18}
          stroke={theme.outline}
        />
        {(["systolic", "diastolic"] as const).map((key, j) => (
          <Polyline
            key={key}
            points={records
              .map((r, i) => {
                const p = point(i, r.data[key]);
                return `${p.x},${p.y}`;
              })
              .join(" ")}
            fill="none"
            stroke={j ? theme.error : theme.primary}
            strokeWidth={3}
          />
        ))}
        {records.map((r, i) => (
          <G key={r.id}>
            <Circle cx={point(i,r.data.systolic).x} cy={point(i,r.data.systolic).y} r={3} fill={theme.primary}/>
            <Circle cx={point(i,r.data.diastolic).x} cy={point(i,r.data.diastolic).y} r={3} fill={theme.error}/>
          </G>
        ))}
      </Svg>
      <Text>
        {new Date(first).toLocaleDateString("pt-BR")} —{" "}
        {new Date(last).toLocaleDateString("pt-BR")}
      </Text>
      <Text>
        Faixa do eixo: {min}–{max} mmHg. Até 100 medições recentes; valores
        exatos no histórico.
      </Text>
    </View>
  );
}

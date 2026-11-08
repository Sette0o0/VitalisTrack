import { onHistoryChanged } from "@/lib/history-projection";
import { useCallback, useEffect, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { HelperText, RadioButton, Text } from "react-native-paper";
import type { HealthReport, ReportPeriod } from "@vitalis/contracts";
import { Button, Card, Header, Muted, Screen, Subtitle } from "@/components/vitalis/ui";
import { DateField } from "@/components/vitalis/date-field";
import { EnergyPlot } from "@/components/vitalis/energy-plot";
import { useAppState } from "@/state/app-state";
import { useMeasurements } from "@/hooks/use-measurements";
import { useSubmit } from "@/hooks/use-submit";
import { isoDate } from "@/lib/health";
import { formatDate, formatNumber } from "@/lib/format";
import { readReport } from "@/lib/report-store";
import { dailyReportExtras } from "@/lib/report-extras";
import { onWellbeingChanged } from "@/lib/wellbeing-store";
import { exportCsv, exportPdf } from "@/lib/exports";
import { saveFileAs, shareFile } from "@/lib/file-tools";
import { userError } from "@/lib/user-error";
export default function ReportsScreen() {
    const { state } = useAppState(), { submit, saving, error } = useSubmit(), measurements = useMeasurements();
    const userId = state.userId!, profileId = state.profileId ?? userId;
    const [period, setPeriod] = useState<ReportPeriod>("week"), [date, setDate] = useState(isoDate()), [report, setReport] = useState<HealthReport | null>(null), [extras, setExtras] = useState<string[]>([]), [loadError, setLoadError] = useState(""), [file, setFile] = useState<{
        uri: string;
        mime: string;
        name: string;
    } | null>(null), [notice, setNotice] = useState("");
    const epoch = useRef(0), active = useRef(true);
    const selection=`${userId}:${profileId}:${period}:${date}`, selectionRef=useRef(selection);selectionRef.current=selection;
    useEffect(()=>{setFile(null);setNotice("");setReport(null);},[selection]);
    useFocusEffect(useCallback(() => {
        active.current = true;
        const load = async () => {
            const id = ++epoch.current;
            try {
                const value = await readReport(userId, profileId, period, date, state.goals), extra = period === "day" ? await dailyReportExtras(userId, profileId, date) : [];
                if (active.current && id === epoch.current) {
                    setReport(value);
                    setExtras(extra);
                    setLoadError("");
                }
            }
            catch (e) {
                if (active.current && id === epoch.current)
                    setLoadError(userError(e, "load"));
            }
        };
        void load();
        const off = onWellbeingChanged(() => void load());
        const offHistory = onHistoryChanged(() => void load());
        return () => { active.current = false; epoch.current++; off(); offHistory(); };
    }, [userId, profileId, period, date, state.goals]));
    return <Screen><Header title="Relatórios e exportação" onBack={() => router.back()}/>
    <Muted>Dados do perfil {state.profile.name}. Os arquivos podem ser gerados offline com os registros deste aparelho.</Muted>
    {(state.syncStatus !== "idle" || !state.syncStatus) && <Muted>Confira a sincronização: o arquivo utiliza os dados locais e pode incluir alterações ainda pendentes.</Muted>}
    <RadioButton.Group value={period} onValueChange={v => setPeriod(v as ReportPeriod)}>
      <RadioButton.Item label="Resumo diário" value="day" style={{ minHeight: 48 }}/><RadioButton.Item label="Semanal · últimos 7 dias" value="week" style={{ minHeight: 48 }}/><RadioButton.Item label="Mensal · mês escolhido" value="month" style={{ minHeight: 48 }}/>
    </RadioButton.Group><DateField label="Data de referência" value={date} onChange={setDate} maximumDate={new Date()}/>
    {loadError && <HelperText type="error">{loadError}</HelperText>}
    {report && <><Subtitle>{formatDate(report.start)} a {formatDate(report.end)}</Subtitle><Card><Subtitle>Balanço energético</Subtitle><Muted>Consumo alimentar × gasto das atividades registradas. O gasto basal não é somado.</Muted><EnergyPlot days={report.days}/>
      {report.days.filter(p => p.hasMeals || p.activityCount).map(p => <Text key={p.date}>{formatDate(p.date)} · consumo {formatNumber(p.consumedKcal, 0)} kcal · atividades {formatNumber(p.activityKcal, 0)} kcal</Text>)}
      {!report.days.some(p => p.hasMeals || p.activityCount) && <Muted>Nenhum registro de alimentação ou atividade neste período.</Muted>}
    </Card><Card><Subtitle>Resumo do período</Subtitle><Text>Água: {formatNumber(report.totals.waterMl / 1000, 2)} L</Text><Text>Passos: {formatNumber(report.totals.steps, 0)}</Text><Text>Atividades: {report.totals.activityCount} · {formatNumber(report.totals.durationSeconds / 60, 1)} min · {measurements.distanceText(report.totals.distanceMeters / 1000)}</Text>
      {report.text.map((text, i) => <Text key={i}>{text}</Text>)}{extras.map((text, i) => <Text key={"e" + i}>{text}</Text>)}
    </Card>
      <Button title="Gerar PDF" loading={saving} onPress={() => submit(async () => { const requestedSelection=selection;const uri = await exportPdf(report, state, extras); if (active.current && selectionRef.current===requestedSelection) {
            setFile({ uri, mime: "application/pdf", name: `vitalis-${period}-${report.start}.pdf` });
            setNotice("PDF gerado no aparelho.");
        } })}/>
    </>}
    <Button title="Exportar peso, atividades e refeições em CSV" variant="outline" disabled={saving} onPress={() => submit(async () => { const uri = await exportCsv(userId, profileId); if (active.current) {
        setFile({ uri, mime: "text/csv", name: "vitalis-dados.csv" });
        setNotice("CSV gerado no aparelho, com unidades canônicas identificadas no cabeçalho.");
    } })}/>
    {file && <Card><Subtitle>Arquivo gerado</Subtitle><Text>{file.name}</Text><Button title="Salvar arquivo no Android" disabled={saving} onPress={() => submit(async () => { const saved = await saveFileAs(file.uri, file.name, file.mime); setNotice(saved ? "Arquivo salvo na pasta escolhida." : "Salvamento cancelado."); })}/><Button title="Compartilhar arquivo" variant="outline" disabled={saving} onPress={() => submit(() => shareFile(file.uri, file.mime))}/></Card>}
    {report && <><Subtitle>Registros por dia</Subtitle>
      {report.days.map(p => <Card key={p.date}><Text>{formatDate(p.date)}</Text><Muted>Água: {p.hasWater ? formatNumber(p.waterMl, 0) + " mL" : "Sem registro"} · passos: {p.hasSteps ? formatNumber(p.steps, 0) : "Sem registro"}</Muted><Muted>Peso: {p.weightKg === null ? "Sem registro" : measurements.weightText(p.weightKg)} · atividades: {p.activityCount}</Muted></Card>)}
</>}
    {notice && <Text accessibilityLiveRegion="polite">{notice}</Text>}{error && <HelperText type="error" accessibilityLiveRegion="polite">{error}</HelperText>}
  </Screen>;
}

import { useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import { HelperText, Text } from "react-native-paper";
import type { CleanupPreview } from "@vitalis/contracts";
import { Button, Card, Header, Muted, Screen, Subtitle } from "@/components/vitalis/ui";
import { useConfirm } from "@/components/vitalis/confirmation";
import { useAppState } from "@/state/app-state";
import { useSubmit } from "@/hooks/use-submit";
import { exportAccountBackup } from "@/lib/exports";
import { previewCleanup, executeCleanup } from "@/lib/retention";
import { saveFileAs, shareFile } from "@/lib/file-tools";
import { isoDate } from "@/lib/health";
import { formatDate } from "@/lib/format";
const names: Record<string, string> = { water: "Água", meal: "Refeições", activity: "Atividades", weight: "Pesagens", steps: "Dias de passos", wellbeing: "Históricos de bem-estar" };
export default function DataScreen() {
    const { state, runLocalOperation, syncNow } = useAppState(), owner = state.userId!, profileId = state.profileId ?? owner;
    const { submit, saving, error } = useSubmit(), confirm = useConfirm();
    const [file, setFile] = useState<string | null>(null), [status, setStatus] = useState(""), [preview, setPreview] = useState<CleanupPreview | null>(null), [result, setResult] = useState("");
    const active = useRef(true);
    useEffect(() => () => { active.current = false; }, []);
    return <Screen><Header title="Backup e limpeza" onBack={() => router.back()}/><Card><Subtitle>Backup completo da conta</Subtitle><Text>Inclui todos os perfis, configurações, históricos, fotos e documentos. Senhas e tokens não são exportados.</Text><Muted>O JSON contém seus dados pessoais. Escolha onde salvar ou com quem compartilhar.</Muted>
    <Button title="Gerar backup completo em JSON" loading={saving} onPress={() => submit(async () => { setFile(null); const uri = await exportAccountBackup(owner, text => { if (active.current)
        setStatus(text); }); if (active.current) {
        setFile(uri);
        setStatus("Backup completo gerado.");
    } })}/>
    {status && <Text accessibilityLiveRegion="polite">{status}</Text>}
    {file && <><Button title="Salvar backup no Android" disabled={saving} onPress={() => submit(async () => { const saved = await saveFileAs(file, "vitalis-backup.json", "application/json"); if (active.current)
        setStatus(saved ? "Backup salvo na pasta escolhida." : "Salvamento cancelado."); })}/><Button title="Compartilhar backup" disabled={saving} variant="outline" onPress={() => submit(() => shareFile(file, "application/json"))}/></>}
  </Card><Card><Subtitle>Limpar históricos antigos</Subtitle><Text>Somente o perfil {state.profile.name}. Exclui registros anteriores à mesma data do ano passado, após sua confirmação.</Text><Muted>Documentos, receitas, metas, planos, lembretes, medicações e jejum ativo serão preservados.</Muted>
    <Button title="Ver prévia da limpeza" variant="outline" disabled={saving} onPress={() => submit(async () => { const value = await previewCleanup(owner, profileId, isoDate()); if (active.current) {
        setPreview(value);
        setResult("");
    } })}/>
    {preview && <><Text>Registros anteriores a {formatDate(preview.cutoff)}: {preview.candidates.length}</Text>{Object.entries(preview.counts).map(([kind, count]) => <Text key={kind}>{names[kind]}: {count}</Text>)}
      {preview.candidates.length > 0 && <Button title="Confirmar limpeza dos registros" variant="danger" disabled={saving} onPress={() => confirm("Confirmar limpeza?", `Excluir ${preview.candidates.length} registros de ${state.profile.name} anteriores a ${formatDate(preview.cutoff)}?`, async () => {
                    let response = { removed: 0, skipped: 0 };
                    await runLocalOperation(async () => { response = await executeCleanup(preview); });
                    if (active.current) {
                        setPreview(null);
                        setResult(`${response.removed} registros excluídos. ${response.skipped} preservados por alterações posteriores à prévia.`);
                    }
                    void syncNow();
                }, "Excluir registros")}/>}
    </>}{result && <Text accessibilityLiveRegion="polite">{result}</Text>}
  </Card>{error && <HelperText type="error" accessibilityLiveRegion="polite">{error}</HelperText>}</Screen>;
}

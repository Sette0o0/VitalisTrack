import { useCallback, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { HelperText, Text } from "react-native-paper";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import { Button, Card, Header, Muted, Screen, Subtitle } from "@/components/vitalis/ui";
import { useAppState } from "@/state/app-state";
import { useSubmit } from "@/hooks/use-submit";
import { useConfirm } from "@/components/vitalis/confirmation";
import { deleteDocument, listDocuments, onDocumentsChanged, type StoredDocument } from "@/lib/document-store";
import { ensureDocumentFile, importDocument } from "@/lib/document-files";
import { fileTools, shareFile } from "@/lib/file-tools";
import { userError, UserFacingError } from "@/lib/user-error";
import { formatDate, formatNumber } from "@/lib/format";
export default function DocumentsScreen() {
    const { state, syncNow } = useAppState(), owner = state.userId!, profileId = state.profileId ?? owner;
    const { submit, saving, error } = useSubmit(), confirm = useConfirm();
    const [records, setRecords] = useState<StoredDocument[]>([]), [hasMore, setMore] = useState(false), [loadError, setLoadError] = useState(""), [notice, setNotice] = useState("");
    const cursor = useRef<{
        at: string;
        id: string;
    } | undefined>(undefined), generation = useRef(0), active = useRef(true), busy = useRef(false);
    const reload = useCallback(async (more = false) => {
        if (more && (!cursor.current || busy.current))
            return;
        busy.current = true;
        const epoch = more ? generation.current : ++generation.current;
        try {
            const page = await listDocuments(owner, profileId, more ? cursor.current : undefined);
            if (epoch === generation.current && active.current) {
                setRecords(previous => more ? [...new Map([...previous, ...page.records].map(r => [r.id, r])).values()] : page.records);
                cursor.current = page.nextCursor;
                setMore(!!page.nextCursor);
                setLoadError("");
            }
        }
        catch (e) {
            if (active.current)
                setLoadError(userError(e, "load"));
        }
        finally {
            busy.current = false;
        }
    }, [owner, profileId]);
    useFocusEffect(useCallback(() => { active.current = true; void reload(); const off = onDocumentsChanged(() => void reload()); return () => { active.current = false; generation.current++; off(); }; }, [reload]));
    const obtain = (document: StoredDocument) => ensureDocumentFile(owner, profileId, document);
    return <Screen><Header title="Documentos médicos" onBack={() => router.back()}/><Muted>Perfil {state.profile.name}. PDF, JPEG, PNG ou WebP, até 10 MiB por arquivo. Documentos não ficam visíveis para amigos.</Muted>
    <Button title="Anexar documento" loading={saving} onPress={() => submit(async () => {
            const choice = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/jpeg", "image/png", "image/webp"], copyToCacheDirectory: true, multiple: false });
            if (choice.canceled || !active.current)
                return;
            const source = choice.assets[0];
            await importDocument(owner, profileId, source);
            // Picker cache is disposable after the permanent private copy commits.
            if (source.uri.startsWith(Paths.cache.uri)) {
                try {
                    new File(source.uri).delete();
                }
                catch { /* retained private copy is authoritative */ }
            }
            if (active.current) {
                setNotice("Documento salvo.");
                await reload();
            }
            void syncNow();
        })}/>
    {!records.length && <Muted>Nenhum documento neste perfil.</Muted>}
    {records.map(document => <Card key={document.id}><Subtitle>{document.name}</Subtitle><Text>{formatDate(document.createdAt.slice(0, 10))} · {formatNumber(document.size / 1024, 1)} KiB</Text><Muted>{document.localUri && new File(document.localUri).exists ? "Disponível offline" : "Conecte para baixar o arquivo"}{document.revision === "0" ? " · envio pendente" : ""}</Muted>
      <Button title={"Abrir " + document.name} variant="outline" disabled={saving} onPress={() => submit(async () => { const uri = await obtain(document); if (!active.current)
            return; try {
            await fileTools().open(uri, document.mimeType);
        }
        catch {
            throw new UserFacingError("Não foi possível abrir. Verifique se há um visualizador compatível no Android.");
        } })}/>
      <Button title={"Compartilhar " + document.name} variant="text" disabled={saving} onPress={() => submit(async () => { const uri = await obtain(document); if (active.current)
            await shareFile(uri, document.mimeType); })}/>
      <Button title={"Excluir " + document.name} variant="danger" disabled={saving} onPress={() => confirm("Excluir documento?", document.name, async () => { await deleteDocument(owner, profileId, document.id); if (active.current)
            await reload(); void syncNow(); })}/>
    </Card>)}
    {hasMore && <Button title="Carregar mais documentos" variant="outline" onPress={() => reload(true)}/>}
    {notice && <Text accessibilityLiveRegion="polite">{notice}</Text>}{(error || loadError) && <HelperText type="error" accessibilityLiveRegion="polite">{error || loadError}</HelperText>}
  </Screen>;
}

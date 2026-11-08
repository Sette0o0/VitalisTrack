import { onHistoryChanged } from "@/lib/history-projection";
import { useCallback, useRef, useState } from "react";
import { FlatList, View } from "react-native";
import { Chip, HelperText, Text } from "react-native-paper";
import { router, useFocusEffect } from "expo-router";
import type { TimelineCursor, TimelineItem, TimelineKind } from "@vitalis/contracts";
import { Card, Header, Muted, Screen, Button } from "@/components/vitalis/ui";
import { useAppState } from "@/state/app-state";
import { listTimeline } from "@/lib/report-store";
import { onWellbeingChanged } from "@/lib/wellbeing-store";
import { userError } from "@/lib/user-error";
import { formatDate } from "@/lib/format";
export default function TimelineScreen() {
    const { state } = useAppState(), owner = state.userId!, profileId = state.profileId ?? owner;
    const [filter, setFilter] = useState<TimelineKind | undefined>(), [records, setRecords] = useState<TimelineItem[]>([]), [error, setError] = useState(""), [hasMore, setMore] = useState(false), [loading, setLoading] = useState(false);
    const cursor = useRef<TimelineCursor | undefined>(undefined), epoch = useRef(0), busy = useRef(false);
    const load = useCallback(async (more = false) => {
        if (more && (!cursor.current || busy.current))
            return;
        const generation = more ? epoch.current : ++epoch.current;
        busy.current = true;
        setLoading(true);
        try {
            const page = await listTimeline(owner, profileId, filter, more ? cursor.current : undefined, 30, state.unitSystem);
            if (generation === epoch.current) {
                setRecords(previous => more ? [...new Map([...previous, ...page.records].map(r => [r.kind + r.id, r])).values()] : page.records);
                cursor.current = page.nextCursor;
                setMore(!!page.nextCursor);
                setError("");
            }
        }
        catch (e) {
            if (generation === epoch.current)
                setError(userError(e, "load"));
        }
        finally {
            if (generation === epoch.current)
                setLoading(false);
            busy.current = false;
        }
    }, [owner, profileId, filter, state.unitSystem]);
    useFocusEffect(useCallback(() => { void load(); const off = onWellbeingChanged(() => void load()); const offHistory = onHistoryChanged(() => void load()); return () => { epoch.current++; off(); offHistory(); }; }, [load]));
    return <Screen scroll={false}><Header title="Linha do tempo" onBack={() => router.back()}/><Muted>{state.profile.name} · registros mais recentes primeiro</Muted>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{([[undefined, "Todos"], ["meal", "Refeições"], ["activity", "Atividades"], ["weight", "Peso"], ["mood", "Humor"]] as const).map(([value, label]) => <Chip key={label} selected={filter === value} onPress={() => setFilter(value)} style={{ minHeight: 48, justifyContent: "center" }}>{label}</Chip>)}</View>
    {error && <HelperText type="error">{error}</HelperText>}
    <FlatList style={{ flex: 1 }} data={records} keyExtractor={r => r.kind + r.id} contentContainerStyle={{ gap: 12, paddingVertical: 12 }} renderItem={({ item }) => <Card><Text>{formatDate(item.date)} · {item.time ? item.time.slice(0, 5) : "Sem horário"}</Text><Text variant="titleMedium">{item.title}</Text><Text>{item.detail}</Text></Card>} ListEmptyComponent={<Muted>{loading ? "Carregando…" : "Nenhum registro para este filtro."}</Muted>} ListFooterComponent={hasMore ? <Button title="Carregar mais registros" loading={loading} onPress={() => load(true)}/> : null}/>
  </Screen>;
}

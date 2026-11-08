import { useCallback, useState } from "react";
import { useFocusEffect, useLocalSearchParams, router } from "expo-router";
import { AppState } from "react-native";
import { Text, HelperText } from "react-native-paper";
import { fastingRemaining, type WellbeingRecord } from "@vitalis/contracts";
import { Button, Header, Screen } from "@/components/vitalis/ui";
import { getWellbeing } from "@/lib/wellbeing-store";
import { useAppState } from "@/state/app-state";
import { useWellbeing } from "@/hooks/use-wellbeing";
import { useSubmit } from "@/hooks/use-submit";
import { userError } from "@/lib/user-error";
import { formatCountdown } from "@/lib/wellbeing-timers";
export default function FastingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    { state } = useAppState(),
    { save } = useWellbeing("fasting"),
    { submit, error } = useSubmit();
  const [record, setRecord] = useState<Extract<
      WellbeingRecord,
      { kind: "fasting" }
    > | null>(null),
    [remaining, setRemaining] = useState(0),
    [loadError, setLoadError] = useState("");
  useFocusEffect(
    useCallback(() => {
      let live = true,
        t: ReturnType<typeof setInterval> | undefined;
      const start = async () => {
        try {
          const r = await getWellbeing(
            state.userId!,
            state.profileId ?? state.userId!,
            id,
          );
          if (!live) return;
          if (r?.kind === "fasting") {
            setRecord(r);
            const tick = () => setRemaining(fastingRemaining(r.data.endAt));
            tick();
            clearInterval(t);
            t = setInterval(tick, 1000);
          }
        } catch (e) {
          if (live) setLoadError(userError(e, "load"));
        }
      };
      void start();
      const sub = AppState.addEventListener("change", (v) => {
        clearInterval(t);
        if (v === "active") void start();
      });
      return () => {
        live = false;
        clearInterval(t);
        sub.remove();
      };
    }, [state.userId, state.profileId, id]),
  );
  return (
    <Screen>
      <Header title="Acompanhar jejum" onBack={() => router.back()} />
      {record ? (
        <>
          <Text variant="headlineMedium">
            {record.data.status === "cancelled"
              ? "Cancelado"
              : record.data.status === "completed" || remaining === 0
                ? "Concluído"
                : Date.parse(record.data.startAt) > Date.now()
                  ? "Início programado"
                  : "Tempo restante"}
          </Text>
          <Text variant="displaySmall">
            {formatCountdown(record.data.status === "active" ? remaining : 0)}
          </Text>
          <Text>
            Término: {new Date(record.data.endAt).toLocaleString("pt-BR")}
          </Text>
          {record.data.status === "active" && remaining > 0 && (
            <Button
              title="Cancelar jejum"
              onPress={() =>
                void submit(async () => {
                  const next = {
                    ...record,
                    data: { ...record.data, status: "cancelled" as const },
                  };
                  await save(next);
                  setRecord(next);
                })
              }
            />
          )}
        </>
      ) : (
        <Text>{loadError || "Carregando…"}</Text>
      )}
      {error && <HelperText type="error">{error}</HelperText>}
    </Screen>
  );
}

import { useCallback, useState } from "react";
import { useFocusEffect, router } from "expo-router";
import { Text, Checkbox, HelperText } from "react-native-paper";
import { Button, Header, Screen } from "@/components/vitalis/ui";
import { useAppState } from "@/state/app-state";
import { useSubmit } from "@/hooks/use-submit";
import {
  reminderEnabled,
  setReminderEnabled,
  reconcileReminders,
} from "@/lib/reminders";
import {
  requestReminderPermission,
  requireWellbeingNative,
  wellbeingNative,
  type NativeStatus,
} from "@/lib/wellbeing-native";
export default function RemindersScreen() {
  const { state, profiles } = useAppState(),
    { submit, error } = useSubmit(),
    [enabled, setEnabled] = useState<Record<string, boolean>>({}),
    [status, setStatus] = useState<NativeStatus | null>(null);
  useFocusEffect(
    useCallback(() => {
      let live = true;
      void Promise.all(
        profiles.map(
          async (p) =>
            [p.id, await reminderEnabled(state.userId!, p.id)] as const,
        ),
      ).then((rows) => {
        if (live) setEnabled(Object.fromEntries(rows));
      });
      void wellbeingNative?.status().then((s) => {
        if (live) setStatus(s);
      });
      return () => {
        live = false;
      };
    }, [profiles, state.userId]),
  );
  return (
    <Screen>
      <Header title="Lembretes neste aparelho" onBack={() => router.back()} />
      <Text>
        Escolha os perfis que podem emitir avisos aqui. Os horários sincronizam;
        esta escolha vale somente neste aparelho.
      </Text>
      {profiles.map((p) => (
        <Checkbox.Item
          key={p.id}
          label={p.name}
          status={enabled[p.id] ? "checked" : "unchecked"}
          onPress={() =>
            void submit(async () => {
              const next = !enabled[p.id];
              if (next) await requestReminderPermission();
              await setReminderEnabled(state.userId!, p.id, next);
              setEnabled((e) => ({ ...e, [p.id]: next }));
              await reconcileReminders(state.userId!);
              setStatus(await requireWellbeingNative().status());
            })
          }
        />
      ))}
      <Text>
        Durante o foco, todos os lembretes são barrados, inclusive medicação.
        Avisos perdidos não são reenviados.
      </Text>
      {status && !status.exactAlarms && (
        <>
          <Text>Sem acesso a alarmes exatos, os avisos podem atrasar.</Text>
          <Button
            title="Configurar alarmes exatos"
            variant="outline"
            onPress={() =>
              void submit(async () =>
                requireWellbeingNative().openExactSettings(),
              )
            }
          />
        </>
      )}
      {status && !status.notifications && (
        <Text>As notificações estão bloqueadas pelo Android.</Text>
      )}
      <Button
        title="Configurar respiração diária"
        onPress={() =>
          router.push({
            pathname: "/wellbeing/records",
            params: { kind: "breathingReminder" },
          })
        }
      />
      {error && <HelperText type="error">{error}</HelperText>}
    </Screen>
  );
}

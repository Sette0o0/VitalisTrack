import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import { AppState } from "react-native";
import { Text, HelperText } from "react-native-paper";
import { Button, Card, Field } from "./ui";
import {
  requireWellbeingNative,
  wellbeingNative,
  type NativeStatus,
} from "@/lib/wellbeing-native";
import { useSubmit } from "@/hooks/use-submit";
import { UserFacingError } from "@/lib/user-error";
export function FocusControl({
  owner,
  enabled = true,
  attached = false,
}: {
  owner: string;
  enabled?: boolean;
  attached?: boolean;
}) {
  const [status, setStatus] = useState<NativeStatus | null>(null),
    [minutes, setMinutes] = useState("15");
  const { submit, saving, error } = useSubmit();
  useFocusEffect(useCallback(() => {
    let live = true;
    const refresh = () => {
      void wellbeingNative
        ?.status()
        .then((v) => {
          if (live) setStatus(v);
        })
        .catch(() => {});
    };
    let t: ReturnType<typeof setInterval> | undefined;
    const resume = () => { refresh(); t = setInterval(refresh, 2000); };
    if (AppState.currentState === "active") resume();
    const sub = AppState.addEventListener("change", (v) => {
      clearInterval(t);
      if (v === "active") resume();
    });
    return () => {
      live = false;
      clearInterval(t);
      sub.remove();
    };
  }, []));
  useEffect(() => {
    if (attached && !enabled)
      void wellbeingNative?.stopFocus(owner).catch(() => {});
  }, [attached, enabled, owner]);
  useEffect(
    () => () => {
      if (attached) void wellbeingNative?.stopFocus(owner).catch(() => {});
    },
    [attached, owner],
  );
  const active = status?.active === true;
  return (
    <Card>
      <Text variant="titleMedium">Modo de foco</Text>
      <Text>
        Bloqueia notificações do celular e todos os lembretes do VitalisTrack,
        inclusive medicação. Exceções configuradas no Android continuam sob seu
        controle.
      </Text>
      {active ? (
        <Text>
          Foco até{" "}
          {new Date(status.until).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      ) : (
        <Field
          label="Duração do foco (minutos)"
          value={minutes}
          onChangeText={setMinutes}
          keyboardType="number-pad"
        />
      )}
      {!status?.policyAccess && (
        <Button
          title="Autorizar Não Perturbe"
          variant="outline"
          onPress={() =>
            void submit(async () =>
              requireWellbeingNative().openPolicySettings(),
            )
          }
        />
      )}
      <Button
        title={active ? "Encerrar foco" : "Ativar foco"}
        disabled={!enabled || saving}
        onPress={() =>
          void submit(async () => {
            const bridge = requireWellbeingNative();
            if (active) {
              await bridge.stopFocus(status.owner);
              setStatus(await bridge.status());
            } else {
              const duration = Number(minutes);
              if (!Number.isInteger(duration) || duration < 1 || duration > 120)
                throw new UserFacingError("Informe entre 1 e 120 minutos.");
              if (!status?.policyAccess)
                throw new UserFacingError(
                  "Autorize o Não Perturbe antes de ativar o foco.",
                );
              setStatus(await bridge.startFocus(owner, duration));
            }
          })
        }
      />
      {status && status.until > 0 && !active && (
        <Text>Aguardando confirmação do foco pelo Android.</Text>
      )}
      {error && <HelperText type="error">{error}</HelperText>}
    </Card>
  );
}

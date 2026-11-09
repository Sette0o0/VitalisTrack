import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, View } from "react-native";
import { router } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { Text, HelperText } from "react-native-paper";
import { Button, Header, Screen, Muted } from "@/components/vitalis/ui";
import { FocusControl } from "@/components/vitalis/focus-control";
import { useAppState } from "@/state/app-state";
import { useWellbeing } from "@/hooks/use-wellbeing";
import { useSubmit } from "@/hooks/use-submit";
import { getValue, setValue } from "@/lib/local-database";
import { newId } from "@/lib/health";
import {
  advanceTimer,
  breathingPhase,
  formatCountdown,
  type ActiveTimer,
} from "@/lib/wellbeing-timers";
export default function BreathingScreen() {
  const { state } = useAppState(),
    { save } = useWellbeing("breathing"),
    { submit, error } = useSubmit();
  const focused = useIsFocused();
  const user = state.userId!,
    profile = state.profileId ?? user;
  const [ready, setReady] = useState(false),
    [timer, setTimer] = useState<ActiveTimer>({
      elapsedMs: 0,
      running: false,
      lastTick: performance.now(),
    }),
    [saved, setSaved] = useState(false);
  const discard = useRef(false), loaded = useRef(false);
 const [loadError,setLoadError]=useState("");
  const ref = useRef(timer),
    id = useRef(newId()),
    startedAt = useRef(new Date().toISOString()),
    persistQueue = useRef(Promise.resolve());
  const update = (t: ActiveTimer) => {
    ref.current = t;
    setTimer(t);
  };
  const persist = useCallback(() => {
    if (discard.current || !loaded.current) return persistQueue.current;
    const draft = {
      id: id.current,
      startedAt: startedAt.current,
      elapsedMs: ref.current.elapsedMs,
    };
    persistQueue.current = persistQueue.current
      .catch(() => {})
      .then(() =>
        setValue("breathing-draft", JSON.stringify(draft), user, profile),
      );
    return persistQueue.current;
  }, [user, profile]);
  useEffect(() => {
    let live = true;
    void getValue("breathing-draft", user, profile)
      .then((raw) => {
        if (!live) return;
        if (raw) {
          try {
            const d = JSON.parse(raw);
            if (
              typeof d.id === "string" &&
              Number.isFinite(d.elapsedMs) &&
              d.elapsedMs >= 0 &&
              d.elapsedMs <= 180000
            ) {
              id.current = d.id;
              startedAt.current = d.startedAt;
              update({
                elapsedMs: d.elapsedMs,
                running: false,
                lastTick: performance.now(),
              });
            }
          } catch {}
        }
        loaded.current=true;
        setReady(true);
      })
      .catch(() => {if(live)setLoadError("Não foi possível restaurar a sessão. Volte e tente novamente.");});
    const sub = AppState.addEventListener("change", (v) => {
      if (v !== "active") {
        update({
          ...advanceTimer(ref.current, performance.now()),
          running: false,
        });
        void persist();
      }
    });
    return () => {
      live = false;
      sub.remove();
      ref.current = advanceTimer(ref.current, performance.now());
      ref.current.running = false;
      void persist();
    };
  }, [user, profile, persist]);
  useEffect(() => {
    if (!focused && ref.current.running) {
      update({ ...advanceTimer(ref.current, performance.now()), running: false });
      void persist();
    }
  }, [focused, persist]);
  useEffect(() => {
    if (!ready || !timer.running || !focused) return;
    const t = setInterval(() => {
      const next = advanceTimer(ref.current, performance.now());
      if (next.elapsedMs >= 180000) next.running = false;
      update(next);
      if (Math.floor(next.elapsedMs / 1000) % 5 === 0) void persist();
    }, 1000);
    return () => clearInterval(t);
  }, [ready, timer.running, focused, persist]);
  const complete = () =>
    submit(async () => {
      await save({
        id: id.current,
        kind: "breathing",
        data: {
          startedAt: startedAt.current,
          completedAt: new Date().toISOString(),
          activeSeconds: 180,
        },
      });
      discard.current = true;
      await persistQueue.current;
      await setValue("breathing-draft", "", user, profile);
      setSaved(true);
    });
  const phase = breathingPhase(timer.elapsedMs);
  const fraction = (timer.elapsedMs % 10000) / 10000;
  return (
    <Screen>
      <Header title="Respiração guiada" onBack={() => router.back()} />
      <Text variant="headlineMedium" accessibilityLiveRegion="polite">
        {saved ? "Sessão registrada" : phase}
      </Text>
      <Text variant="displaySmall">
        {formatCountdown(Math.ceil((180000 - timer.elapsedMs) / 1000))}
      </Text>
      <View
        accessible
        accessibilityLabel={phase}
        style={{
          alignSelf: "center",
          borderRadius: 150,
          borderWidth: 4,
          borderColor: state.darkMode ? "#8bd5ca" : "#006c62",
          width:
            120 + (fraction < 0.4 ? fraction / 0.4 : (1 - fraction) / 0.6) * 80,
          height:
            120 + (fraction < 0.4 ? fraction / 0.4 : (1 - fraction) / 0.6) * 80,
        }}
      />
      <Muted>
        Inspire por 4 segundos e expire por 6 segundos.
      </Muted>
      {timer.elapsedMs < 180000 ? (
        <Button
          disabled={!ready}
          title={
            timer.running
              ? "Pausar respiração"
              : "Iniciar ou retomar respiração"
          }
          onPress={() => {
            update({
              ...advanceTimer(ref.current, performance.now()),
              running: !ref.current.running,
            });
            void persist();
          }}
        />
      ) : !saved ? (
        <Button
          title="Salvar sessão concluída"
          onPress={() => void complete()}
        />
      ) : null}
      <Button
        title={saved ? "Voltar" : "Cancelar sessão"}
        variant="text"
        onPress={() =>
          void submit(async () => {
            update({ ...ref.current, running: false });
            discard.current = true;
            await persistQueue.current;
            await setValue("breathing-draft", "", user, profile);
            ref.current.elapsedMs = 0;
            router.back();
          })
        }
      />
      <FocusControl
        owner={`${user}:${profile}:breathing`}
        enabled={timer.running}
        attached
      />
      {(error||loadError) && <HelperText type="error">{error||loadError}</HelperText>}
    </Screen>
  );
}

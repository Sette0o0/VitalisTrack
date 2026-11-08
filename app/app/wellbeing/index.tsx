import { router } from "expo-router";
import { Button, Header, Screen, Muted } from "@/components/vitalis/ui";
import { FocusControl } from "@/components/vitalis/focus-control";
import { wellbeingTitles } from "@/lib/wellbeing-display";
import { useAppState } from "@/state/app-state";
export default function WellbeingScreen() {
  const { state } = useAppState();
  return (
    <Screen>
      <Header title="Bem-estar" onBack={() => router.back()} />
      <Muted>Registros de {state.profile.name}</Muted>
      <Button
        title="Respiração guiada · 3 minutos"
        onPress={() => router.push("/wellbeing/breathing")}
      />
      {(
        ["sleep", "medication", "mood", "fasting", "bloodPressure"] as const
      ).map((kind) => (
        <Button
          key={kind}
          title={wellbeingTitles[kind]}
          variant="outline"
          onPress={() =>
            router.push({ pathname: "/wellbeing/records", params: { kind } })
          }
        />
      ))}
      <FocusControl owner={`${state.userId}:${state.profileId}:meditation`} />
    </Screen>
  );
}

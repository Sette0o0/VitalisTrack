import { useState } from "react";
import { router } from "expo-router";
import { HelperText } from "react-native-paper";
import { Button, Field, Header, Screen } from "@/components/vitalis/ui";
import { useAppState } from "@/state/app-state";
import { useSubmit } from "@/hooks/use-submit";
import { parseInput,parseDecimal } from "@/lib/validation";
import { goalsUpdateSchema } from "@vitalis/contracts";
export default function StepsGoal() {
  const { state, dispatch } = useAppState(),
    [steps, setSteps] = useState(String(state.goals.steps)),
    { submit, error, saving } = useSubmit();
  return (
    <Screen>
      <Header title="Meta diária de passos" onBack={() => router.back()} />
      <Field
        label="Meta em passos"
        keyboardType="number-pad"
        value={steps}
        onChangeText={setSteps}
      />
      <Button
        title="Salvar meta de passos"
        loading={saving}
        onPress={() =>
          void submit(async () => {
            const input = parseInput(goalsUpdateSchema, {
              steps: parseDecimal(steps),
            });
            await dispatch({ type: "GOALS", value: input });
            router.back();
          })
        }
      />
      {error && <HelperText type="error">{error}</HelperText>}
    </Screen>
  );
}

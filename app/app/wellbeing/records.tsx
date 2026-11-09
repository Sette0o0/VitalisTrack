import { useCallback, useState } from "react";
import { useFocusEffect, useLocalSearchParams, router } from "expo-router";
import { FlatList, View } from "react-native";
import { Text, HelperText } from "react-native-paper";
import { wellbeingKindSchema, type WellbeingRecord } from "@vitalis/contracts";
import {
  Button,
  Card,
  Header,
  Screen,
  EmptyState,
} from "@/components/vitalis/ui";
import { PressureChart } from "@/components/vitalis/pressure-chart";
import { useWellbeing } from "@/hooks/use-wellbeing";
import { useSubmit } from "@/hooks/use-submit";
import { useConfirm } from "@/components/vitalis/confirmation";
import { wellbeingTitles, describeWellbeing } from "@/lib/wellbeing-display";
import { pressureSeries } from "@/lib/wellbeing-store";
import { useAppState } from "@/state/app-state";
import { userError } from "@/lib/user-error";
export default function RecordsScreen() {
  const params = useLocalSearchParams<{ kind: string }>();
  const parsed = wellbeingKindSchema.safeParse(params.kind),
    kind = parsed.success ? parsed.data : "sleep";
  const { records, error, loading, more, hasMore, save, reload } =
      useWellbeing(kind),
    { submit, error: saveError } = useSubmit(),
    confirm = useConfirm();
  const { state } = useAppState();
  const recordRevision = records.map((r) => r.id + ":" + r.updatedAt).join("|");
  const [series, setSeries] = useState<
      Extract<WellbeingRecord, { kind: "bloodPressure" }>[]
    >([]),
    [chartError, setChartError] = useState("");
  useFocusEffect(
    useCallback(() => {
      let live = true;
      if (recordRevision !== undefined && kind === "bloodPressure")
        void pressureSeries(
          state.userId!,
          state.profileId ?? state.userId!,
          new Date(Date.now() - 30 * 86400000).toISOString(),
        )
          .then((v) => {
            if (live) setSeries(v);
          })
          .catch((e) => {
            if (live) setChartError(userError(e, "load"));
          });
      return () => {
        live = false;
      };
    }, [kind, state.userId, state.profileId, recordRevision]),
  );
  if (!parsed.success)
    return (
      <Screen>
        <Text>Registro indisponível.</Text>
      </Screen>
    );
  return (
    <Screen scroll={false}>
      <Header title={wellbeingTitles[kind]} onBack={() => router.back()} />
      <FlatList
        data={records}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ gap: 12, paddingBottom: 20 }}
        refreshing={loading}
        onRefresh={() => void reload()}
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            {kind === "breathing" ? (
              <Button
                title="Iniciar respiração"
                onPress={() => router.push("/wellbeing/breathing")}
              />
            ) : (
              <Button
                title={`Novo registro · ${wellbeingTitles[kind]}`}
                onPress={() =>
                  router.push({ pathname: "/wellbeing/form", params: { kind } })
                }
              />
            )}{" "}
            {kind === "bloodPressure" && <PressureChart records={series} />}{" "}
            {(error || saveError || chartError) && (
              <HelperText type="error">
                {error || saveError || chartError}
              </HelperText>
            )}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="notebook-outline"
            title="Nenhum registro"
          />
        }
        renderItem={({ item }) => (
          <Card>
            <Text>{describeWellbeing(item)}</Text>
            {item.kind === "mood" && (
              <Text>
                {[
                  ...item.data.mealIds.map(
                    (id) =>
                      state.meals.find((m) => m.id === id)?.name ??
                      "Refeição indisponível",
                  ),
                  ...item.data.activityIds.map(
                    (id) =>
                      state.activities.find((a) => a.id === id)?.date ??
                      "Atividade indisponível",
                  ),
                ].join(" · ")}
              </Text>
            )}
            {kind !== "breathing" && (
              <Button
                title="Consultar ou editar"
                variant="outline"
                onPress={() =>
                  router.push({
                    pathname: "/wellbeing/form",
                    params: { kind, id: item.id },
                  })
                }
              />
            )}{" "}
            {item.kind === "fasting" && item.data.status === "active" && (
              <Button
                title="Acompanhar jejum"
                onPress={() =>
                  router.push({
                    pathname: "/wellbeing/fasting",
                    params: { id: item.id },
                  })
                }
              />
            )}
            <Button
              title="Excluir registro"
              variant="text"
              onPress={() =>
                confirm(
                  "Excluir registro?",
                  "O registro será removido do histórico.",
                  () => submit(() => save(item, true)),
                )
              }
            />
          </Card>
        )}
        ListFooterComponent={
          hasMore ? (
            <Button title="Carregar mais" onPress={() => void more()} />
          ) : null
        }
      />
    </Screen>
  );
}

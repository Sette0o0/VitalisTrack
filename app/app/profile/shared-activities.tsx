import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Text, HelperText } from "react-native-paper";
import type { SharedActivity } from "@vitalis/contracts";
import { Button, Card, Header, Screen } from "@/components/vitalis/ui";
import { useOnlineProfile } from "@/hooks/use-online-profile";
import { useSubmit } from "@/hooks/use-submit";
import { useMeasurements } from "@/hooks/use-measurements";
import { exerciseNames } from "@/lib/wellbeing-display";
export default function SharedActivitiesScreen() {
  const { profileId } = useLocalSearchParams<{ profileId: string }>();
  const { distanceText } = useMeasurements();
  const [cursor, setCursor] = useState<string | null>(null);
  const path = `/v1/friends/${encodeURIComponent(profileId)}/activities${cursor ? "?cursor=" + encodeURIComponent(cursor) : ""}`;
  const { data, error, reload, request } =
      useOnlineProfile<SharedActivity[]>(path),
    { submit, error: detailError } = useSubmit(),
    [detail, setDetail] = useState<SharedActivity | null>(null);
  // Details are cleared with list invalidation, including loss of connectivity.
  const visibleDetail =
    data && detail && data.some((a) => a.id === detail.id) ? detail : null;
  return (
    <Screen>
      <Header title="Atividades compartilhadas" onBack={() => router.back()} />
      <Text>
        Somente atividades visíveis para amigos. Rotas e frequência cardíaca
        permanecem privadas.
      </Text>
      {data?.map((a) => (
        <Card key={a.id}>
          <Text>
            {exerciseNames[a.type]} · {a.date} ·{" "}
            {Math.round(a.durationSeconds / 60)} min ·{" "}
            {distanceText(a.distanceMeters / 1000)} ·{" "}
            {a.calories} kcal
          </Text>
          <Button
            title="Consultar detalhe"
            onPress={() =>
              void submit(async () =>
                setDetail(
                  await request<SharedActivity>(
                    `/v1/friends/${profileId}/activities/${a.id}`,
                  ),
                ),
              )
            }
          />
        </Card>
      ))}
      {visibleDetail && (
        <Text>
          Detalhe confirmado: {exerciseNames[visibleDetail.type]} ·{" "}
          {visibleDetail.date} · {visibleDetail.calories} kcal
        </Text>
      )}
      {data?.length === 30 && (
        <Button
          title="Próxima página"
          onPress={() => {
            setDetail(null);
            setCursor(data[data.length - 1].id);
          }}
        />
      )}
      <Button
        title="Atualizar"
        variant="outline"
        onPress={() => {
          setDetail(null);
          void reload();
        }}
      />
      {(error || detailError) && (
        <HelperText type="error">{error || detailError}</HelperText>
      )}
    </Screen>
  );
}

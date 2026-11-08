import { useState } from "react";
import { router } from "expo-router";
import { Share } from "react-native";
import { Text, HelperText } from "react-native-paper";
import type { Friendship } from "@vitalis/contracts";
import { Button, Card, Field, Header, Screen } from "@/components/vitalis/ui";
import { useOnlineProfile } from "@/hooks/use-online-profile";
import { useSubmit } from "@/hooks/use-submit";
export default function FriendsScreen() {
  const { data, error, reload, request } =
      useOnlineProfile<Friendship[]>("/v1/friendships"),
    { submit, error: actionError } = useSubmit(),
    [code, setCode] = useState("");
  return (
    <Screen>
      <Header title="Amizades" onBack={() => router.back()} />
      <Text>
        Compartilhe somente com pessoas escolhidas. Cada perfil possui suas
        próprias amizades. É necessária conexão.
      </Text>
      <Button
        title="Criar e compartilhar convite"
        onPress={() =>
          void submit(async () => {
            const invite = await request<{ code: string }>(
              "/v1/friend-invites",
              { method: "POST" },
            );
            await Share.share({ message: invite.code });
          })
        }
      />
      <Field
        label="Código do convite recebido"
        value={code}
        onChangeText={setCode}
      />
      <Button
        title="Enviar solicitação"
        onPress={() =>
          void submit(async () => {
            await request("/v1/friend-requests", {
              method: "POST",
              body: JSON.stringify({ code: code.trim() }),
            });
            setCode("");
            await reload();
          })
        }
      />
      {data?.map((f) => (
        <Card key={f.id}>
          <Text>
            {f.other.name} ·{" "}
            {f.status === "accepted"
              ? "Amigo"
              : f.incoming
                ? "Solicitação recebida"
                : "Aguardando aceite"}
          </Text>
          {f.status === "pending" &&
            f.incoming &&
            (["accept", "reject"] as const).map((action) => (
              <Button
                key={action}
                title={action === "accept" ? "Aceitar" : "Recusar"}
                onPress={() =>
                  void submit(async () => {
                    await request("/v1/friendships/" + f.id, {
                      method: "PATCH",
                      body: JSON.stringify({ action }),
                    });
                    await reload();
                  })
                }
              />
            ))}
          {f.status === "accepted" && (
            <Button
              title="Atividades compartilhadas"
              onPress={() =>
                router.push({
                  pathname: "/profile/shared-activities",
                  params: { profileId: f.other.id },
                })
              }
            />
          )}
          <Button
            title={
              f.status === "accepted"
                ? "Remover amizade"
                : "Cancelar solicitação"
            }
            variant="text"
            onPress={() =>
              void submit(async () => {
                await request("/v1/friendships/" + f.id, {
                  method: "PATCH",
                  body: JSON.stringify({ action: "remove" }),
                });
                await reload();
              })
            }
          />
        </Card>
      ))}
      <Button
        title="Atualizar amizades"
        variant="outline"
        onPress={() => void reload()}
      />
      {(error || actionError) && (
        <HelperText type="error">{error || actionError}</HelperText>
      )}
    </Screen>
  );
}

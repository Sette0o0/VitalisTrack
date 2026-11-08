import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { Text, HelperText } from "react-native-paper";
import { Button, Card } from "./ui";
import {
  wellbeingNative,
  requireWellbeingNative,
  requestBlePermission,
} from "@/lib/wellbeing-native";
import { useSubmit } from "@/hooks/use-submit";
export function HeartRateControl({
  enabled,
  onReading,
}: {
  enabled: boolean;
  onReading: (bpm: number, second: number) => void;
}) {
  const callback = useRef(onReading);
  callback.current = onReading;
  const [devices, setDevices] = useState<{ id: string; name: string }[]>([]),
    [status, setStatus] = useState("Desconectado"),
    [current, setCurrent] = useState<number | null>(null),
    { submit, error } = useSubmit();
  useEffect(() => {
    if (!wellbeingNative) return;
    const a = wellbeingNative.addListener("onBleDevice", (v) =>
      setDevices((items) =>
        [...new Map([...items, v].map((d) => [d.id, d])).values()].slice(0, 50),
      ),
    );
    const b = wellbeingNative.addListener("onHeartRate", (v) => {
      if (enabled) {
        setCurrent(v.bpm);
        callback.current(v.bpm, v.second);
      }
    });
    const c = wellbeingNative.addListener("onBleState", (v) =>
      setStatus(
        (
          {
            connected: "Conectado",
            reading: "Recebendo leituras",
            disconnected: "Desconectado",
            unsupported: "Sensor sem serviço cardíaco compatível",
            "scan-complete": "Busca concluída",
            "scan-failed": "Não foi possível buscar sensores",
            "subscribe-failed": "Não foi possível iniciar leituras",
          } as Record<string, string>
        )[v.state] ?? "Conectando…",
      ),
    );
    const life = AppState.addEventListener("change", (v) => {
      if (v !== "active") {
        setStatus("Desconectado");
        setCurrent(null);
      }
    });
    return () => {
      a.remove();
      b.remove();
      c.remove();
      life.remove();
      void wellbeingNative?.disconnect();
    };
  }, [enabled]);
  useEffect(() => {
    if (!enabled) {
      void wellbeingNative?.disconnect();
      setCurrent(null);
      setStatus("Pausado");
    }
  }, [enabled]);
  return (
    <Card>
      <Text variant="titleMedium">Frequência cardíaca</Text>
      <Text>
        {status}
        {current ? ` · ${current} bpm` : ""}
      </Text>
      <Text>
        Sensores Bluetooth com serviço cardíaco padrão. Leituras pausam fora do
        aplicativo.
      </Text>
      <Button
        title="Buscar sensor cardíaco"
        disabled={!enabled}
        variant="outline"
        onPress={() =>
          void submit(async () => {
            await requestBlePermission();
            setDevices([]);
            setStatus("Buscando sensores…");
            await requireWellbeingNative().scan();
          })
        }
      />
      {devices.map((d) => (
        <Button
          key={d.id}
          title={`Conectar ${d.name}`}
          disabled={!enabled}
          onPress={() =>
            void submit(async () => {
              await requestBlePermission();
              setStatus("Conectando…");
              await requireWellbeingNative().connect(d.id);
            })
          }
        />
      ))}
      <Button
        title="Desconectar sensor"
        variant="text"
        onPress={() =>
          void submit(async () => {
            await requireWellbeingNative().disconnect();
            setStatus("Desconectado");
            setCurrent(null);
          })
        }
      />
      {error && <HelperText type="error">{error}</HelperText>}
    </Card>
  );
}

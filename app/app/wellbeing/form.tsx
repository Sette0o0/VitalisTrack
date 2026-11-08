import { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import {
  Checkbox,
  RadioButton,
  Text,
  HelperText,
  Switch,
} from "react-native-paper";
import { wellbeingKindSchema, wellbeingInputSchema } from "@vitalis/contracts";
import { Button, Card, Field, Header, Screen } from "@/components/vitalis/ui";
import { DateField, TimeField } from "@/components/vitalis/date-field";
import { useAppState } from "@/state/app-state";
import { useWellbeing } from "@/hooks/use-wellbeing";
import { useSubmit } from "@/hooks/use-submit";
import { getWellbeing } from "@/lib/wellbeing-store";
import { newId, isoDate } from "@/lib/health";
import { parseDecimal, parseInput } from "@/lib/validation";
import { UserFacingError, userError } from "@/lib/user-error";
import {
  dayNames,
  exerciseNames,
  wellbeingTitles,
} from "@/lib/wellbeing-display";

type Fields = Record<string, string>;
const localParts = (v: string) => {
  const d = new Date(v);
  return {
    date: isoDate(d),
    time: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
  };
};
export default function WellbeingForm() {
  const { kind: raw, id } = useLocalSearchParams<{
      kind: string;
      id?: string;
    }>(),
    kind = wellbeingKindSchema.safeParse(raw).success
      ? wellbeingKindSchema.parse(raw)
      : "sleep";
  const { state } = useAppState(),
    { save } = useWellbeing(kind),
    { submit, saving, error } = useSubmit();
  const [fields, setFields] = useState<Fields>({
    date: isoDate(),
    time: localParts(new Date().toISOString()).time,
    startDate: isoDate(),
    startTime: localParts(new Date().toISOString()).time,
    endDate: isoDate(),
    endTime: "",
    hours: "",
    minutes: "0",
    score: "3",
    symptoms: "",
    notes: "",
    name: "",
    dosage: "",
    status: "active",
    reminderTime: "20:00",
  });
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 0]),
    [times, setTimes] = useState<string[]>(["08:00"]),
    [newTime, setNewTime] = useState("08:00"),
    [enabled, setEnabled] = useState(true),
    [ready, setReady] = useState(!id),
    [loadError, setLoadError] = useState("");
  const [plan, setPlan] = useState<
      Record<number, { type: "walk" | "run" | "cycling"; time: string }>
    >({ 1: { type: "walk", time: "08:00" } }),
    [mealIds, setMeals] = useState<string[]>([]),
    [activityIds, setActivities] = useState<string[]>([]),
    [search, setSearch] = useState(""),
    [limit, setLimit] = useState(20);
  const recordId = useRef(id ?? newId());
  const set = (key: string, value: string) =>
    setFields((f) => ({ ...f, [key]: value }));
  useEffect(() => {
    let live = true;
    if (!id) return;
    void getWellbeing(state.userId!, state.profileId ?? state.userId!, id)
      .then((r) => {
        if (!live) return;
        if (!r || r.kind !== kind)
          throw new UserFacingError("Registro indisponível.");
        const d = r.data;
        let f: Fields = {};
        if ("occurredAt" in d) f = { ...f, ...localParts(d.occurredAt) };
        if ("date" in d) f.date = d.date;
        if ("durationMinutes" in d) {
          f.hours = String(Math.floor(d.durationMinutes / 60));
          f.minutes = String(d.durationMinutes % 60);
        }
        if (r.kind === "medication") {
          f = { ...f, name: r.data.name, dosage: r.data.dosage };
          setDays(r.data.weekdays);
          setTimes(r.data.times);
          setEnabled(r.data.enabled);
        }
        if (r.kind === "breathingReminder") {
          f.reminderTime = r.data.time;
          setEnabled(r.data.enabled);
        }
        if (r.kind === "mood") {
          f = {
            ...f,
            score: String(r.data.score),
            notes: r.data.notes,
            symptoms: r.data.symptoms.join("\n"),
          };
          setMeals(r.data.mealIds);
          setActivities(r.data.activityIds);
        }
        if (r.kind === "bloodPressure") {
          f.systolic = String(r.data.systolic);
          f.diastolic = String(r.data.diastolic);
        }
        if (r.kind === "fasting") {
          const a = localParts(r.data.startAt),
            b = localParts(r.data.endAt);
          f = {
            ...f,
            startDate: a.date,
            startTime: a.time,
            endDate: b.date,
            endTime: b.time,
            status: r.data.status,
          };
        }
        if (r.kind === "workoutPlan")
          setPlan(
            Object.fromEntries(
              r.data.days.map((d) => [
                d.weekday,
                { type: d.type, time: d.time },
              ]),
            ),
          );
        setFields((old) => ({ ...old, ...f }));
        setReady(true);
      })
      .catch((e) => {
        if (live) setLoadError(userError(e, "load"));
      });
    return () => {
      live = false;
    };
  }, [id, kind, state.userId, state.profileId]);
  const instant = (date: string, time: string) => {
    const d = new Date(`${date}T${time}:00`);
    if (!/^\d{2}:\d{2}$/.test(time) || !Number.isFinite(d.getTime()))
      throw new UserFacingError("Informe data e horário válidos.");
    return d.toISOString();
  };
  const toggle = (arr: string[], value: string) =>
    arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
  const inputData = (): unknown => {
    switch (kind) {
      case "sleep": {
        const h = parseDecimal(fields.hours),
          m = parseDecimal(fields.minutes);
        if (!Number.isInteger(h) || !Number.isInteger(m) || m < 0 || m > 59)
          throw new UserFacingError(
            "Informe horas inteiras e minutos de 0 a 59.",
          );
        return { date: fields.date, durationMinutes: h * 60 + m };
      }
      case "medication":
        return {
          name: fields.name,
          dosage: fields.dosage,
          weekdays: days,
          times,
          enabled,
        };
      case "breathingReminder":
        return { time: fields.reminderTime, enabled };
      case "workoutPlan":
        return {
          days: Object.entries(plan).map(([weekday, d]) => ({
            weekday: Number(weekday),
            ...d,
          })),
        };
      case "mood":
        return {
          occurredAt: instant(fields.date, fields.time),
          score: Number(fields.score),
          notes: fields.notes,
          symptoms: fields.symptoms
            .split(/[,\n]/)
            .map((s) => s.trim())
            .filter(Boolean),
          mealIds,
          activityIds,
        };
      case "fasting":
        return {
          startAt: instant(fields.startDate, fields.startTime),
          endAt: instant(fields.endDate, fields.endTime),
          status: fields.status,
        };
      case "bloodPressure":
        if(parseDecimal(fields.systolic??"")<=parseDecimal(fields.diastolic??""))throw new UserFacingError("A sistólica deve ser maior que a diastólica");
        return {
          occurredAt: instant(fields.date, fields.time),
          systolic: parseDecimal(fields.systolic ?? ""),
          diastolic: parseDecimal(fields.diastolic ?? ""),
        };
      default:
        throw new UserFacingError(
          "Use a sessão guiada para registrar a respiração.",
        );
    }
  };
  if (!ready)
    return (
      <Screen>
        <Text>{loadError || "Carregando registro…"}</Text>
        <Button title="Voltar" onPress={() => router.back()} />
      </Screen>
    );
  const field = (
    key: string,
    label: string,
    numeric = false,
    multiline = false,
  ) => (
    <Field
      label={label}
      value={fields[key] ?? ""}
      onChangeText={(v) => set(key, v)}
      keyboardType={numeric ? "number-pad" : "default"}
      multiline={multiline}
    />
  );
  const datetime = (
    <>
      <DateField value={fields.date} onChange={(v) => set("date", v)} />
      <TimeField value={fields.time} onChange={(v) => set("time", v)} />
    </>
  );
  return (
    <Screen>
      <Header
        title={`${id ? "Editar" : "Novo"} · ${wellbeingTitles[kind]}`}
        onBack={() => router.back()}
      />
      {kind === "sleep" && (
        <>
          <DateField value={fields.date} onChange={(v) => set("date", v)} />
          {field("hours", "Horas dormidas", true)}
          {field("minutes", "Minutos adicionais", true)}
        </>
      )}
      {kind === "medication" && (
        <>
          {field("name", "Nome do medicamento")}
          {field("dosage", "Dosagem informada")}
          <Text>Dias da semana</Text>
          {dayNames.map((name, d) => (
            <Checkbox.Item
              key={d}
              label={name}
              status={days.includes(d) ? "checked" : "unchecked"}
              onPress={() =>
                setDays((v) =>
                  v.includes(d) ? v.filter((x) => x !== d) : [...v, d],
                )
              }
            />
          ))}
          <Text>Horários programados</Text>
          {times.map((t) => (
            <Button
              key={t}
              title={`Remover horário ${t}`}
              variant="outline"
              onPress={() => setTimes((v) => v.filter((x) => x !== t))}
            />
          ))}
          <TimeField value={newTime} onChange={setNewTime} />
          <Button
            title="Adicionar horário"
            onPress={() =>
              setTimes((v) =>
                v.includes(newTime) ? v : [...v, newTime].sort(),
              )
            }
          />
        </>
      )}
      {(kind === "medication" || kind === "breathingReminder") && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <Text>Lembrete ativo</Text>
          <Switch
            accessibilityLabel="Lembrete ativo"
            value={enabled}
            onValueChange={setEnabled}
          />
        </View>
      )}
      {kind === "breathingReminder" && (
        <TimeField
          value={fields.reminderTime}
          onChange={(v) => set("reminderTime", v)}
        />
      )}
      {kind === "workoutPlan" &&
        dayNames.map((name, d) => (
          <Card key={d}>
            <Checkbox.Item
              label={name}
              status={plan[d] ? "checked" : "unchecked"}
              onPress={() =>
                setPlan((p) => {
                  const next = { ...p };
                  if (next[d]) delete next[d];
                  else next[d] = { type: "walk", time: "08:00" };
                  return next;
                })
              }
            />
            {plan[d] && (
              <>
                <RadioButton.Group
                  value={plan[d].type}
                  onValueChange={(v) =>
                    setPlan((p) => ({
                      ...p,
                      [d]: { ...p[d], type: v as "walk" | "run" | "cycling" },
                    }))
                  }
                >
                  {(["walk", "run", "cycling"] as const).map((type) => (
                    <RadioButton.Item
                      key={type}
                      label={exerciseNames[type]}
                      value={type}
                    />
                  ))}
                </RadioButton.Group>
                <TimeField
                  value={plan[d].time}
                  onChange={(time) =>
                    setPlan((p) => ({ ...p, [d]: { ...p[d], time } }))
                  }
                />
              </>
            )}
          </Card>
        ))}
      {kind === "mood" && (
        <>
          {datetime}
          <Text>Humor de 1 a 5</Text>
          <RadioButton.Group
            value={fields.score}
            onValueChange={(v) => set("score", v)}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <RadioButton.Item
                key={n}
                value={String(n)}
                label={`Humor ${n}`}
              />
            ))}
          </RadioButton.Group>
          {field("notes", "Notas", false, true)}
          {field("symptoms", "Sintomas, um por linha", false, true)}
          <Text>Associações opcionais</Text>
          <Field
            label="Buscar refeição ou atividade"
            value={search}
            onChangeText={(v) => {
              setSearch(v);
              setLimit(20);
            }}
          />
          {state.meals
            .filter((r) => r.name.toLowerCase().includes(search.toLowerCase()))
            .slice(0, limit)
            .map((r) => (
              <Checkbox.Item
                key={r.id}
                label={`${r.name} · ${r.date}`}
                status={mealIds.includes(r.id) ? "checked" : "unchecked"}
                onPress={() => setMeals((v) => toggle(v, r.id))}
              />
            ))}
          {state.activities
            .filter((r) =>
              `${r.date} ${exerciseNames[r.type]}`
                .toLowerCase()
                .includes(search.toLowerCase()),
            )
            .slice(0, limit)
            .map((r) => (
              <Checkbox.Item
                key={r.id}
                label={`${exerciseNames[r.type]} · ${r.date}`}
                status={activityIds.includes(r.id) ? "checked" : "unchecked"}
                onPress={() => setActivities((v) => toggle(v, r.id))}
              />
            ))}
          {mealIds
            .filter((id) => !state.meals.some((r) => r.id === id))
            .map((id) => (
              <Text key={id}>Refeição associada indisponível</Text>
            ))}
          {activityIds
            .filter((id) => !state.activities.some((r) => r.id === id))
            .map((id) => (
              <Text key={id}>Atividade associada indisponível</Text>
            ))}
          <Button
            title="Mostrar mais associações"
            variant="text"
            onPress={() => setLimit((v) => v + 20)}
          />
        </>
      )}
      {kind === "fasting" && (
        <>
          <DateField
            label="Data de início"
            value={fields.startDate}
            onChange={(v) => set("startDate", v)}
          />
          <Text>Horário de início</Text>
          <TimeField
            value={fields.startTime}
            onChange={(v) => set("startTime", v)}
          />
          <DateField
            label="Data de término"
            value={fields.endDate}
            onChange={(v) => set("endDate", v)}
          />
          <Field
            label="Horário de término (HH:mm)"
            value={fields.endTime}
            onChangeText={(v) => set("endTime", v)}
          />
          <RadioButton.Group
            value={fields.status}
            onValueChange={(v) => set("status", v)}
          >
            <RadioButton.Item label="Em andamento" value="active" />
            <RadioButton.Item label="Concluído" value="completed" />
            <RadioButton.Item label="Cancelado" value="cancelled" />
          </RadioButton.Group>
        </>
      )}
      {kind === "bloodPressure" && (
        <>
          {datetime}
          {field("systolic", "Pressão sistólica (mmHg)", true)}
          {field("diastolic", "Pressão diastólica (mmHg)", true)}
        </>
      )}
      <Button
        title="Salvar registro"
        loading={saving}
        onPress={() =>
          void submit(async () => {
            const input = parseInput(wellbeingInputSchema, {
              id: recordId.current,
              kind,
              data: inputData(),
            });
            await save(input);
            router.back();
          })
        }
      />
      {error && <HelperText type="error">{error}</HelperText>}
    </Screen>
  );
}

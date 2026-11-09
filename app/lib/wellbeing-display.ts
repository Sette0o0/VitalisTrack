import {
  sleepMessage,
  type WellbeingKind,
  type WellbeingRecord,
} from "@vitalis/contracts";
export const moodLevels = [
  { score: 1, label: "Muito mal" },
  { score: 2, label: "Mal" },
  { score: 3, label: "Neutro" },
  { score: 4, label: "Bem" },
  { score: 5, label: "Muito bem" },
] as const;
export function moodLabel(score: number) {
  return moodLevels.find((level) => level.score === score)?.label ?? "Não informado";
}
export const wellbeingTitles: Record<WellbeingKind, string> = {
  workoutPlan: "Plano semanal",
  medication: "Medicação",
  breathingReminder: "Lembrete de respiração",
  breathing: "Sessões de respiração",
  sleep: "Sono",
  mood: "Humor e sintomas",
  fasting: "Jejum",
  bloodPressure: "Pressão arterial",
};
export const dayNames = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];
export const exerciseNames = {
  walk: "Caminhada",
  run: "Corrida",
  cycling: "Ciclismo",
};
export function describeWellbeing(r: WellbeingRecord) {
  switch (r.kind) {
    case "medication":
      return `${r.data.name} · ${r.data.dosage} · ${r.data.times.join(", ")} · ${r.data.weekdays.map((d) => dayNames[d]).join(", ")} · ${r.data.enabled ? "Ativo" : "Desativado"}`;
    case "workoutPlan":
      return r.data.days
        .map(
          (d) =>
            `${dayNames[d.weekday]}: ${exerciseNames[d.type]} às ${d.time}`,
        )
        .join("\n");
    case "breathingReminder":
      return `${r.data.time} · ${r.data.enabled ? "Ativo" : "Desativado"}`;
    case "breathing":
      return `3 minutos concluídos · ${new Date(r.data.completedAt).toLocaleString("pt-BR")}`;
    case "sleep":
      return `${r.data.date.split("-").reverse().join("/")} · ${Math.floor(r.data.durationMinutes / 60)}h ${r.data.durationMinutes % 60}min\n${sleepMessage(r.data.durationMinutes)}`;
    case "mood":
      return `${new Date(r.data.occurredAt).toLocaleString("pt-BR")} · Humor: ${moodLabel(r.data.score)}\n${r.data.symptoms.join(", ")}${r.data.notes ? "\n" + r.data.notes : ""}`;
    case "fasting":
      return `${new Date(r.data.startAt).toLocaleString("pt-BR")} → ${new Date(r.data.endAt).toLocaleString("pt-BR")} · ${r.data.status === "cancelled" ? "Cancelado" : Date.parse(r.data.endAt) <= Date.now() || r.data.status === "completed" ? "Concluído" : "Em andamento"}`;
    case "bloodPressure":
      return `${new Date(r.data.occurredAt).toLocaleString("pt-BR")} · ${r.data.systolic}/${r.data.diastolic} mmHg`;
  }
}

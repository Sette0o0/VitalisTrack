export type ActiveTimer = {
  elapsedMs: number;
  running: boolean;
  lastTick: number;
};
export const advanceTimer = (
  timer: ActiveTimer,
  now: number,
  limit = 180000,
): ActiveTimer => ({
  ...timer,
  elapsedMs: Math.min(
    limit,
    timer.elapsedMs + (timer.running ? Math.max(0, now - timer.lastTick) : 0),
  ),
  lastTick: now,
});
export const breathingPhase = (elapsedMs: number) =>
  elapsedMs >= 180000
    ? "Concluído"
    : elapsedMs % 10000 < 4000
      ? "Inspire"
      : "Expire";
export const formatCountdown = (seconds: number) =>
  `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
export const addHeartRate = (
  summary: { sum: number; count: number; lastSecond: number },
  bpm: number,
  second: number,
  paused: boolean,
) =>
  paused ||
  !Number.isInteger(bpm) ||
  bpm <= 0 ||
  bpm > 65535 ||
  second <= summary.lastSecond ||
  summary.count >= 86400
    ? summary
    : { sum: summary.sum + bpm, count: summary.count + 1, lastSecond: second };

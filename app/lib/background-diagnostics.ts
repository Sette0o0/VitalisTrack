import { getValue, setValue } from "./local-database";
import { newId } from "./health";
export type BackgroundRun = {
    id: string;
    startedAt: string;
    finishedAt?: string;
    status: "js-started" | "completed" | "deferred" | "failed";
    reason?: "session-unavailable" | "network-unavailable" | "session-changed" | "retry-required";
};
export async function startBackgroundRun(): Promise<BackgroundRun> {
    const run: BackgroundRun = { id: newId(), startedAt: new Date().toISOString(), status: "js-started" };
    const previous = JSON.parse((await getValue("background-runs", null, null)) ?? "[]") as BackgroundRun[];
    await setValue("background-runs", JSON.stringify([...previous, run].slice(-20)), null, null);
    return run;
}
export async function finishBackgroundRun(run: BackgroundRun, status: BackgroundRun["status"], reason?: BackgroundRun["reason"]) {
    const previous = JSON.parse((await getValue("background-runs", null, null)) ?? "[]") as BackgroundRun[];
    const result = { ...run, finishedAt: new Date().toISOString(), status, ...(reason ? { reason } : {}) };
    await setValue("background-runs", JSON.stringify([...previous.filter(r => r.id !== run.id), result].slice(-20)), null, null);
}

/* global AbortController, AbortSignal, clearTimeout, console, fetch, process, setTimeout */
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, URL } from "node:url";

const startupTimeoutMs = 30_000;
const serverDirectory = fileURLToPath(new URL("../", import.meta.url));
const abort = new AbortController();
let receivedSignal;
for (const signal of ["SIGINT", "SIGTERM"]) {
	process.once(signal, () => {
		receivedSignal = signal;
		abort.abort();
	});
}

// Reserve an available loopback port rather than contacting an existing API.
const reservation = createServer();
reservation.listen(0, "127.0.0.1");
await once(reservation, "listening");
const port = reservation.address().port;
await new Promise((resolve, reject) => reservation.close((error) => error ? reject(error) : resolve()));

const child = spawn(process.execPath, ["dist/index.js"], {
	cwd: serverDirectory,
	env: { ...process.env, HOST: "127.0.0.1", PORT: String(port) },
	stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
for (const stream of [child.stdout, child.stderr]) {
	stream.setEncoding("utf8");
	stream.on("data", (chunk) => { output = (output + chunk).slice(-65_536); });
}
let termination;
const closed = new Promise((resolve) => {
	child.once("error", (error) => { termination = error.message; });
	child.once("close", (code, signal) => {
		termination ??= `code=${code}, signal=${signal}`;
		resolve();
	});
});

const deadline = Date.now() + startupTimeoutMs;
let lastFailure = "A API ainda não respondeu.";
try {
	while (Date.now() < deadline) {
		abort.signal.throwIfAborted();
		if (termination) throw new Error(`A API compilada encerrou: ${termination}`);
		try {
			for (const [path, status] of [["/health", "ok"], ["/ready", "ready"]]) {
				const response = await fetch(`http://127.0.0.1:${port}${path}`, {
					signal: AbortSignal.any([
						abort.signal,
						AbortSignal.timeout(Math.max(1, Math.min(1_000, deadline - Date.now()))),
					]),
				});
				if (!response.ok || (await response.json()).data?.status !== status) {
					throw new Error(`${path}: resposta inválida (HTTP ${response.status})`);
				}
			}
			if (termination) throw new Error(`A API compilada encerrou: ${termination}`);
			console.log("API compilada aprovada: /health=ok e /ready=ready.");
			break;
		} catch (error) {
			lastFailure = error.message;
			if (Date.now() >= deadline) throw new Error(`Prazo de 30 s excedido. ${lastFailure}`);
			await delay(Math.min(200, Math.max(1, deadline - Date.now())), undefined, { signal: abort.signal });
			continue;
		}
	}
	if (Date.now() >= deadline) throw new Error(`Prazo de 30 s excedido. ${lastFailure}`);
} catch (error) {
	console.error(error.message);
	process.exitCode = receivedSignal === "SIGINT" ? 130 : receivedSignal === "SIGTERM" ? 143 : 1;
} finally {
	if (!termination) child.kill("SIGTERM");
	const killTimer = setTimeout(() => child.kill("SIGKILL"), 5_000);
	killTimer.unref();
	await closed;
	clearTimeout(killTimer);
	if (process.exitCode) {
		// Keep startup diagnostics bounded and redact connection strings and JWTs.
		console.error(output
			.replace(/postgres(?:ql)?:\/\/[^\s"']+/g, "[DATABASE_URL]")
			.replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[JWT]"));
	}
}

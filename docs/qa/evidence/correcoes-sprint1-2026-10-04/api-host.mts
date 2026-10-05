import { appendFile } from "node:fs/promises";
import { buildApp } from "../../../../server/src/app.js";
if (process.env.NODE_ENV !== "test" || !/\/vitalis_qa(?:\?|$)/.test(process.env.DATABASE_URL ?? ""))
 throw new Error("Servidor restrito ao banco exclusivo vitalis_qa.");
const app = await buildApp();
app.addHook("onResponse", async (request, reply) => {
 await appendFile("/tmp/vitalis-sprint1-fixes/http.jsonl", JSON.stringify({
  at: new Date().toISOString(), method: request.method, path: request.url,
  status: reply.statusCode, ms: reply.elapsedTime, client: request.headers["user-agent"],
 }) + "\n");
});
await app.listen({ port: 3011, host: "0.0.0.0" });

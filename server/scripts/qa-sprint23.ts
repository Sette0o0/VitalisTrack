import { readFile, writeFile } from "node:fs/promises";
import pg from "pg";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
const url = new URL(process.env.DATABASE_URL!);
if (url.hostname !== "127.0.0.1" || url.port !== "5550" || url.pathname !== "/vitalis_sprint2_final_tests") throw new Error("Exclusive Sprint2 QA test database required");
const root = new URL("../../artifacts/sprint2-completa-20261108/", import.meta.url);
const app = await buildApp(); await app.ready();
const registered = await app.inject({ method: "POST", url: "/v1/auth/register", payload: { name: "QA Load Sprint2", email: `load23-${crypto.randomUUID()}@example.com`, password: "qa-12345678", passwordConfirmation: "qa-12345678" } });
if (registered.statusCode !== 201) throw new Error("Synthetic registration failed");
const { profile, tokens } = registered.json().data, user = profile.id as string, secondary = crypto.randomUUID();
const headers = { authorization: "Bearer " + tokens.accessToken };
const created = await app.inject({ method: "POST", url: "/v1/profiles", headers, payload: { id: secondary, name: "QA Load Family" } });
if (created.statusCode !== 201) throw new Error("Synthetic profile creation failed");
const mutations = Array.from({ length: 900 }, (_, i) => {
  const id = crypto.randomUUID(), date = "2026-11-08", entity = ["water", "meal", "activity", "weight", "wellbeing"][i % 5]!;
  const payload = entity === "water" ? { id, date, time: "12:00", amountMl: 200 } : entity === "meal" ? { id, date, time: "12:00", name: "QA", quantity: 100, unit: "g", calories: 200 } : entity === "activity" ? { id, date, type: "walk", durationSeconds: 600, distanceMeters: 1000, route: [] } : entity === "weight" ? { id, date, weightKg: 70 } : { id, kind: "sleep", data: { date, durationMinutes: 480 } };
  return { mutationId: crypto.randomUUID(), profileId: i % 2 ? secondary : user, entity, action: "upsert", payload, clientUpdatedAt: "2000-01-01T00:00:00Z" };
});
let next = 0, failures = 0; const timings: number[] = [];
const send = async (m: object) => {
  const start = performance.now(), response = await app.inject({ method: "POST", url: "/v1/sync", headers, payload: { mutations: [m] } });
  timings.push(performance.now() - start);
  if (response.statusCode !== 200 || response.json().data[0]?.status !== "applied") failures++;
};
const read = async () => {
  const [water, meals, activities, weights, wellbeing] = await Promise.all([
    prisma.waterEntry.findMany({ where: { userId: user } }), prisma.meal.findMany({ where: { userId: user } }), prisma.activity.findMany({ where: { userId: user } }), prisma.weightEntry.findMany({ where: { userId: user } }), prisma.wellbeingRecord.findMany({ where: { userId: user } }),
  ]);
  return [...water, ...meals, ...activities, ...weights, ...wellbeing].map(r => ({ id: r.id, profileId: r.profileId, updatedAt: r.updatedAt.toISOString(), revision: "revision" in r ? String(r.revision) : null }));
};
let load: object;
try {
  await Promise.all(Array.from({ length: 8 }, async () => { while (next < mutations.length) await send(mutations[next++]!); }));
  const before = await read(), map = new Map(before.map(r => [r.id, r]));
  for (const m of mutations.slice(0, 100)) await send(m);
  const after = await read(); timings.sort((a, b) => a - b);
  const idempotent = after.every(r => JSON.stringify(map.get(r.id)) === JSON.stringify(r));
  const counts = [user, secondary].map(id => after.filter(r => r.profileId === id).length);
  load = { operations: 1000, uniqueMutations: 900, replays: 100, failures, rows: after.length, perProfile: counts, idempotent, p50Ms: timings[499], p95Ms: timings[949], maxMs: timings.at(-1), transport: "Fastify inject + exclusive local PostgreSQL18; not4G" };
  await writeFile(new URL("load.json", root), JSON.stringify(load, null, 2));
  if (failures >= 10 || after.length !== 900 || counts.some(n => n !== 450) || !idempotent) throw new Error("Sync load acceptance failed");
} finally { await prisma.user.delete({ where: { id: user } }); await app.close(); }
const client = new pg.Client({ connectionString: process.env.DATABASE_URL }); await client.connect();
const schema = "qa_s23_" + crypto.randomUUID().replaceAll("-", "");
try {
  await client.query(`CREATE SCHEMA ${schema}`); await client.query(`SET search_path TO ${schema}`);
  for (const name of ["20260921000425_init", "20261026000100_sprint2_profiles", "20261107000100_sprint22"]) await client.query(await readFile(new URL(`../prisma/migrations/${name}/migration.sql`, import.meta.url), "utf8"));
  const user = crypto.randomUUID(), activity = crypto.randomUUID(), mutation = crypto.randomUUID();
  await client.query('INSERT INTO "User"(id,email,"passwordHash","updatedAt") VALUES($1,$2,$3,now())', [user, "qa-migration-s23@example.com", "synthetic"]);
  await client.query('INSERT INTO "Profile"(id,"userId","isPrimary",name,"avatarPath","updatedAt") VALUES($1,$1,true,$2,$3,now())', [user, "QA migration", "/uploads/qa.png"]);
  await client.query('INSERT INTO "Goals"("profileId","userId",steps,"updatedAt") VALUES($1,$1,12345,now())', [user]);
  await client.query('INSERT INTO "DailySteps"(id,"profileId","userId",date,steps,"updatedAt") VALUES($1,$2,$2,$3,9000,now())', [crypto.randomUUID(), user, "2026-11-08"]);
  await client.query('INSERT INTO "Activity"(id,"profileId","userId",type,date,"durationSeconds","distanceMeters",calories,"updatedAt") VALUES($1,$2,$2,$3,$4,600,1000,43,now())', [activity, user, "walk", "2026-11-08"]);
  await client.query('INSERT INTO "ProcessedMutation"(id,"userId","mutationId",result) VALUES($1,$2,$3,$4)', [crypto.randomUUID(), user, mutation, JSON.stringify({ status: "applied" })]);
  const sql = await readFile(new URL("../prisma/migrations/20261108000100_sprint23/migration.sql", import.meta.url), "utf8");
  let failed = false;
  try { await client.query(sql.replace("COMMIT;", "SELECT 1/0; COMMIT;")); } catch { failed = true; await client.query("ROLLBACK"); }
  const noDocuments = (await client.query('SELECT to_regclass(\'"MedicalDocument"\') value')).rows[0].value === null;
  const noColumn = (await client.query("SELECT count(*)::int n FROM information_schema.columns WHERE table_schema=$1 AND table_name='DailySteps' AND column_name='deletedAt'", [schema])).rows[0].n === 0;
  await writeFile(new URL("migration-rollback.json", root), JSON.stringify({ forcedFailure: failed, noDocumentsTable: noDocuments, noStepColumn: noColumn, scope: schema }, null, 2));
  if (!failed || !noDocuments || !noColumn) throw new Error("DDL rollback failed");
  await client.query(sql);
  const row = (await client.query('SELECT p.id,p."avatarPath",g.steps,a."durationSeconds",s."deletedAt",(SELECT count(*)::int FROM "ProcessedMutation") confirmations FROM "Profile" p JOIN "Goals" g ON g."profileId"=p.id JOIN "Activity" a ON a."profileId"=p.id JOIN "DailySteps" s ON s."profileId"=p.id')).rows[0];
  const report = { uuidPreserved: row.id === user, avatarPreserved: row.avatarPath === "/uploads/qa.png", goalsPreserved: row.steps === 12345, activityPreserved: row.durationSeconds === 600, stepsNotDeleted: row.deletedAt === null, confirmationPreserved: row.confirmations === 1 };
  await writeFile(new URL("migration-upgrade.json", root), JSON.stringify(report, null, 2)); if (!Object.values(report).every(Boolean)) throw new Error("Preservation failed");
} finally { await client.query("ROLLBACK").catch(() => {}); await client.query("SET search_path TO public"); await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await client.end(); }
console.log(JSON.stringify(load));

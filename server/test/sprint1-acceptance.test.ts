import { afterAll, afterEach, beforeAll, expect, test, vi } from "vitest";
import { readdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

const app = await buildApp();
let userId = "", token = "";
const auth = () => ({ authorization: `Bearer ${token}` });
beforeAll(async () => {
 await app.ready();
 const r = await app.inject({ method: "POST", url: "/v1/auth/register", payload: {
  name: "Aceite Sprint", email: `aceite-${crypto.randomUUID()}@example.com`, password: "qa-12345678", passwordConfirmation: "qa-12345678",
 } });
 expect(r.statusCode).toBe(201); userId = r.json().data.profile.id;
 token = app.jwt.sign({ sub: userId }, { expiresIn: "10y" });
});
afterEach(() => vi.useRealTimers());
afterAll(async () => {
 if (userId) {
  await prisma.user.delete({ where: { id: userId } });
  const dir = join(process.cwd(), "storage", "avatars");
  for (const name of await readdir(dir).catch(() => [] as string[])) if (name.startsWith(`${userId}-`)) await unlink(join(dir, name));
 }
 await app.close();
});
test("1.000 atividades com empates são paginadas uma única vez por data/tipo e filtros", async () => {
 const rows = Array.from({ length: 1000 }, (_, i) => ({ id: crypto.randomUUID(), userId,
  type: ["walk", "run", "cycling"][i % 3]!, date: new Date(`2026-10-0${i % 3 + 1}T00:00:00Z`),
  createdAt: new Date("2026-10-03T12:00:00Z"), durationSeconds: 1800, distanceMeters: 1000, calories: 100,
 }));
 await prisma.activity.createMany({ data: rows });
 for (const sort of ["date", "type"] as const) for (const limit of [7, 50, 100]) for (const filter of ["", "&date=2026-10-02&type=run"]) {
  let cursor: string | null = null; const ids: string[] = []; let pages = 0;
  do {
   const url: string = `/v1/activities?sort=${sort}&limit=${limit}${filter}${cursor ? `&cursor=${cursor}` : ""}`;
   const r = await app.inject({ method: "GET", url, headers: auth() });
   expect(r.statusCode).toBe(200); const body = r.json<{ data: { id: string }[]; meta: { nextCursor: string | null } }>();
   ids.push(...body.data.map((x: {id: string}) => x.id)); cursor = body.meta.nextCursor;
   expect(++pages).toBeLessThanOrEqual(145);
  } while (cursor);
  const expected = rows.filter((r) => !filter || (r.type === "run" && r.date.toISOString().startsWith("2026-10-02")))
   .sort((a,b) => (sort === "type" ? a.type.localeCompare(b.type) : 0) || b.date.getTime()-a.date.getTime() || b.id.localeCompare(a.id)).map((r) => r.id);
  expect(ids).toEqual(expected); expect(new Set(ids).size).toBe(expected.length);
 }
}, 30000);
test("PATCH e sincronismo validam nascimento no fuso do aparelho e fuso capturado", async () => {
 vi.setSystemTime(new Date("2026-10-04T00:30:00Z"));
 const patch = (birthDate: string, zone?: string) => app.inject({ method: "PATCH", url: "/v1/profile", headers: { ...auth(), ...(zone ? { "x-client-time-zone": zone } : {}) }, payload: { birthDate } });
 expect((await patch("2026-10-04", "America/Sao_Paulo")).statusCode).toBe(400);
 expect((await patch("2026-10-03", "America/Sao_Paulo")).statusCode).toBe(200);
 expect((await patch("2026-10-04", "Asia/Tokyo")).statusCode).toBe(200);
 expect((await patch("2026-10-04")).statusCode).toBe(200);
 expect((await patch("2001-02-29", "UTC")).statusCode).toBe(400);
 expect((await patch("2000-02-29", "UTC")).statusCode).toBe(200);
 expect((await patch("2000-01-01", "Fuso/Inexistente")).statusCode).toBe(400);
 for (const offset of ["+03:00", "-05:00"]) expect((await patch("2000-01-01", offset)).statusCode).toBe(400);
 const sync = async (zone: string) => app.inject({ method: "POST", url: "/v1/sync", headers: { ...auth(), "x-client-time-zone": "Asia/Tokyo" }, payload: { mutations: [{
  mutationId: crypto.randomUUID(), entity: "profile", action: "upsert", payload: { birthDate: "2026-10-04" }, clientUpdatedAt: new Date().toISOString(), clientTimeZone: zone,
 }] } });
 expect((await sync("America/Sao_Paulo")).json().data[0].status).toBe("failed");
 expect((await sync("Asia/Tokyo")).json().data[0].status).toBe("applied");
 expect((await sync("+03:00")).statusCode).toBe(400);
 expect((await sync("Etc/GMT+3")).statusCode).toBe(200);
 vi.setSystemTime(new Date("2026-10-04T03:00:00Z"));
 expect((await patch("2026-10-04", "America/Sao_Paulo")).statusCode).toBe(200);
});
test("idade muda no aniversário local sem adiantar pela meia-noite UTC", async () => {
 vi.setSystemTime(new Date("2026-10-04T00:30:00Z"));
 await app.inject({ method: "PATCH", url: "/v1/profile", headers: auth(), payload: { birthDate: "2000-10-04" } });
 const get = (zone: string) => app.inject({ method: "GET", url: "/v1/profile", headers: { ...auth(), "x-client-time-zone": zone } });
 expect((await get("America/Sao_Paulo")).json().data.age).toBe(25);
 expect((await get("Asia/Tokyo")).json().data.age).toBe(26);
 vi.setSystemTime(new Date("2026-10-04T03:00:00Z"));
 expect((await get("America/Sao_Paulo")).json().data.age).toBe(26);
});
const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB9sAAAAASUVORK5CYII=", "base64");
async function upload(key?: string, mime = "image/png", bytes = image) {
 const boundary = "vitalis-qa-boundary";
 return app.inject({ method: "POST", url: "/v1/profile/avatar", headers: { ...auth(), "content-type": `multipart/form-data; boundary=${boundary}`, ...(key ? { "idempotency-key": key } : {}) }, payload: Buffer.concat([
  Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="photo.png"\r\nContent-Type: ${mime}\r\n\r\n`), bytes, Buffer.from(`\r\n--${boundary}--\r\n`),
 ]) });
}
test("upload concorrente/retry é idempotente e replay antigo não reaplica foto", async () => {
 const key = crypto.randomUUID();
 const responses = await Promise.all(Array.from({ length: 6 }, () => upload(key)));
 expect(responses.map((r) => r.statusCode)).toEqual(Array(6).fill(200));
 const urls = responses.map((r) => r.json().data.avatarUrl);
 expect(new Set(urls).size).toBe(1);
 expect(await prisma.processedMutation.count({ where: { userId, mutationId: key } })).toBe(1);
 const newer = await upload(crypto.randomUUID()); expect(newer.statusCode).toBe(200);
 expect(newer.json().data.avatarUrl).not.toBe(urls[0]);
 const replay = await upload(key); expect(replay.statusCode).toBe(200);
 expect(replay.json().data.avatarUrl).toBe(newer.json().data.avatarUrl);
 const current = await app.inject({ method: "GET", url: "/v1/profile", headers: auth() });
 expect(current.json().data.avatarUrl).toBe(newer.json().data.avatarUrl);
 const path = new URL(current.json().data.avatarUrl).pathname;
 const served = await app.inject({ method: "GET", url: path }); expect(served.rawPayload).toEqual(image);
});
test("upload rejeita tipo/tamanho/chave inválidos e mantém foto anterior", async () => {
 const before = await prisma.profile.findUniqueOrThrow({ where: { userId } });
 expect((await upload("invalid")).statusCode).toBe(400);
 expect((await upload(crypto.randomUUID(), "image/gif")).statusCode).toBe(415);
 expect((await upload(crypto.randomUUID(), "image/png", Buffer.alloc(5*1024*1024+1))).statusCode).toBe(413);
 expect((await prisma.profile.findUniqueOrThrow({ where: { userId } })).avatarPath).toBe(before.avatarPath);
});
test("identificador não pode ser reutilizado entre upload e mutação JSON; cliente antigo continua aceito", async () => {
 const key = crypto.randomUUID();
 expect((await upload(key)).statusCode).toBe(200);
 const json = (mutationId: string) => app.inject({ method: "POST", url: "/v1/sync", headers: auth(), payload: { mutations: [{
  mutationId, entity: "profile", action: "upsert", payload: { name: "Perfil QA" }, clientUpdatedAt: new Date().toISOString(),
 }] } });
 expect((await json(key)).json().data[0].status).toBe("failed");
 const otherKey = crypto.randomUUID();
 expect((await json(otherKey)).json().data[0].status).toBe("applied");
 expect((await upload(otherKey)).statusCode).toBe(409);
 expect((await upload()).statusCode).toBe(200);
});
test("falha transacional no upload remove arquivo parcial e permite retry da mesma operação", async () => {
 const profile = await prisma.profile.findUniqueOrThrow({ where: { userId } });
 const key = crypto.randomUUID();
 await prisma.profile.delete({ where: { userId } });
 try {
  expect((await upload(key)).statusCode).toBe(500);
  expect(await prisma.processedMutation.count({ where: { userId, mutationId: key } })).toBe(0);
  expect(await readdir(join(process.cwd(), "storage", "avatars"))).not.toContain(`${userId}-${key}.png`);
 } finally {
  await prisma.profile.create({ data: profile });
 }
 expect((await upload(key)).statusCode).toBe(200);
 expect(await prisma.processedMutation.count({ where: { userId, mutationId: key } })).toBe(1);
});

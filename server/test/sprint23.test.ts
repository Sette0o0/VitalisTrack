import { beforeAll, afterAll, test, expect } from "vitest";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { unlink } from "node:fs/promises";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { documentSignature, safeDocumentName, privateDocumentDirectory } from "../src/routes/documents.js";
const app = await buildApp(), users: {
    id: string;
    token: string;
}[] = [];
let secondary = "";
const pdf = Buffer.from("%PDF-1.7\nsynthetic fixture\n%%EOF\n");
const headers = (i = 0, profile = users[i]!.id) => ({ authorization: "Bearer " + users[i]!.token, "x-profile-id": profile });
const multipart = (bytes: Buffer, mime: string, name = "exame.pdf") => {
    const boundary = "qa-" + crypto.randomUUID();
    return { type: `multipart/form-data; boundary=${boundary}`, data: Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: ${mime}\r\n\r\n`), bytes, Buffer.from(`\r\n--${boundary}--\r\n`)]) };
};
const upload = (id: string, mutationId: string, bytes = pdf, mime = "application/pdf", i = 0, profile = users[i]!.id) => {
    const form = multipart(bytes, mime);
    return app.inject({ method: "POST", url: "/v1/documents", headers: { ...headers(i, profile), "content-type": form.type, "x-document-id": id, "idempotency-key": mutationId }, payload: form.data });
};
beforeAll(async () => {
    await app.ready();
    for (let i = 0; i < 2; i++) {
        const r = await app.inject({ method: "POST", url: "/v1/auth/register", payload: { name: "QA Sprint23", email: `s23-${crypto.randomUUID()}@example.com`, password: "qa-12345678", passwordConfirmation: "qa-12345678" } });
        expect(r.statusCode).toBe(201);
        users.push({ id: r.json().data.profile.id, token: r.json().data.tokens.accessToken });
    }
    secondary = crypto.randomUUID();
    await app.inject({ method: "POST", url: "/v1/profiles", headers: headers(), payload: { id: secondary, name: "QA Familiar" } });
});
afterAll(async () => {
    const docs = await prisma.medicalDocument.findMany({ where: { userId: { in: users.map(u => u.id) } } });
    for (const doc of docs)
        await unlink(join(privateDocumentDirectory(), doc.storageName)).catch(() => { });
    for (const u of users)
        await prisma.user.delete({ where: { id: u.id } });
    await app.close();
});
test("private upload, authenticated bytes and idempotent confirmation preserve server dates/revision", async () => {
    const id = crypto.randomUUID(), mutation = crypto.randomUUID();
    const created = await upload(id, mutation);
    expect(created.statusCode, created.body).toBe(201);
    expect(created.json().data.sha256).toBe(createHash("sha256").update(pdf).digest("hex"));
    expect((await upload(id, mutation)).json().data).toEqual(created.json().data);
    const downloaded = await app.inject({ url: `/v1/documents/${id}/file`, headers: headers() });
    expect(downloaded.statusCode).toBe(200);
    expect(downloaded.rawPayload.equals(pdf)).toBe(true);
    expect(downloaded.headers["cache-control"]).toBe("private, no-store");
    const stored = await prisma.medicalDocument.findUniqueOrThrow({ where: { id } });
    expect((await app.inject({ url: `/uploads/documents/${stored.storageName}` })).statusCode).toBe(404);
    expect((await app.inject({ url: `/v1/documents/${id}/file` })).statusCode).toBe(401);
    expect((await upload(id, crypto.randomUUID(), Buffer.concat([pdf, pdf]))).statusCode).toBe(409);
});
test("documents are isolated by account/profile, including accepted friends", async () => {
    const id = crypto.randomUUID();
    expect((await upload(id, crypto.randomUUID())).statusCode).toBe(201);
    const code = (await app.inject({ method: "POST", url: "/v1/friend-invites", headers: headers() })).json().data.code;
    const friendship = (await app.inject({ method: "POST", url: "/v1/friend-requests", headers: headers(1), payload: { code } })).json().data.id;
    await app.inject({ method: "PATCH", url: "/v1/friendships/" + friendship, headers: headers(), payload: { action: "accept" } });
    for (const h of [headers(1), headers(0, secondary)]) {
        expect((await app.inject({ url: `/v1/documents/${id}/file`, headers: h })).statusCode).toBe(404);
        expect((await app.inject({ method: "DELETE", url: `/v1/documents/${id}`, headers: h })).statusCode).toBe(403);
        expect((await app.inject({ url: "/v1/documents", headers: h })).json().data.records).toEqual([]);
    }
    expect((await upload(id, crypto.randomUUID(), pdf, "application/pdf", 1)).statusCode).toBe(403);
});
test("signature/type/size checks apply to all formats and names cannot introduce paths", async () => {
    expect(documentSignature(Buffer.from("89504e470d0a1a0a", "hex"), "image/png")).toBe(true);
    expect(documentSignature(Buffer.from([255, 216, 255]), "image/jpeg")).toBe(true);
    expect(documentSignature(Buffer.from("RIFF1234WEBP"), "image/webp")).toBe(true);
    expect(documentSignature(Buffer.from("not a picture"), "image/png")).toBe(false);
    expect(safeDocumentName("../\\folder\\\u0000exame.pdf")).toBe("exame.pdf");
    expect(safeDocumentName("\u0000")).toBe("Documento");
    expect((await upload(crypto.randomUUID(), crypto.randomUUID(), pdf, "image/png")).statusCode).toBe(415);
    expect((await upload(crypto.randomUUID(), crypto.randomUUID(), pdf, "text/html")).statusCode).toBe(415);
    expect((await upload(crypto.randomUUID(), crypto.randomUUID(), Buffer.alloc(0))).statusCode).toBe(415);
    const large = Buffer.alloc(6 * 1024 * 1024);
    pdf.copy(large);
    expect((await upload(crypto.randomUUID(), crypto.randomUUID(), large)).statusCode).toBe(201);
    const tooLarge = Buffer.alloc(10 * 1024 * 1024 + 1);
    pdf.copy(tooLarge);
    expect((await upload(crypto.randomUUID(), crypto.randomUUID(), tooLarge)).statusCode).toBe(413);
});
test("metadata sync paginates revisions and deletes/replays never resurrect documents", async () => {
    const id = crypto.randomUUID(), key = crypto.randomUUID(), created = await upload(id, key);
    const mutation = crypto.randomUUID();
    expect((await app.inject({ method: "DELETE", url: `/v1/documents/${id}`, headers: { ...headers(), "idempotency-key": mutation } })).statusCode).toBe(204);
    const before = await prisma.medicalDocument.findUniqueOrThrow({ where: { id } });
    await app.inject({ method: "DELETE", url: `/v1/documents/${id}`, headers: { ...headers(), "idempotency-key": mutation } });
    expect((await prisma.medicalDocument.findUniqueOrThrow({ where: { id } })).updatedAt).toEqual(before.updatedAt);
    expect((await upload(id, key)).json().data.deletedAt).not.toBeNull();
    expect((await app.inject({ url: `/v1/documents/${id}/file`, headers: headers() })).statusCode).toBe(404);
    const page = (await app.inject({ url: "/v1/documents/sync?cursor=" + created.json().data.revision, headers: headers() })).json().data;
    expect(page.records.some((r: {
        id: string;
        deletedAt: string;
    }) => r.id === id && r.deletedAt)).toBe(true);
    const first = (await app.inject({ url: "/v1/documents/sync?limit=1", headers: headers() })).json().data;
    expect(first.records).toHaveLength(1);
    expect(first.hasMore).toBe(true);
    expect((await app.inject({ url: "/v1/documents/sync?cursor=invalid", headers: headers() })).statusCode).toBe(400);
});
test("cross-operation idempotency keys and metadata listing cursors are validated", async () => {
    const id = crypto.randomUUID(), mutation = crypto.randomUUID();
    await upload(id, mutation);
    expect((await upload(crypto.randomUUID(), mutation)).statusCode).toBe(409);
    expect((await app.inject({ method: "DELETE", url: `/v1/documents/${id}`, headers: { ...headers(), "idempotency-key": mutation } })).statusCode).toBe(409);
    const list = (await app.inject({ url: "/v1/documents?limit=1", headers: headers() })).json().data;
    expect(list.records).toHaveLength(1);
    expect(list.nextCursor).not.toBeNull();
    const next = (await app.inject({ url: `/v1/documents?limit=1&before=${encodeURIComponent(list.nextCursor.before)}&id=${list.nextCursor.id}`, headers: headers() })).json().data;
    expect(next.records[0]?.id).not.toBe(list.records[0].id);
});
test("step tombstones are idempotent and legacy clients receive zero; explicit later writes restore", async () => {
    const mutation = { mutationId: crypto.randomUUID(), entity: "steps", action: "delete", profileId: users[0]!.id, payload: { date: "2020-01-01" }, clientUpdatedAt: new Date().toISOString() };
    const push = () => app.inject({ method: "POST", url: "/v1/sync", headers: headers(), payload: { mutations: [mutation] } });
    expect((await push()).json().data[0].status).toBe("applied");
    const before = await prisma.dailySteps.findUniqueOrThrow({ where: { profileId_date: { profileId: users[0]!.id, date: new Date("2020-01-01") } } });
    await push();
    expect((await prisma.dailySteps.findUniqueOrThrow({ where: { id: before.id } })).updatedAt).toEqual(before.updatedAt);
    const pull = (await app.inject({ url: "/v1/sync", headers: headers() })).json().data;
    expect(pull.steps.find((r: {
        date: string;
    }) => r.date === "2020-01-01")).toMatchObject({ steps: 0, deletedAt: expect.any(String) });
    expect(pull.documentsVersion).toBe(1);
    const update = await app.inject({ method: "POST", url: "/v1/sync", headers: headers(), payload: { mutations: [{ ...mutation, mutationId: crypto.randomUUID(), action: "upsert", payload: { date: "2020-01-01", steps: 12 } }] } });
    expect(update.json().data[0].status).toBe("applied");
    expect((await prisma.dailySteps.findUniqueOrThrow({ where: { id: before.id } })).deletedAt).toBeNull();
});
test("report metrics use canonical units, rolling week/calendar month and profile ownership", async () => {
    await prisma.waterEntry.create({ data: { id: crypto.randomUUID(), userId: users[0]!.id, profileId: users[0]!.id, date: new Date("2026-11-08"), time: "12:00", amountMl: 2500 } });
    const report = await app.inject({ url: "/v1/reports/metrics?period=month&date=2026-11-08", headers: headers() });
    expect(report.statusCode).toBe(200);
    expect(report.json().data.days).toHaveLength(30);
    expect(report.json().data.totals.waterMl).toBe(2500);
    expect(report.json().data.expenditure).toBe("registered-activities");
    expect((await app.inject({ url: "/v1/reports/metrics?period=day&date=2026-11-08", headers: headers(0, secondary) })).json().data.totals.waterMl).toBe(0);
    expect((await app.inject({ url: "/v1/reports/metrics?period=day&date=2026-11-08", headers: headers(1, users[0]!.id) })).statusCode).toBe(404);
    expect((await app.inject({ url: "/v1/reports/metrics?period=day&date=invalid", headers: headers() })).statusCode).toBe(400);
});

test("multipart display name survives a private UUID filename and remains safe", async () => {
 const boundary="qa-"+crypto.randomUUID(),name="exame cardíaco QA.pdf";
 const bytes=Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="name"\r\n\r\n../${name}\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="private-uuid.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),pdf,Buffer.from(`\r\n--${boundary}--\r\n`)]);
 const response=await app.inject({method:"POST",url:"/v1/documents",headers:{...headers(),"content-type":`multipart/form-data; boundary=${boundary}`,"x-document-id":crypto.randomUUID(),"idempotency-key":crypto.randomUUID()},payload:bytes});
 expect(response.statusCode,response.body).toBe(201);expect(response.json().data.name).toBe(name);
});

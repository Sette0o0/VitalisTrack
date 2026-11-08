import { writeFile } from "node:fs/promises";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
process.env.NODE_ENV = "test";
const app = await buildApp();
await app.ready();
let userId = "";
try {
	const account = await app.inject({
		method: "POST",
		url: "/v1/auth/register",
		payload: {
			name: "Carga Sprint 2",
			email: `s2-load-${crypto.randomUUID()}@example.com`,
			password: "qa-12345678",
			passwordConfirmation: "qa-12345678",
		},
	});
	if (account.statusCode !== 201) throw new Error("Cadastro de QA falhou");
	const data = account.json().data;
	userId = data.profile.id;
	const token = data.tokens.accessToken;
	const secondary = crypto.randomUUID(),
		headers = { authorization: `Bearer ${token}` };
	const profile = await app.inject({
		method: "POST",
		url: "/v1/profiles",
		headers,
		payload: { id: secondary, name: "Perfil de carga" },
	});
	if (profile.statusCode !== 201) throw new Error("Criação de perfil de QA falhou");
	const mutations = Array.from({ length: 900 }, (_, index) => ({
		mutationId: crypto.randomUUID(),
		profileId: index % 2 ? secondary : userId,
		entity: "water",
		action: "upsert",
		clientUpdatedAt: new Date().toISOString(),
		payload: { id: crypto.randomUUID(), amountMl: 200, date: "2026-10-26", time: "12:00" },
	}));
	const work = [...mutations, ...mutations.slice(0, 100)];
	const started = performance.now();
	const results = await Promise.all(
		work.map(async (mutation) => {
			const t = performance.now();
			try {
				const reply = await app.inject({
					method: "POST",
					url: "/v1/sync",
					headers,
					payload: { mutations: [mutation] },
				});
				return {
					ok: reply.statusCode === 200 && reply.json().data[0]?.status === "applied",
					ms: performance.now() - t,
				};
			} catch {
				return { ok: false, ms: performance.now() - t };
			}
		}),
	);
	const snapshots = await Promise.all(
		[userId, secondary].map(
			async (id) =>
				(await app.inject({ url: "/v1/sync", headers: { ...headers, "x-profile-id": id } })).json()
					.data.water,
		),
	);
	const durations = results.map((x) => x.ms).sort((a, b) => a - b);
	const report = {
		at: new Date().toISOString(),
		operations: 1000,
		failures: results.filter((x) => !x.ok).length,
		uniqueRecords: await prisma.waterEntry.count({ where: { userId } }),
		processedMutations: await prisma.processedMutation.count({ where: { userId } }),
		profileCounts: snapshots.map((rows) => rows.length),
		isolated: snapshots.every((rows, index) =>
			rows.every(
				(row: { id: string }) =>
					mutations.find((m) => m.payload.id === row.id)?.profileId === [userId, secondary][index],
			),
		),
		totalMs: Math.round(performance.now() - started),
		p95Ms: Math.round(durations[Math.floor(durations.length * 0.95)]!),
	};
	const json = JSON.stringify(report, null, 2);
	console.log(json);
	if (process.env.QA_REPORT) await writeFile(process.env.QA_REPORT, json + "\n");
	if (
		report.failures >= 10 ||
		report.uniqueRecords !== 900 ||
		report.processedMutations !== 900 ||
		!report.isolated
	)
		process.exitCode = 1;
} finally {
	if (userId) await prisma.user.delete({ where: { id: userId } });
	await app.close();
	await prisma.$disconnect();
}

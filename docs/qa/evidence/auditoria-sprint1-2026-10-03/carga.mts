import { mkdir, writeFile } from "node:fs/promises";
import { buildApp } from "../../../../server/src/app.js";
import { prisma } from "../../../../server/src/lib/prisma.js";
if (
	process.env.NODE_ENV !== "test" ||
	!/\/vitalis_qa(?:\?|$)/.test(process.env.DATABASE_URL ?? "")
)
	throw new Error("Use exclusivamente NODE_ENV=test e banco vitalis_qa.");
const app = await buildApp();
await app.ready();
let userId = "";
try {
	const response = await app.inject({
		method: "POST",
		url: "/v1/auth/register",
		payload: {
			name: "Benchmark QA",
			email: `qa-${crypto.randomUUID()}@example.com`,
			password: "qa-12345678",
			passwordConfirmation: "qa-12345678",
		},
	});
	if (response.statusCode !== 201) throw new Error(response.body);
	const account = response.json().data;
	userId = account.profile.id;
	const headers = { authorization: `Bearer ${account.tokens.accessToken}` };
	const operations = Array.from({ length: 900 }, () => ({
		mutationId: crypto.randomUUID(),
		entity: "water",
		action: "upsert",
		clientUpdatedAt: new Date().toISOString(),
		payload: {
			id: crypto.randomUUID(),
			amountMl: 200,
			date: "2026-10-03",
			time: "12:00",
		},
	}));
	const requests = [...operations, ...operations.slice(0, 100)];
	const started = performance.now();
	const samples = await Promise.all(
		requests.map(async (mutation) => {
			const begin = performance.now();
			try {
				const result = await app.inject({
					method: "POST",
					url: "/v1/sync",
					headers,
					payload: { mutations: [mutation] },
				});
				return {
					durationMs: performance.now() - begin,
					ok:
						result.statusCode === 200 &&
						result.json().data[0]?.status === "applied",
					message: result.json().data?.[0]?.message,
				};
			} catch (cause) {
				return {
					durationMs: performance.now() - begin,
					ok: false,
					message: cause instanceof Error ? cause.message : "Error",
				};
			}
		}),
	);
	const durations = samples.map((x) => x.durationMs).sort((a, b) => a - b),
		failures = samples.filter((x) => !x.ok);
	const totalMs = Math.round(performance.now() - started);
	await prisma.activity.createMany({
		data: Array.from({ length: 1000 }, (_, i) => ({
			id: crypto.randomUUID(),
			userId,
			type: i % 2 ? "run" : "walk",
			date: new Date("2026-10-03T00:00:00Z"),
			durationSeconds: 60,
			distanceMeters: 100,
			calories: 10,
		})),
	});
	const listStarted = performance.now(),
		list = await app.inject({
			method: "GET",
			url: "/v1/activities?limit=100&sort=date",
			headers,
		});
	const listMs = Math.round(performance.now() - listStarted);
	const searchStarted = performance.now();
	const search = await app.inject({
		method: "GET",
		url: "/v1/activities?limit=100&date=2026-10-03&type=run&sort=type",
		headers,
	});
	const searchMs = Math.round(performance.now() - searchStarted);
	const report = {
		createdAt: new Date().toISOString(),
		environment: "Fastify inject + PostgreSQL local, sem rede 4G e sem APK",
		operations: 1000,
		concurrency: 1000,
		uniqueMutations: 900,
		failures: failures.length,
		failurePercent: failures.length / 10,
		p95Ms: Math.round(durations[949] ?? 0),
		maxMs: Math.round(durations.at(-1) ?? 0),
		totalMs,
		recordsAfterRetries: await prisma.waterEntry.count({ where: { userId } }),
		failureExamples: failures.slice(0, 5),
		activities: {
			seeded: 1000,
			returned: list.json().data?.length,
			status: list.statusCode,
			listMs,
			searchMs,
			searchStatus: search.statusCode,
			searchReturned: search.json().data?.length,
			searchMatches: search
				.json()
				.data?.every(
					(row: { type: string; date: string }) =>
						row.type === "run" && row.date === "2026-10-03",
				),
		},
		limits: {
			failureRatePassed: failures.length < 10,
			allResponsesUnder2Seconds: (durations.at(-1) ?? 0) <= 2000,
			androidStartup: "pendente",
			androidMemory: "pendente",
		},
	};
	await mkdir("../docs/qa/evidence", { recursive: true });
	await writeFile(
		"../docs/qa/evidence/auditoria-sprint1-2026-10-03/server-load.json",
		JSON.stringify(report, null, 2) + "\n",
	);
	console.log(JSON.stringify(report, null, 2));
} finally {
	if (userId) await prisma.user.delete({ where: { id: userId } });
	await app.close();
	await prisma.$disconnect();
}

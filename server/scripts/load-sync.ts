export {};

const baseUrl = process.env.API_URL ?? "http://localhost:3000";
const email = process.env.LOAD_EMAIL ?? "ana@email.com";
const password = process.env.LOAD_PASSWORD ?? "12345678";
const login = await fetch(`${baseUrl}/v1/auth/login`, {
	method: "POST",
	headers: { "content-type": "application/json" },
	body: JSON.stringify({ email, password }),
});
if (!login.ok) throw new Error(`Login falhou: ${login.status}`);
const { data } = (await login.json()) as {
	data: { tokens: { accessToken: string } };
};
const started = performance.now();
const requests = Array.from({ length: 1000 }, (_, index) =>
	fetch(`${baseUrl}/v1/sync`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			authorization: `Bearer ${data.tokens.accessToken}`,
		},
		body: JSON.stringify({
			mutations: [
				{
					mutationId: crypto.randomUUID(),
					entity: "water",
					action: "upsert",
					clientUpdatedAt: new Date().toISOString(),
					payload: {
						id: crypto.randomUUID(),
						amountMl: 200,
						date: new Date().toISOString().slice(0, 10),
						time: "12:00",
					},
				},
			],
		}),
	})
		.then((response) => ({
			ok: response.ok,
			duration: performance.now() - started,
			index,
		}))
		.catch(() => ({ ok: false, duration: performance.now() - started, index })),
);
const results = await Promise.all(requests);
const durations = results.map((x) => x.duration).sort((a, b) => a - b);
const failures = results.filter((x) => !x.ok).length;
const p95 = durations[Math.floor(durations.length * 0.95)] ?? 0;
console.log(
	JSON.stringify(
		{ operations: 1000, failures, p95Ms: Math.round(p95) },
		null,
		2,
	),
);
if (failures >= 10 || p95 >= 2000) process.exitCode = 1;

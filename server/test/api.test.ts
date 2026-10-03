import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

const app = await buildApp();
const email = `teste-${Date.now()}@example.com`;
let accessToken = "",
	refreshToken = "",
	userId = "";
const extraUsers: string[] = [];
const auth = () => ({ authorization: `Bearer ${accessToken}` });

beforeAll(async () => {
	await app.ready();
});

afterAll(async () => {
	for (const id of extraUsers)
		await prisma.user.delete({ where: { id } }).catch(() => undefined);
	if (userId)
		await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
	await app.close();
});

describe("API da Sprint 1", () => {
	test("expõe health check", async () => {
		expect(
			(await app.inject({ method: "GET", url: "/health" })).statusCode,
		).toBe(200);
	});
	test("cadastra, autentica e protege recursos", async () => {
		const response = await app.inject({
			method: "POST",
			url: "/v1/auth/register",
			payload: {
				name: "Pessoa Teste",
				email,
				password: "12345678",
				passwordConfirmation: "12345678",
			},
		});
		expect(response.statusCode).toBe(201);
		const body = response.json().data;
		accessToken = body.tokens.accessToken;
		refreshToken = body.tokens.refreshToken;
		userId = body.profile.id;
		expect(
			(await app.inject({ method: "GET", url: "/v1/profile" })).statusCode,
		).toBe(401);
		expect(
			(await app.inject({ method: "GET", url: "/v1/profile", headers: auth() }))
				.statusCode,
		).toBe(200);
	});
	test("registra água e atualiza o resumo", async () => {
		const id = crypto.randomUUID();
		expect(
			(
				await app.inject({
					method: "POST",
					url: "/v1/water",
					headers: auth(),
					payload: {
						id,
						amountMl: 500,
						date: "2026-09-20",
						time: "08:00",
					},
				})
			).statusCode,
		).toBe(201);
		const dashboard = await app.inject({
			method: "GET",
			url: "/v1/dashboard/daily?date=2026-09-20",
			headers: auth(),
		});
		expect(dashboard.json().data.water).toBe(500);
	});
	test("reaplica mutação offline sem duplicar", async () => {
		const mutation = {
			mutationId: crypto.randomUUID(),
			entity: "meal",
			action: "upsert",
			clientUpdatedAt: new Date().toISOString(),
			payload: {
				id: crypto.randomUUID(),
				name: "Almoço",
				date: "2026-09-20",
				time: "12:00",
				quantity: 300,
				unit: "g",
				calories: 450,
			},
		};
		const first = await app.inject({
			method: "POST",
			url: "/v1/sync",
			headers: auth(),
			payload: { mutations: [mutation] },
		});
		const second = await app.inject({
			method: "POST",
			url: "/v1/sync",
			headers: auth(),
			payload: { mutations: [mutation] },
		});
		expect(first.json().data[0].status).toBe("applied");
		expect(second.json().data[0].status).toBe("applied");
		const rows = await app.inject({
			method: "GET",
			url: "/v1/meals?date=2026-09-20",
			headers: auth(),
		});
		expect(rows.json().data).toHaveLength(1);
	});
	test("rotaciona refresh token e detecta reutilização", async () => {
		const rotated = await app.inject({
			method: "POST",
			url: "/v1/auth/refresh",
			payload: { refreshToken },
		});
		expect(rotated.statusCode).toBe(200);
		const replay = await app.inject({
			method: "POST",
			url: "/v1/auth/refresh",
			payload: { refreshToken },
		});
		expect(replay.statusCode).toBe(401);
		expect(replay.json().error.code).toBe("REFRESH_TOKEN_REUSED");
	});
	test("sincronização concorrente aplica uma única mutação", async () => {
		const mutation = {
			mutationId: crypto.randomUUID(),
			entity: "meal",
			action: "upsert",
			clientUpdatedAt: new Date().toISOString(),
			payload: {
				id: crypto.randomUUID(),
				name: "Concorrente",
				date: "2026-09-20",
				time: "13:00",
				quantity: 100,
				unit: "g",
				calories: 200,
			},
		};
		const results = await Promise.all(
			Array.from({ length: 4 }, () =>
				app.inject({
					method: "POST",
					url: "/v1/sync",
					headers: auth(),
					payload: { mutations: [mutation] },
				}),
			),
		);
		for (const result of results)
			expect(result.json().data[0].status).toBe("applied");
		expect(
			await prisma.processedMutation.count({
				where: { userId, mutationId: mutation.mutationId },
			}),
		).toBe(1);
	});
	test("outra conta não pode sobrescrever uma refeição pelo sync", async () => {
		const owned = await prisma.meal.findFirstOrThrow({ where: { userId } });
		const registered = await app.inject({
			method: "POST",
			url: "/v1/auth/register",
			payload: {
				name: "Outra Pessoa",
				email: `outra-${crypto.randomUUID()}@example.com`,
				password: "12345678",
				passwordConfirmation: "12345678",
			},
		});
		const other = registered.json().data;
		extraUsers.push(other.profile.id);
		const result = await app.inject({
			method: "POST",
			url: "/v1/sync",
			headers: { authorization: `Bearer ${other.tokens.accessToken}` },
			payload: {
				mutations: [
					{
						mutationId: crypto.randomUUID(),
						entity: "meal",
						action: "upsert",
						clientUpdatedAt: new Date().toISOString(),
						payload: {
							id: owned.id,
							name: "Invadida",
							date: "2026-09-20",
							time: "12:00",
							quantity: 100,
							unit: "g",
							calories: 999,
						},
					},
				],
			},
		});
		expect(result.json().data[0].status).toBe("failed");
		expect(
			(await prisma.meal.findUniqueOrThrow({ where: { id: owned.id } })).name,
		).toBe(owned.name);
	});
	test("validação rejeita data inexistente e quantidade inválida", async () => {
		const result = await app.inject({
			method: "POST",
			url: "/v1/meals",
			headers: auth(),
			payload: {
				id: crypto.randomUUID(),
				name: "Teste",
				date: "2026-02-30",
				time: "25:60",
				quantity: -1,
				unit: "g",
				calories: 100,
			},
		});
		expect(result.statusCode).toBe(400);
	});
});

test("login valida e-mail e senha e emite JWT para credenciais válidas", async () => {
	for (const [credentials, status] of [
		[{ email: "inválido", password: "12345678" }, 400],
		[{ email, password: "senha-errada" }, 401],
	] as const)
		expect(
			(
				await app.inject({
					method: "POST",
					url: "/v1/auth/login",
					payload: credentials,
				})
			).statusCode,
		).toBe(status);
	const result = await app.inject({
		method: "POST",
		url: "/v1/auth/login",
		payload: { email, password: "12345678" },
	});
	expect(result.statusCode).toBe(200);
	expect(
		app.jwt.verify<{ sub: string }>(result.json().data.tokens.accessToken).sub,
	).toBe(userId);
});

test("edição, exclusão e meta de água recalculam o resumo", async () => {
	const headers = auth(),
		id = crypto.randomUUID(),
		date = "2026-10-03";
	expect(
		(
			await app.inject({
				method: "POST",
				url: "/v1/water",
				headers,
				payload: { id, amountMl: 200, date, time: "10:00" },
			})
		).statusCode,
	).toBe(201);
	expect(
		(
			await app.inject({
				method: "PATCH",
				url: `/v1/water/${id}`,
				headers,
				payload: { amountMl: 500 },
			})
		).statusCode,
	).toBe(200);
	expect(
		(
			await app.inject({
				method: "GET",
				url: `/v1/dashboard/daily?date=${date}`,
				headers,
			})
		).json().data.water,
	).toBe(500);
	expect(
		(
			await app.inject({
				method: "GET",
				url: `/v1/water?date=${date}`,
				headers,
			})
		).json().data[0].amountMl,
	).toBe(500);
	expect(
		(
			await app.inject({
				method: "PATCH",
				url: "/v1/goals",
				headers,
				payload: { waterMl: 0 },
			})
		).statusCode,
	).toBe(400);
	expect(
		(
			await app.inject({
				method: "PATCH",
				url: "/v1/goals",
				headers,
				payload: { waterMl: 2000 },
			})
		).statusCode,
	).toBe(200);
	expect(
		(await app.inject({ method: "GET", url: "/v1/goals", headers })).json().data
			.waterMl,
	).toBe(2000);
	expect(
		(await app.inject({ method: "DELETE", url: `/v1/water/${id}`, headers }))
			.statusCode,
	).toBe(204);
	expect(
		(
			await app.inject({
				method: "GET",
				url: `/v1/dashboard/daily?date=${date}`,
				headers,
			})
		).json().data.water,
	).toBe(0);
});

test("falha no meio da mutação reverte registro e marcador de idempotência", async () => {
	const registered = await app.inject({
		method: "POST",
		url: "/v1/auth/register",
		payload: {
			name: "Rollback QA",
			email: `rollback-${crypto.randomUUID()}@example.com`,
			password: "12345678",
			passwordConfirmation: "12345678",
		},
	});
	expect(registered.statusCode).toBe(201);
	const account = registered.json().data,
		owner = account.profile.id;
	extraUsers.push(owner);
	// A ausência do perfil provoca uma falha real após o upsert do peso dentro da transação.
	await prisma.profile.delete({ where: { userId: owner } });
	const mutation = {
		mutationId: crypto.randomUUID(),
		entity: "weight",
		action: "upsert",
		clientUpdatedAt: new Date().toISOString(),
		payload: { id: crypto.randomUUID(), date: "2026-10-03", weightKg: 70 },
	};
	const response = await app.inject({
		method: "POST",
		url: "/v1/sync",
		headers: { authorization: `Bearer ${account.tokens.accessToken}` },
		payload: { mutations: [mutation] },
	});
	expect(response.json().data[0].status).toBe("failed");
	expect(await prisma.weightEntry.count({ where: { userId: owner } })).toBe(0);
	expect(
		await prisma.processedMutation.count({ where: { userId: owner } }),
	).toBe(0);
});

test("CRUD de refeições, atividades, peso e metas atualiza os agregados", async () => {
	const headers = auth(),
		date = "2026-10-03";
	expect(
		(
			await app.inject({
				method: "PATCH",
				url: "/v1/profile",
				headers,
				payload: {
					name: "Pessoa Teste",
					birthDate: "2000-10-03",
					weightKg: 70,
					heightCm: 175,
					gender: "Outro",
				},
			})
		).statusCode,
	).toBe(200);
	expect(
		(
			await app.inject({
				method: "PATCH",
				url: "/v1/goals",
				headers,
				payload: {
					waterMl: 3000,
					calories: 2200,
					steps: 10000,
					weightKg: 65,
					dailyDeficit: 500,
				},
			})
		).statusCode,
	).toBe(200);
	const activity = {
		id: crypto.randomUUID(),
		type: "run",
		date,
		durationSeconds: 15,
		distanceMeters: 123.4,
		route: [],
	};
	expect(
		(
			await app.inject({
				method: "POST",
				url: "/v1/activities",
				headers,
				payload: activity,
			})
		).statusCode,
	).toBe(201);
	const stats = await app.inject({
		method: "GET",
		url: `/v1/activities/stats?period=month&date=${date}`,
		headers,
	});
	expect(stats.json().data.durationSeconds).toBe(15);
	const progress = await app.inject({
		method: "GET",
		url: `/v1/progress?period=month&date=${date}`,
		headers,
	});
	expect(progress.json().data.activityMinutes).toBe(0.25);
	expect(progress.json().data.windowDays).toBe(30);
	expect(
		(
			await app.inject({
				method: "PATCH",
				url: `/v1/activities/${activity.id}`,
				headers,
				payload: { durationSeconds: 30 },
			})
		).statusCode,
	).toBe(200);
	expect(
		(
			await app.inject({
				method: "DELETE",
				url: `/v1/activities/${activity.id}`,
				headers,
			})
		).statusCode,
	).toBe(204);
	const weight = { id: crypto.randomUUID(), date, weightKg: 69.5 };
	expect(
		(
			await app.inject({
				method: "POST",
				url: "/v1/weights",
				headers,
				payload: weight,
			})
		).statusCode,
	).toBe(201);
	expect(
		(
			await app.inject({
				method: "GET",
				url: `/v1/weights/comparison?date=${date}`,
				headers,
			})
		).json().data.currentWeek,
	).toContainEqual({ date, weightKg: 69.5 });
	const meal = {
		id: crypto.randomUUID(),
		name: "Café",
		date,
		time: "08:00",
		quantity: 100.5,
		unit: "mL",
		calories: 80,
	};
	expect(
		(
			await app.inject({
				method: "POST",
				url: "/v1/meals",
				headers,
				payload: meal,
			})
		).statusCode,
	).toBe(201);
	expect(
		(
			await app.inject({
				method: "PATCH",
				url: `/v1/meals/${meal.id}`,
				headers,
				payload: { calories: 100 },
			})
		).statusCode,
	).toBe(200);
	expect(
		(
			await app.inject({
				method: "GET",
				url: `/v1/dashboard/daily?date=${date}`,
				headers,
			})
		).json().data.calories,
	).toBe(100);
	expect(
		(
			await app.inject({
				method: "DELETE",
				url: `/v1/meals/${meal.id}`,
				headers,
			})
		).statusCode,
	).toBe(204);
	const pull = (
		await app.inject({ method: "GET", url: "/v1/sync", headers })
	).json().data;
	expect(
		pull.meals.find((x: { id: string }) => x.id === meal.id).deletedAt,
	).toBeTruthy();
	expect(pull.profile.name).toBe("Pessoa Teste");
});

import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

const app = await buildApp();
const email = `teste-${Date.now()}@example.com`;
let accessToken = "",
	refreshToken = "",
	userId = "";
const auth = () => ({ authorization: `Bearer ${accessToken}` });

beforeAll(async () => {
	await app.ready();
});
afterAll(async () => {
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
});

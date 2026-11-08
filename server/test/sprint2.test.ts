import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { normalizeFood } from "../src/lib/food-provider.js";
const app = await buildApp();
let owner = "",
	other = "",
	token = "",
	second = "";
const headers = (profileId?: string) => ({
	authorization: `Bearer ${token}`,
	...(profileId ? { "x-profile-id": profileId } : {}),
});
const mutation = (entity: string, payload: object, profileId?: string) => ({
	mutationId: crypto.randomUUID(),
	entity,
	action: "upsert",
	payload,
	profileId,
	clientUpdatedAt: "2000-01-01T00:00:00Z",
});
const push = async (m: object) =>
	app.inject({ method: "POST", url: "/v1/sync", headers: headers(), payload: { mutations: [m] } });
beforeAll(async () => {
	await app.ready();
	for (const index of [0, 1]) {
		const reply = await app.inject({
			method: "POST",
			url: "/v1/auth/register",
			payload: {
				name: "QA Sprint 2",
				email: `s2-${crypto.randomUUID()}@example.com`,
				password: "qa-12345678",
				passwordConfirmation: "qa-12345678",
			},
		});
		expect(reply.statusCode).toBe(201);
		if (!index) {
			owner = reply.json().data.profile.id;
			token = reply.json().data.tokens.accessToken;
		} else other = reply.json().data.profile.id;
	}
	second = crypto.randomUUID();
});
afterAll(async () => {
	vi.unstubAllGlobals();
	for (const id of [owner, other]) if (id) await prisma.user.delete({ where: { id } });
	await prisma.foodCache.deleteMany({ where: { key: { startsWith: "off:product:00000000" } } });
	await app.close();
});
test("creates secondary profile idempotently with empty measurements and default goals", async () => {
	const p = mutation("healthProfile", { id: second, name: "Familiar" }, second);
	expect((await push(p)).json().data[0].status).toBe("applied");
	expect((await push(p)).json().data[0].status).toBe("applied");
	const list = await app.inject({ url: "/v1/profiles", headers: headers() });
	expect(list.json().data).toHaveLength(2);
	const profile = await app.inject({ url: "/v1/profile", headers: headers(second) });
	expect(profile.json().data).toMatchObject({
		id: owner,
		profileId: second,
		name: "Familiar",
		weightKg: null,
		heightCm: null,
	});
	expect(
		(await app.inject({ url: "/v1/goals", headers: headers(second) })).json().data.waterMl,
	).toBe(2500);
});
test("REST, aggregate and sync isolation, including cross-profile UUID and replay attacks", async () => {
	const id = crypto.randomUUID();
	const m = mutation("water", { id, amountMl: 250, date: "2026-10-26", time: "12:00" }, second);
	expect((await push(m)).json().data[0].status).toBe("applied");
	expect((await app.inject({ url: "/v1/water", headers: headers() })).json().data).toHaveLength(0);
	expect(
		(await app.inject({ url: "/v1/water", headers: headers(second) })).json().data,
	).toHaveLength(1);
	expect(
		(
			await app.inject({ url: "/v1/dashboard/daily?date=2026-10-26", headers: headers(second) })
		).json().data.water,
	).toBe(250);
	for (const url of [
		"/v1/profile",
		"/v1/goals",
		"/v1/water",
		"/v1/meals",
		"/v1/activities",
		"/v1/weights",
		"/v1/sync",
		"/v1/nutrition-profile",
		"/v1/recipes",
	]) {
		expect((await app.inject({ url, headers: headers(other) })).statusCode).toBe(404);
	}
	expect((await push({ ...m, profileId: owner })).json().data[0].status).toBe("failed");
	expect((await push(mutation("water", m.payload, owner))).json().data[0].status).toBe("failed");
	expect(
		(await app.inject({ method: "DELETE", url: `/v1/water/${id}`, headers: headers() })).statusCode,
	).toBe(404);
});
test("last server write wins; replay and client timestamps cannot overwrite it", async () => {
	const id = crypto.randomUUID(),
		first = mutation(
			"meal",
			{
				id,
				name: "Primeiro",
				date: "2026-10-26",
				time: "12:00",
				quantity: 100,
				unit: "g",
				calories: 200,
			},
			second,
		);
	await push(first);
	await push({
		...mutation("meal", { ...first.payload, name: "Segundo" }, second),
		clientUpdatedAt: "1990-01-01T00:00:00Z",
	});
	await push(first);
	const pull = (await app.inject({ url: "/v1/sync", headers: headers(second) })).json().data;
	expect(pull.meals.find((x: { id: string }) => x.id === id).name).toBe("Segundo");
	const deletion = {
		mutationId: crypto.randomUUID(),
		entity: "meal",
		action: "delete",
		entityId: id,
		profileId: second,
		clientUpdatedAt: new Date().toISOString(),
	};
	await push(deletion);
	await push(deletion);
	const after = (
		await app.inject({
			url: `/v1/sync?cursor=${encodeURIComponent(pull.cursor)}`,
			headers: headers(second),
		})
	).json().data;
	expect(after.meals.find((x: { id: string }) => x.id === id).deletedAt).toBeTruthy();
	expect(
		(await app.inject({ url: "/v1/meals", headers: headers(second) })).json().data,
	).toHaveLength(0);
});
test("nutrition, units, recipe and nutrient snapshot persist and synchronize per profile", async () => {
	for (const [entity, payload] of [
		["preferences", { unitSystem: "imperial" }],
		["nutrition", { objective: "gain", restrictions: ["lactose"], preferences: ["arroz"] }],
		[
			"recipe",
			{
				id: crypto.randomUUID(),
				name: "Arroz",
				ingredients: "Arroz e água",
				instructions: "Cozinhar",
				nutrition: { calories: 200, proteins: null, carbohydrates: 40, fat: 1 },
			},
		],
	] as const) {
		expect((await push(mutation(entity, payload, second))).json().data[0].status).toBe("applied");
	}
	const nutrition = {
		source: "openfoodfacts",
		code: "12345678",
		basisUnit: "g",
		values: { calories: 100, proteins: 5, carbohydrates: null, fat: 2 },
	};
	expect(
		(
			await push(
				mutation(
					"meal",
					{
						id: crypto.randomUUID(),
						name: "Produto",
						date: "2026-10-26",
						time: "12:00",
						quantity: 50,
						unit: "g",
						calories: 100,
						nutrition,
					},
					second,
				),
			)
		).json().data[0].status,
	).toBe("applied");
	const pull = (await app.inject({ url: "/v1/sync", headers: headers(second) })).json().data;
	expect(pull.unitSystem).toBe("imperial");
	expect(pull.nutrition.objective).toBe("gain");
	expect(pull.recipes).toHaveLength(1);
	expect(pull.meals.find((m: { name: string }) => m.name === "Produto").nutrition).toEqual(
		nutrition,
	);
	expect((await app.inject({ url: "/v1/recipes", headers: headers() })).json().data).toHaveLength(
		0,
	);
	const recipe = pull.recipes[0];
	expect(
		(await app.inject({ url: `/v1/recipes/${recipe.id}`, headers: headers() })).statusCode,
	).toBe(404);
});
test("basal calculation requires real profile inputs and recomputes in metric units", async () => {
	expect(
		(await app.inject({ url: "/v1/goals/basal", headers: headers(second) })).json().data.calories,
	).toBeNull();
	await app.inject({
		method: "PATCH",
		url: "/v1/profile",
		headers: headers(second),
		payload: { birthDate: "1990-10-26", weightKg: 70, heightCm: 175, gender: "Masculino" },
	});
	const r = await app.inject({ url: "/v1/goals/basal", headers: headers(second) });
	expect(r.statusCode).toBe(200);
	expect(r.json().data.calories).toBeGreaterThan(1000);
});
test("food normalization preserves unknowns and API caches provider responses", async () => {
	expect(
		normalizeFood({
			code: "12345678",
			product_name: "Leite",
			quantity: "1 L",
			nutriments: { proteins_100g: 3 },
		}),
	).toMatchObject({
		basisUnit: "mL",
		values: { calories: null, proteins: 3, carbohydrates: null, fat: null },
	});
	expect(
		normalizeFood({ code: "12345678", product_name: "Teste", nutriments: {} })?.basisUnit,
	).toBeNull();
	const fake = vi.fn(
		async () =>
			new Response(
				JSON.stringify({
					product: {
						code: "00000000",
						product_name: "QA",
						quantity: "100 g",
						nutriments: { "energy-kcal_100g": 200 },
					},
				}),
				{ status: 200 },
			),
	);
	vi.stubGlobal("fetch", fake);
	for (let i = 0; i < 2; i++)
		expect(
			(await app.inject({ url: "/v1/foods/00000000", headers: headers() })).json().data.name,
		).toBe("QA");
	expect(fake).toHaveBeenCalledTimes(1);
	expect(fake.mock.calls[0]).toBeDefined();
	vi.unstubAllGlobals();
});

test("ignores malformed provider products without failing the whole search", () => {
	expect(normalizeFood({ code: "invalid", product_name: "Produto" })).toBeNull();
	expect(normalizeFood({ code: "12345678", product_name: "" })).toBeNull();
});

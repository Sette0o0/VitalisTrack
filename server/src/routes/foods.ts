import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { requireAuth } from "../lib/auth.js";
import { foods } from "../lib/food-provider.js";
export async function foodRoutes(raw: FastifyInstance) {
	const app = raw.withTypeProvider<ZodTypeProvider>();
	app.addHook("preHandler", requireAuth);
	app.get(
		"/",
		{ schema: { querystring: z.object({ q: z.string().trim().min(2).max(100) }) } },
		async (req) => ({ data: await foods("search", req.query.q) }),
	);
	app.get(
		"/:code",
		{ schema: { params: z.object({ code: z.string().regex(/^\d{8,14}$/) }) } },
		async (req) => ({ data: (await foods("product", req.params.code))[0] ?? null }),
	);
}

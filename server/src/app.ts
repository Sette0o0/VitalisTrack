import { join } from "node:path";
import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import {
	hasZodFastifySchemaValidationErrors,
	jsonSchemaTransform,
	serializerCompiler,
	validatorCompiler,
} from "fastify-type-provider-zod";
import { config } from "./config.js";
import { AppError } from "./lib/errors.js";
import { prisma } from "./lib/prisma.js";
import { authRoutes } from "./routes/auth.js";
import { profileRoutes } from "./routes/profile.js";
import { waterRoutes } from "./routes/water.js";
import { mealRoutes } from "./routes/meals.js";
import { activityRoutes } from "./routes/activities.js";
import { weightRoutes } from "./routes/weights.js";
import { aggregateRoutes } from "./routes/aggregates.js";
import { syncRoutes } from "./routes/sync.js";

export async function buildApp() {
	const app = Fastify({
		logger: config.NODE_ENV !== "test",
		requestIdHeader: "x-request-id",
	});
	app.setValidatorCompiler(validatorCompiler);
	app.setSerializerCompiler(serializerCompiler);
	await app.register(cors, {
		origin: config.CORS_ORIGIN === "*" ? true : config.CORS_ORIGIN.split(","),
	});
	await app.register(jwt, { secret: config.JWT_SECRET });
	await app.register(multipart, {
		limits: { fileSize: 5 * 1024 * 1024, files: 1 },
	});
	await app.register(fastifyStatic, {
		root: join(process.cwd(), "storage"),
		prefix: "/uploads/",
	});
	await app.register(swagger, {
		openapi: {
			info: { title: "VitalisTrack API", version: "1.0.0" },
			security: [{ bearerAuth: [] }],
			components: {
				securitySchemes: {
					bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
				},
			},
		},
		transform: jsonSchemaTransform,
	});
	await app.register(swaggerUi, { routePrefix: "/docs" });

	app.setNotFoundHandler((request, reply) =>
		reply.code(404).send({
			error: {
				code: "ROUTE_NOT_FOUND",
				message: "Rota não encontrada",
				requestId: request.id,
			},
		}),
	);
	app.setErrorHandler((error, request, reply) => {
		if (hasZodFastifySchemaValidationErrors(error))
			return reply.code(400).send({
				error: {
					code: "VALIDATION_ERROR",
					message: "Dados inválidos",
					details: error.validation,
					requestId: request.id,
				},
			});
		if (error instanceof AppError)
			return reply.code(error.statusCode).send({
				error: {
					code: error.code,
					message: error.message,
					details: error.details,
					requestId: request.id,
				},
			});
		if ((error as { code?: string }).code === "P2002")
			return reply.code(409).send({
				error: {
					code: "CONFLICT",
					message: "O registro já existe",
					requestId: request.id,
				},
			});
		request.log.error(error);
		return reply
			.code(500)
			.send({
				error: {
					code: "INTERNAL_ERROR",
					message: "Erro interno",
					requestId: request.id,
				},
			});
	});

	app.get("/health", async () => ({ data: { status: "ok" } }));
	app.get("/ready", async () => {
		await prisma.$queryRaw`SELECT 1`;
		return { data: { status: "ready" } };
	});
	await app.register(authRoutes, { prefix: "/v1/auth" });
	await app.register(profileRoutes, { prefix: "/v1" });
	await app.register(waterRoutes, { prefix: "/v1/water" });
	await app.register(mealRoutes, { prefix: "/v1/meals" });
	await app.register(activityRoutes, { prefix: "/v1/activities" });
	await app.register(weightRoutes, { prefix: "/v1" });
	await app.register(aggregateRoutes, { prefix: "/v1" });
	await app.register(syncRoutes, { prefix: "/v1/sync" });

	return app;
}

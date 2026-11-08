import "@fastify/jwt";

declare module "@fastify/jwt" {
	interface FastifyJWT {
		payload: { sub: string };
		user: { sub: string };
	}
}

declare module "fastify" {
	interface FastifyRequest {
		profileId: string;
	}
}

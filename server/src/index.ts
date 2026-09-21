import { buildApp } from "./app.js";
import { config } from "./config.js";
import { prisma } from "./lib/prisma.js";

const app = await buildApp();
const shutdown = async () => {
	await app.close();
	await prisma.$disconnect();
	process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
await app.listen({ host: config.HOST, port: config.PORT });

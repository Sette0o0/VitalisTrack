import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
	NODE_ENV: z
		.enum(["development", "test", "production"])
		.default("development"),
	DATABASE_URL: z.string().min(1),
	JWT_SECRET: z.string().min(32),
	PORT: z.coerce.number().int().positive().default(3000),
	HOST: z.string().default("0.0.0.0"),
	CORS_ORIGIN: z.string().default("*"),
	PUBLIC_BASE_URL: z.url().default("http://localhost:3000"),
});

export type AppConfig = z.infer<typeof envSchema>;
export const config = envSchema.parse(process.env);

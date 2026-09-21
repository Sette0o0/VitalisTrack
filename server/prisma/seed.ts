import "dotenv/config";
import argon2 from "argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });
const email = "ana@email.com";
const passwordHash = await argon2.hash("12345678", { type: argon2.argon2id });
await prisma.user.upsert({
	where: { email },
	update: {},
	create: {
		email,
		passwordHash,
		profile: {
			create: {
				name: "Ana Souza",
				birthDate: new Date("1997-04-18T00:00:00.000Z"),
				weightKg: 68.4,
				heightCm: 168,
				gender: "Feminino",
			},
		},
		goals: {
			create: {
				waterMl: 2500,
				calories: 2000,
				mealCalories: 700,
				steps: 10000,
				weightKg: 64,
				dailyDeficit: 400,
			},
		},
	},
});
await prisma.$disconnect();
console.log(`Usuário de desenvolvimento criado: ${email} / 12345678`);

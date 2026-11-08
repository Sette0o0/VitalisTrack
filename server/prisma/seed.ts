import "dotenv/config";
import argon2 from "argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });
const accountId = crypto.randomUUID();
const email = "rafael@email.com";
const passwordHash = await argon2.hash("12345678", { type: argon2.argon2id });
await prisma.user.upsert({
	where: { email },
	update: {},
	create: {
		id: accountId,
		email,
		passwordHash,
		profile: {
			create: {
				id: accountId,
				isPrimary: true,
				name: "Ana Souza",
				goals: { create: { userId: accountId, weightKg: 64 } },
				birthDate: new Date("1997-04-18T00:00:00.000Z"),
				weightKg: 68.4,
				heightCm: 168,
				gender: "Feminino",
			},
		},
	},
});
await prisma.$disconnect();
console.log(`Usuário de desenvolvimento criado: ${email} / 12345678`);

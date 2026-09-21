import { z } from "zod";

export const idSchema = z.uuid();
export const dateSchema = z.iso.date();
export const timeSchema = z
	.string()
	.regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm");
export const genderSchema = z.enum(["Feminino", "Masculino", "Outro"]);
export const activityTypeSchema = z.enum(["walk", "run", "cycling"]);
export const periodSchema = z.enum(["day", "week", "month"]);
export const entityTypeSchema = z.enum([
	"profile",
	"goals",
	"water",
	"meal",
	"activity",
	"weight",
	"steps",
]);
export const mutationActionSchema = z.enum(["upsert", "delete"]);

export const registerSchema = z
	.object({
		name: z.string().trim().min(2).max(100),
		email: z.email().transform((value) => value.trim().toLowerCase()),
		password: z.string().min(8).max(128),
		passwordConfirmation: z.string().min(8).max(128),
	})
	.refine((value) => value.password === value.passwordConfirmation, {
		path: ["passwordConfirmation"],
		message: "As senhas devem ser iguais",
	});

export const loginSchema = z.object({
	email: z.email().transform((value) => value.trim().toLowerCase()),
	password: z.string().min(1).max(128),
});
export const refreshSchema = z.object({ refreshToken: z.string().min(32) });

export const profileSchema = z.object({
	id: idSchema,
	name: z.string(),
	email: z.email(),
	birthDate: dateSchema.nullable(),
	weightKg: z.number().positive().nullable(),
	heightCm: z.number().positive().nullable(),
	gender: genderSchema.nullable(),
	avatarUrl: z.string().nullable(),
	age: z.number().int().nonnegative().nullable(),
	updatedAt: z.string(),
});
export const profileUpdateSchema = z
	.object({
		name: z.string().trim().min(2).max(100).optional(),
		birthDate: dateSchema.optional(),
		weightKg: z.number().min(20).max(500).optional(),
		heightCm: z.number().min(80).max(260).optional(),
		gender: genderSchema.optional(),
	})
	.strict();

export const goalsSchema = z.object({
	waterMl: z.number().int().positive(),
	calories: z.number().int().positive(),
	mealCalories: z.number().int().positive(),
	steps: z.number().int().positive(),
	weightKg: z.number().positive(),
	dailyDeficit: z.number().int().nonnegative(),
	updatedAt: z.string(),
});
export const goalsUpdateSchema = goalsSchema
	.omit({ updatedAt: true })
	.partial()
	.refine(
		(value) => Object.keys(value).length > 0,
		"Informe ao menos uma meta",
	);

const syncFields = {
	createdAt: z.string(),
	updatedAt: z.string(),
	deletedAt: z.string().nullable(),
};
export const waterEntrySchema = z.object({
	id: idSchema,
	amountMl: z.number().int().positive(),
	date: dateSchema,
	time: timeSchema,
	...syncFields,
});
export const waterInputSchema = waterEntrySchema.pick({
	id: true,
	amountMl: true,
	date: true,
	time: true,
});
export const waterUpdateSchema = waterInputSchema.omit({ id: true }).partial();

export const mealSchema = z.object({
	id: idSchema,
	name: z.string(),
	date: dateSchema,
	time: timeSchema,
	quantity: z.number().positive(),
	unit: z.enum(["g", "mL"]),
	calories: z.number().int().nonnegative(),
	...syncFields,
});
export const mealInputSchema = z.object({
	id: idSchema,
	name: z.string().trim().min(1).max(200),
	date: dateSchema,
	time: timeSchema,
	quantity: z.number().positive(),
	unit: z.enum(["g", "mL"]),
	calories: z.number().int().nonnegative(),
});
export const mealUpdateSchema = mealInputSchema.omit({ id: true }).partial();

export const routePointSchema = z.object({
	latitude: z.number().min(-90).max(90),
	longitude: z.number().min(-180).max(180),
	altitude: z.number().nullable().optional(),
	accuracy: z.number().nonnegative().nullable().optional(),
	timestamp: z.string(),
});
export const activitySchema = z.object({
	id: idSchema,
	type: activityTypeSchema,
	date: dateSchema,
	durationSeconds: z.number().int().positive(),
	distanceMeters: z.number().nonnegative(),
	calories: z.number().int().nonnegative(),
	paceSecondsPerKm: z.number().nonnegative().nullable(),
	route: z.array(routePointSchema),
	...syncFields,
});
export const activityInputSchema = z.object({
	id: idSchema,
	type: activityTypeSchema,
	date: dateSchema,
	durationSeconds: z.number().int().positive(),
	distanceMeters: z.number().nonnegative(),
	route: z.array(routePointSchema).max(10_000).default([]),
});
export const activityUpdateSchema = activityInputSchema
	.omit({ id: true })
	.partial();

export const weightEntrySchema = z.object({
	id: idSchema,
	date: dateSchema,
	weightKg: z.number().min(20).max(500),
	...syncFields,
});
export const weightInputSchema = weightEntrySchema.pick({
	id: true,
	date: true,
	weightKg: true,
});
export const weightUpdateSchema = weightInputSchema
	.omit({ id: true })
	.partial();
export const stepsInputSchema = z.object({
	steps: z.number().int().nonnegative(),
});

export const dateQuerySchema = z.object({ date: dateSchema.optional() });
export const listQuerySchema = z.object({
	date: dateSchema.optional(),
	cursor: idSchema.optional(),
	limit: z.coerce.number().int().min(1).max(100).default(50),
});
export const activityListQuerySchema = listQuerySchema.extend({
	type: activityTypeSchema.optional(),
	sort: z.enum(["date", "type"]).default("date"),
});

export const syncMutationSchema = z.object({
	mutationId: idSchema,
	entity: entityTypeSchema,
	action: mutationActionSchema,
	entityId: idSchema.optional(),
	payload: z.record(z.string(), z.unknown()).optional(),
	clientUpdatedAt: z.string(),
});
export const syncPushSchema = z.object({
	mutations: z.array(syncMutationSchema).min(1).max(100),
});
export const syncPullQuerySchema = z.object({ cursor: z.string().optional() });

export type Profile = z.infer<typeof profileSchema>;
export type Goals = z.infer<typeof goalsSchema>;
export type WaterEntry = z.infer<typeof waterEntrySchema>;
export type Meal = z.infer<typeof mealSchema>;
export type Activity = z.infer<typeof activitySchema>;
export type WeightEntry = z.infer<typeof weightEntrySchema>;
export type SyncMutation = z.infer<typeof syncMutationSchema>;
export type ActivityType = z.infer<typeof activityTypeSchema>;
export type Period = z.infer<typeof periodSchema>;

export type ApiError = {
	error: {
		code: string;
		message: string;
		details?: unknown;
		requestId: string;
	};
};
export type ApiResponse<T> = { data: T; meta?: Record<string, unknown> };
export type AuthTokens = {
	accessToken: string;
	refreshToken: string;
	expiresIn: number;
};

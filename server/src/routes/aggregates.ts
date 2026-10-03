import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
	dateSchema,
	periodSchema,
	type ActivityStatistics,
	type ProgressStatistics,
} from "@vitalis/contracts";
import { z } from "zod";
import { requireAuth } from "../lib/auth.js";
import { dateWindow, parseDate } from "../lib/dates.js";
import { calculateBmi, weightGoalWeeks } from "../lib/health.js";
import { prisma } from "../lib/prisma.js";

const today = () => new Date().toISOString().slice(0, 10);
const dateQuery = z.object({ date: dateSchema.default(today) });
const periodQuery = z.object({
	period: periodSchema.default("week"),
	date: dateSchema.default(today),
});
const activityStatsQuery = periodQuery.extend({
	period: z.enum(["week", "month"]).default("week"),
});
const ratio = (value: number, goal: number) => (goal > 0 ? value / goal : 0);

export async function aggregateRoutes(raw: FastifyInstance) {
	const app = raw.withTypeProvider<ZodTypeProvider>();
	app.addHook("preHandler", requireAuth);
	app.get(
		"/dashboard/daily",
		{ schema: { querystring: dateQuery } },
		async (request) => {
			const date = parseDate(request.query.date);
			const [water, meals, steps, goals] = await Promise.all([
				prisma.waterEntry.aggregate({
					where: { userId: request.user.sub, date, deletedAt: null },
					_sum: { amountMl: true },
				}),
				prisma.meal.aggregate({
					where: { userId: request.user.sub, date, deletedAt: null },
					_sum: { calories: true },
				}),
				prisma.dailySteps.findUnique({
					where: { userId_date: { userId: request.user.sub, date } },
				}),
				prisma.goals.findUniqueOrThrow({ where: { userId: request.user.sub } }),
			]);
			const values = {
				water: water._sum.amountMl ?? 0,
				calories: meals._sum.calories ?? 0,
				steps: steps?.steps ?? 0,
			};
			return {
				data: {
					...values,
					goals: {
						waterMl: goals.waterMl,
						calories: goals.calories,
						steps: goals.steps,
					},
					waterProgress: ratio(values.water, goals.waterMl),
					calorieProgress: ratio(values.calories, goals.calories),
					stepProgress: ratio(values.steps, goals.steps),
					caloriesRemaining: goals.calories - values.calories,
				},
			};
		},
	);

	app.get(
		"/progress",
		{ schema: { querystring: periodQuery } },
		async (request) => {
			const { start, end } = dateWindow(
				request.query.period,
				request.query.date,
			);
			const [water, meals, activities, steps, goals] = await Promise.all([
				prisma.waterEntry.findMany({
					where: {
						userId: request.user.sub,
						date: { gte: start, lte: end },
						deletedAt: null,
					},
				}),
				prisma.meal.findMany({
					where: {
						userId: request.user.sub,
						date: { gte: start, lte: end },
						deletedAt: null,
					},
				}),
				prisma.activity.findMany({
					where: {
						userId: request.user.sub,
						date: { gte: start, lte: end },
						deletedAt: null,
					},
				}),
				prisma.dailySteps.findMany({
					where: { userId: request.user.sub, date: { gte: start, lte: end } },
				}),
				prisma.goals.findUniqueOrThrow({ where: { userId: request.user.sub } }),
			]);
			const days =
				request.query.period === "day"
					? 1
					: request.query.period === "week"
						? 7
						: 30;
			const sum = (items: number[]) => items.reduce((a, b) => a + b, 0);
			return {
				data: {
					period: request.query.period,
					windowDays: days,
					waterProgress: ratio(
						sum(water.map((x) => x.amountMl)) / days,
						goals.waterMl,
					),
					calorieProgress: ratio(
						sum(meals.map((x) => x.calories)) / days,
						goals.calories,
					),
					stepProgress: ratio(
						sum(steps.map((x) => x.steps)) / days,
						goals.steps,
					),
					activityMinutes: sum(activities.map((x) => x.durationSeconds)) / 60,
					contributingDays: new Set(
						[...water, ...meals, ...activities, ...steps].map((x) =>
							x.date.toISOString().slice(0, 10),
						),
					).size,
				} satisfies ProgressStatistics,
			};
		},
	);

	app.get(
		"/activities/stats",
		{ schema: { querystring: activityStatsQuery } },
		async (request) => {
			const current = dateWindow("week", request.query.date);
			const period = dateWindow(request.query.period, request.query.date);
			const previousEnd = new Date(current.start);
			previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);
			const previousStart = new Date(previousEnd);
			previousStart.setUTCDate(previousStart.getUTCDate() - 6);
			const [activities, currentSteps, previousSteps, periodSteps] =
				await Promise.all([
					prisma.activity.findMany({
						where: {
							userId: request.user.sub,
							deletedAt: null,
							date: { gte: period.start, lte: period.end },
						},
					}),
					prisma.dailySteps.findMany({
						where: {
							userId: request.user.sub,
							date: { gte: current.start, lte: current.end },
						},
					}),
					prisma.dailySteps.findMany({
						where: {
							userId: request.user.sub,
							date: { gte: previousStart, lte: previousEnd },
						},
					}),
					prisma.dailySteps.findMany({
						where: {
							userId: request.user.sub,
							date: { gte: period.start, lte: period.end },
						},
					}),
				]);
			const total = (values: number[]) => values.reduce((a, b) => a + b, 0);
			const currentAverage = total(currentSteps.map((x) => x.steps)) / 7;
			const previousAverage = total(previousSteps.map((x) => x.steps)) / 7;
			return {
				data: {
					period: request.query.period,
					activityCount: activities.length,
					durationSeconds: total(activities.map((x) => x.durationSeconds)),
					distanceMeters: total(activities.map((x) => x.distanceMeters)),
					calories: total(activities.map((x) => x.calories)),
					steps: total(periodSteps.map((x) => x.steps)),
					stepAverage: currentAverage,
					previousStepAverage: previousAverage,
					trend:
						currentAverage > previousAverage
							? "up"
							: currentAverage < previousAverage
								? "down"
								: "flat",
					trendPercent: previousAverage
						? ((currentAverage - previousAverage) / previousAverage) * 100
						: null,
				} satisfies ActivityStatistics,
			};
		},
	);

	app.get(
		"/weights/comparison",
		{ schema: { querystring: dateQuery } },
		async (request) => {
			const current = dateWindow("week", request.query.date);
			const previousEnd = new Date(current.start);
			previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);
			const previousStart = new Date(previousEnd);
			previousStart.setUTCDate(previousStart.getUTCDate() - 6);
			const [currentRows, previousRows, profile, goals] = await Promise.all([
				prisma.weightEntry.findMany({
					where: {
						userId: request.user.sub,
						deletedAt: null,
						date: { gte: current.start, lte: current.end },
					},
					orderBy: [{ date: "asc" }, { createdAt: "asc" }, { id: "asc" }],
				}),
				prisma.weightEntry.findMany({
					where: {
						userId: request.user.sub,
						deletedAt: null,
						date: { gte: previousStart, lte: previousEnd },
					},
					orderBy: [{ date: "asc" }, { createdAt: "asc" }, { id: "asc" }],
				}),
				prisma.profile.findUniqueOrThrow({
					where: { userId: request.user.sub },
				}),
				prisma.goals.findUniqueOrThrow({ where: { userId: request.user.sub } }),
			]);
			const map = (rows: typeof currentRows) =>
				[
					...new Map(
						rows.map((row) => [row.date.toISOString().slice(0, 10), row]),
					).values(),
				].map((x) => ({
					date: x.date.toISOString().slice(0, 10),
					weightKg: x.weightKg,
				}));
			return {
				data: {
					currentWeek: map(currentRows),
					previousWeek: map(previousRows),
					bmi: calculateBmi(profile.weightKg, profile.heightCm),
					goal: {
						weightKg: goals.weightKg,
						estimatedWeeks: weightGoalWeeks(
							profile.weightKg,
							goals.weightKg,
							goals.dailyDeficit,
						),
					},
				},
			};
		},
	);
}

import type { FastifyInstance } from "fastify";
import { buildHealthReport, reportQuerySchema, reportWindow } from "@vitalis/contracts";
import { requireAuth } from "../lib/auth.js";
import { requireProfile } from "../lib/profile-scope.js";
import { prisma } from "../lib/prisma.js";
import { formatDate } from "../lib/dates.js";
import { Prisma } from "../../generated/prisma/client.js";
export async function reportingRoutes(app: FastifyInstance) {
    app.addHook("preHandler", requireAuth);
    app.addHook("preHandler", requireProfile);
    app.get("/reports/metrics", async (req) => {
        const q = reportQuerySchema.parse(req.query);
        const data = await prisma.$transaction(async (tx) => {
            const range = reportWindow(q.period, q.date);
            const scope = { userId: req.user.sub, profileId: req.profileId, deletedAt: null, date: { gte: new Date(range.start + "T00:00:00Z"), lte: new Date(range.end + "T00:00:00Z") } };
            const [water, meals, activities, weights, steps, goals] = await Promise.all([
                tx.waterEntry.findMany({ where: scope }), tx.meal.findMany({ where: scope }),
                tx.activity.findMany({ where: scope }), tx.weightEntry.findMany({ where: scope }),
                tx.dailySteps.findMany({ where: scope }), tx.goals.findUniqueOrThrow({ where: { profileId: req.profileId } }),
            ]);
            return buildHealthReport({
                water: water.map(r => ({ ...r, date: formatDate(r.date) })), meals: meals.map(r => ({ ...r, date: formatDate(r.date) })),
                activities: activities.map(r => ({ ...r, date: formatDate(r.date) })), weights: weights.map(r => ({ ...r, date: formatDate(r.date) })), steps: steps.map(r => ({ ...r, date: formatDate(r.date) })),
            }, q.period, q.date, goals);
        }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
        return { data };
    });
}

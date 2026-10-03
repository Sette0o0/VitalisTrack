import { test, expect } from "vitest";
import { createLimiter } from "../src/lib/concurrency.js";
test("limita a pressão no pool e libera vagas após falhas", async () => {
	const limit = createLimiter(3);
	let active = 0,
		peak = 0;
	const results = await Promise.allSettled(
		Array.from({ length: 20 }, (_, i) =>
			limit(async () => {
				active++;
				peak = Math.max(peak, active);
				await new Promise((resolve) => setTimeout(resolve, 1));
				active--;
				if (i === 5) throw new Error("falha");
				return i;
			}),
		),
	);
	expect(peak).toBe(3);
	expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(19);
	expect(await limit(async () => 42)).toBe(42);
});

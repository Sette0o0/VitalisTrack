import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		coverage: {
			provider: "v8",
			include: [
				"src/lib/*.ts",
				"src/routes/*.ts",
			],
			thresholds: { lines: 70, functions: 70, statements: 70, branches: 70 },
			reporter: ["text", "json-summary"],
		},
	},
});

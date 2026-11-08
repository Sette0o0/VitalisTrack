import { defineConfig } from "tsup";

export default defineConfig({
	noExternal: ["@vitalis/contracts"],
});

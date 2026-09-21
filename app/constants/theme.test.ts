import { contrastRatio } from "@/lib/color";
import { darkTheme, lightTheme } from "./theme";

describe.each([
	["claro", lightTheme],
	["escuro", darkTheme],
] as const)("contraste do tema %s", (_name, theme) => {
	test.each([
		["texto/fundo", theme.onSurface, theme.background],
		["texto/superfície", theme.onSurface, theme.surface],
		["texto variante/superfície", theme.onSurfaceVariant, theme.surface],
		["primário", theme.onPrimary, theme.primary],
		["container primário", theme.onPrimaryContainer, theme.primaryContainer],
		["erro", theme.onErrorContainer, theme.errorContainer],
		["aviso", theme.onWarningContainer, theme.warningContainer],
		["água", theme.onWaterContainer, theme.waterContainer],
		["alimentação", theme.onFoodContainer, theme.foodContainer],
		["atividade", theme.onActivityContainer, theme.activityContainer],
		["peso", theme.onWeightContainer, theme.weightContainer],
	])("%s atende WCAG AA para texto normal", (_pair, foreground, background) => {
		expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
	});
});

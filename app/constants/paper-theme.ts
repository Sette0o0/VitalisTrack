import {
	MD3DarkTheme,
	MD3LightTheme,
	adaptNavigationTheme,
} from "react-native-paper";
import { DarkTheme, DefaultTheme } from "@react-navigation/native";
import { darkTheme, lightTheme } from "./theme";
export function createPaperTheme(dark: boolean) {
	const t = dark ? darkTheme : lightTheme;
	const base = dark ? MD3DarkTheme : MD3LightTheme;
	return {
		...base,
		colors: {
			...base.colors,
			elevation: {
				level0: "transparent",
				level1: t.surface,
				level2: t.surfaceVariant,
				level3: t.surfaceVariant,
				level4: t.surfaceVariant,
				level5: t.surfaceVariant,
			},
			primary: t.primary,
			onPrimary: t.onPrimary,
			primaryContainer: t.primaryContainer,
			onPrimaryContainer: t.onPrimaryContainer,
			background: t.background,
			onBackground: t.onSurface,
			surface: t.surface,
			onSurface: t.onSurface,
			surfaceVariant: t.surfaceVariant,
			onSurfaceVariant: t.onSurfaceVariant,
			outline: t.outline,
			error: t.error,
			errorContainer: t.errorContainer,
			onErrorContainer: t.onErrorContainer,
			secondary: t.activity,
			onSecondary: dark ? t.background : "#FFFFFF",
			secondaryContainer: t.activityContainer,
			onSecondaryContainer: t.onActivityContainer,
			tertiary: t.weight,
			onTertiary: dark ? t.background : "#FFFFFF",
			tertiaryContainer: t.weightContainer,
			onTertiaryContainer: t.onWeightContainer,
		},
	};
}
export const navigationThemes = adaptNavigationTheme({
	reactNavigationLight: DefaultTheme,
	reactNavigationDark: DarkTheme,
	materialLight: createPaperTheme(false),
	materialDark: createPaperTheme(true),
});

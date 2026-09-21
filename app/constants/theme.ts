import { Platform } from "react-native";

export type ThemeTokens = {
	isDark: boolean;
	background: string;
	surface: string;
	surfaceVariant: string;
	surfaceRaised: string;
	onSurface: string;
	onSurfaceVariant: string;
	outline: string;
	primary: string;
	onPrimary: string;
	primaryContainer: string;
	onPrimaryContainer: string;
	error: string;
	errorContainer: string;
	onErrorContainer: string;
	warning: string;
	warningContainer: string;
	onWarningContainer: string;
	success: string;
	water: string;
	waterContainer: string;
	onWaterContainer: string;
	food: string;
	foodContainer: string;
	onFoodContainer: string;
	activity: string;
	activityContainer: string;
	onActivityContainer: string;
	weight: string;
	weightContainer: string;
	onWeightContainer: string;
	shadow: string;
	scrim: string;
};

export const lightTheme: ThemeTokens = {
	isDark: false,
	background: "#F7FAF8",
	surface: "#FFFFFF",
	surfaceVariant: "#E7EEEB",
	surfaceRaised: "#F0F5F2",
	onSurface: "#171D1B",
	onSurfaceVariant: "#3F4946",
	outline: "#6F7976",
	primary: "#0A6F67",
	onPrimary: "#FFFFFF",
	primaryContainer: "#A7F2E8",
	onPrimaryContainer: "#00201D",
	error: "#BA1A1A",
	errorContainer: "#FFDAD6",
	onErrorContainer: "#410002",
	warning: "#7A4600",
	warningContainer: "#FFE2B8",
	onWarningContainer: "#291800",
	success: "#2E6B23",
	water: "#2567C5",
	waterContainer: "#D8E5FF",
	onWaterContainer: "#001A41",
	food: "#AD4B2D",
	foodContainer: "#FFDBD0",
	onFoodContainer: "#3A0B00",
	activity: "#536600",
	activityContainer: "#D9EE8E",
	onActivityContainer: "#171E00",
	weight: "#6C4BA1",
	weightContainer: "#EADCFF",
	onWeightContainer: "#26005D",
	shadow: "#102B26",
	scrim: "#00000088",
};

export const darkTheme: ThemeTokens = {
	isDark: true,
	background: "#0F1513",
	surface: "#171D1B",
	surfaceVariant: "#202724",
	surfaceRaised: "#28312E",
	onSurface: "#DFE4E1",
	onSurfaceVariant: "#BEC9C5",
	outline: "#89938F",
	primary: "#86D6CC",
	onPrimary: "#003732",
	primaryContainer: "#005048",
	onPrimaryContainer: "#A7F2E8",
	error: "#FFB4AB",
	errorContainer: "#93000A",
	onErrorContainer: "#FFDAD6",
	warning: "#FFB95C",
	warningContainer: "#663C00",
	onWarningContainer: "#FFE2B8",
	success: "#9BD78B",
	water: "#ADC8FF",
	waterContainer: "#17375F",
	onWaterContainer: "#D8E5FF",
	food: "#FFB4A3",
	foodContainer: "#5B2517",
	onFoodContainer: "#FFDBD0",
	activity: "#BDD657",
	activityContainer: "#374400",
	onActivityContainer: "#D9EE8E",
	weight: "#D3BBFF",
	weightContainer: "#4D337D",
	onWeightContainer: "#EADCFF",
	shadow: "#000000",
	scrim: "#000000AA",
};

// Compatibilidade com componentes legados do template Expo.
export const palette = {
	primary: lightTheme.primary,
	onPrimary: lightTheme.onPrimary,
	primaryContainer: lightTheme.primaryContainer,
	secondaryContainer: "#CCE8E3",
	background: lightTheme.background,
	surface: lightTheme.surface,
	surfaceLow: lightTheme.surfaceRaised,
	surfaceMid: lightTheme.surfaceVariant,
	text: lightTheme.onSurface,
	muted: lightTheme.onSurfaceVariant,
	outline: lightTheme.outline,
	error: lightTheme.error,
	water: lightTheme.water,
	waterSoft: lightTheme.waterContainer,
	food: lightTheme.food,
	foodSoft: lightTheme.foodContainer,
	activity: lightTheme.activity,
	activitySoft: lightTheme.activityContainer,
	purple: lightTheme.weight,
	purpleSoft: lightTheme.weightContainer,
	warning: lightTheme.warning,
	warningSoft: lightTheme.warningContainer,
};

export const Colors = {
	light: {
		text: lightTheme.onSurface,
		background: lightTheme.background,
		tint: lightTheme.primary,
		icon: lightTheme.onSurfaceVariant,
		tabIconDefault: lightTheme.onSurfaceVariant,
		tabIconSelected: lightTheme.primary,
	},
	dark: {
		text: darkTheme.onSurface,
		background: darkTheme.background,
		tint: darkTheme.primary,
		icon: darkTheme.onSurfaceVariant,
		tabIconDefault: darkTheme.outline,
		tabIconSelected: darkTheme.primary,
	},
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 12, md: 16, lg: 24, pill: 999 };
export const Fonts = Platform.select({
	ios: {
		sans: "system-ui",
		serif: "ui-serif",
		rounded: "ui-rounded",
		mono: "ui-monospace",
	},
	default: {
		sans: "normal",
		serif: "serif",
		rounded: "normal",
		mono: "monospace",
	},
	web: {
		sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
		serif: "Georgia, 'Times New Roman', serif",
		rounded: "'SF Pro Rounded', sans-serif",
		mono: "SFMono-Regular, Menlo, Monaco, Consolas, monospace",
	},
});

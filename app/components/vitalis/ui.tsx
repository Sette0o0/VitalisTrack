import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { PropsWithChildren, ReactNode } from "react";
import {
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	TextInputProps,
	View,
	ViewStyle,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import { radius, spacing } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";

export function Screen({
	children,
	scroll = true,
	style,
}: PropsWithChildren<{ scroll?: boolean; style?: ViewStyle }>) {
	const theme = useAppTheme();
	const content = (
		<View style={[styles.screen, { backgroundColor: theme.background }, style]}>
			{children}
		</View>
	);
	return scroll ? (
		<ScrollView
			style={[styles.bg, { backgroundColor: theme.background }]}
			contentContainerStyle={styles.scroll}
			keyboardShouldPersistTaps="handled"
		>
			{content}
		</ScrollView>
	) : (
		<View
			style={[
				styles.bg,
				styles.screen,
				{ backgroundColor: theme.background },
				style,
			]}
		>
			{children}
		</View>
	);
}

export const Title = ({ children }: PropsWithChildren) => {
	const theme = useAppTheme();
	return (
		<Text style={[styles.title, { color: theme.onSurface }]}>{children}</Text>
	);
};
export const Subtitle = ({ children }: PropsWithChildren) => {
	const theme = useAppTheme();
	return (
		<Text style={[styles.subtitle, { color: theme.onSurface }]}>
			{children}
		</Text>
	);
};
export const Muted = ({ children }: PropsWithChildren) => {
	const theme = useAppTheme();
	return (
		<Text style={[styles.muted, { color: theme.onSurfaceVariant }]}>
			{children}
		</Text>
	);
};
export const Eyebrow = ({ children }: PropsWithChildren) => {
	const theme = useAppTheme();
	return (
		<Text style={[styles.eyebrow, { color: theme.primary }]}>{children}</Text>
	);
};

export function Card({
	children,
	style,
}: PropsWithChildren<{ style?: ViewStyle }>) {
	const theme = useAppTheme();
	return (
		<View
			style={[
				styles.card,
				{ backgroundColor: theme.surface, shadowColor: theme.shadow },
				style,
			]}
		>
			{children}
		</View>
	);
}

export function Button({
	title,
	onPress,
	variant = "filled",
	icon,
	disabled,
}: {
	title: string;
	onPress?: () => void;
	variant?: "filled" | "outline" | "text" | "danger";
	icon?: keyof typeof MaterialCommunityIcons.glyphMap;
	disabled?: boolean;
}) {
	const theme = useAppTheme();
	const accent = variant === "danger" ? theme.error : theme.primary;
	return (
		<Pressable
			accessibilityRole="button"
			disabled={disabled}
			onPress={onPress}
			style={({ pressed }) => [
				styles.button,
				variant === "filled" && { backgroundColor: theme.primary },
				variant === "outline" && { borderWidth: 1, borderColor: theme.outline },
				pressed && styles.pressed,
				disabled && { opacity: 0.45 },
			]}
		>
			{icon && (
				<MaterialCommunityIcons
					name={icon}
					size={20}
					color={variant === "filled" ? theme.onPrimary : accent}
				/>
			)}
			<Text
				style={[
					styles.buttonText,
					{ color: variant === "filled" ? theme.onPrimary : accent },
				]}
			>
				{title}
			</Text>
		</Pressable>
	);
}

export function Field({
	label,
	error,
	...props
}: TextInputProps & { label: string; error?: string }) {
	const theme = useAppTheme();
	return (
		<View style={styles.fieldWrap}>
			<Text style={[styles.label, { color: theme.onSurfaceVariant }]}>
				{label}
			</Text>
			<TextInput
				placeholderTextColor={theme.onSurfaceVariant}
				style={[
					styles.input,
					{
						backgroundColor: theme.surface,
						color: theme.onSurface,
						borderColor: error ? theme.error : theme.outline,
					},
				]}
				{...props}
			/>
			{error ? (
				<Text style={[styles.error, { color: theme.error }]}>{error}</Text>
			) : null}
		</View>
	);
}

export function Header({
	title,
	onBack,
	action,
}: {
	title: string;
	onBack?: () => void;
	action?: ReactNode;
}) {
	const theme = useAppTheme();
	return (
		<View style={styles.header}>
			{onBack ? (
				<Pressable
					accessibilityLabel="Voltar"
					onPress={onBack}
					style={styles.iconButton}
				>
					<MaterialCommunityIcons
						name="arrow-left"
						size={24}
						color={theme.onSurface}
					/>
				</Pressable>
			) : (
				<View style={{ width: 44 }} />
			)}
			<Text style={[styles.headerTitle, { color: theme.onSurface }]}>
				{title}
			</Text>
			<View style={{ width: 44, alignItems: "flex-end" }}>{action}</View>
		</View>
	);
}

export function ProgressBar({
	value,
	color,
}: {
	value: number;
	color?: string;
}) {
	const theme = useAppTheme();
	return (
		<View style={[styles.track, { backgroundColor: theme.surfaceVariant }]}>
			<View
				style={[
					styles.bar,
					{
						width: `${Math.min(Math.max(value, 0), 1) * 100}%`,
						backgroundColor: color ?? theme.primary,
					},
				]}
			/>
		</View>
	);
}

export function ProgressRing({
	value,
	size = 104,
	color,
	label,
	trackColor,
	valueColor,
	labelColor,
}: {
	value: number;
	size?: number;
	color?: string;
	label?: string;
	trackColor?: string;
	valueColor?: string;
	labelColor?: string;
}) {
	const theme = useAppTheme();
	const stroke = 9;
	const r = (size - stroke) / 2;
	const circumference = 2 * Math.PI * r;
	return (
		<View
			style={{
				width: size,
				height: size,
				alignItems: "center",
				justifyContent: "center",
			}}
		>
			<Svg width={size} height={size} style={StyleSheet.absoluteFill}>
				<Circle
					cx={size / 2}
					cy={size / 2}
					r={r}
					fill="none"
					stroke={trackColor ?? theme.surfaceVariant}
					strokeWidth={stroke}
				/>
				<Circle
					cx={size / 2}
					cy={size / 2}
					r={r}
					fill="none"
					stroke={color ?? theme.primary}
					strokeWidth={stroke}
					strokeLinecap="round"
					strokeDasharray={circumference}
					strokeDashoffset={
						circumference * (1 - Math.min(Math.max(value, 0), 1))
					}
					rotation="-90"
					origin={`${size / 2}, ${size / 2}`}
				/>
			</Svg>
			<Text
				style={[styles.ringValue, { color: valueColor ?? theme.onSurface }]}
			>
				{Math.round(value * 100)}%
			</Text>
			{label ? (
				<Text
					style={[
						styles.ringLabel,
						{ color: labelColor ?? theme.onSurfaceVariant },
					]}
				>
					{label}
				</Text>
			) : null}
		</View>
	);
}

export function EmptyState({
	icon,
	title,
	text,
}: {
	icon: keyof typeof MaterialCommunityIcons.glyphMap;
	title: string;
	text: string;
}) {
	const theme = useAppTheme();
	return (
		<Card style={{ alignItems: "center", gap: 8 }}>
			<MaterialCommunityIcons
				name={icon}
				size={42}
				color={theme.onSurfaceVariant}
			/>
			<Subtitle>{title}</Subtitle>
			<Muted>{text}</Muted>
		</Card>
	);
}

const styles = StyleSheet.create({
	bg: { flex: 1 },
	scroll: { flexGrow: 1 },
	screen: { flex: 1, padding: spacing.lg, gap: spacing.lg, paddingBottom: 36 },
	title: {
		fontSize: 28,
		lineHeight: 34,
		fontWeight: "800",
		letterSpacing: -0.5,
	},
	subtitle: { fontSize: 18, fontWeight: "700" },
	muted: { fontSize: 13, lineHeight: 19 },
	eyebrow: {
		fontSize: 11,
		fontWeight: "800",
		letterSpacing: 1.1,
		textTransform: "uppercase",
	},
	card: {
		padding: spacing.lg,
		borderRadius: radius.lg,
		gap: spacing.md,
		elevation: 2,
		shadowOpacity: 0.07,
		shadowRadius: 8,
		shadowOffset: { width: 0, height: 2 },
	},
	button: {
		minHeight: 48,
		borderRadius: radius.pill,
		flexDirection: "row",
		gap: 8,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: 20,
	},
	pressed: { opacity: 0.72 },
	buttonText: { fontWeight: "800", fontSize: 15 },
	fieldWrap: { gap: 5 },
	label: { fontWeight: "700", fontSize: 12 },
	input: {
		minHeight: 52,
		borderWidth: 1,
		borderRadius: radius.sm,
		paddingHorizontal: 14,
		fontSize: 16,
	},
	error: { fontSize: 12 },
	header: {
		minHeight: 52,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	iconButton: {
		width: 44,
		height: 44,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: 22,
	},
	headerTitle: { fontSize: 19, fontWeight: "800" },
	track: { height: 8, borderRadius: 8, overflow: "hidden" },
	bar: { height: 8, borderRadius: 8 },
	ringValue: { fontSize: 19, fontWeight: "900" },
	ringLabel: { fontSize: 10, fontWeight: "700" },
});

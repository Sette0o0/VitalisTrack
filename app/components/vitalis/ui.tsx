import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { ComponentProps, PropsWithChildren, ReactNode } from "react";
import {
	KeyboardAvoidingView,
	Platform,
	ScrollView,
	StyleSheet,
	View,
	ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
	Appbar,
	Button as PaperButton,
	Surface,
	HelperText,
	Text,
	TextInput,
	ProgressBar as PaperProgressBar,
} from "react-native-paper";
import Svg, { Circle } from "react-native-svg";
import { spacing } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
export function Screen({
	children,
	scroll = true,
	style,
}: PropsWithChildren<{ scroll?: boolean; style?: ViewStyle }>) {
	const theme = useAppTheme(),
		insets = useSafeAreaInsets();
	const content = (
		<View
			style={[
				styles.screen,
				{
					backgroundColor: theme.background,
					paddingBottom: Math.max(insets.bottom, 16) + 20,
				},
				style,
			]}
		>
			{children}
		</View>
	);
	return (
		<KeyboardAvoidingView
			style={{
				flex: 1,
				backgroundColor: theme.background,
				paddingTop: insets.top,
				paddingLeft: insets.left,
				paddingRight: insets.right,
			}}
			behavior={Platform.OS === "ios" ? "padding" : undefined}
		>
			{scroll ? (
				<ScrollView
					keyboardShouldPersistTaps="handled"
					contentContainerStyle={{ flexGrow: 1 }}
				>
					{content}
				</ScrollView>
			) : (
				content
			)}
		</KeyboardAvoidingView>
	);
}
export const Title = ({ children }: PropsWithChildren) => (
	<Text variant="headlineMedium" accessibilityRole="header">
		{children}
	</Text>
);
export const Subtitle = ({ children }: PropsWithChildren) => (
	<Text variant="titleLarge" accessibilityRole="header">
		{children}
	</Text>
);
export const Muted = ({ children }: PropsWithChildren) => {
	const t = useAppTheme();
	return (
		<Text variant="bodyMedium" style={{ color: t.onSurfaceVariant }}>
			{children}
		</Text>
	);
};
export const Eyebrow = ({ children }: PropsWithChildren) => {
	const t = useAppTheme();
	return (
		<Text variant="labelLarge" style={{ color: t.primary }}>
			{children}
		</Text>
	);
};
export function Card({
	children,
	style,
}: PropsWithChildren<{ style?: ViewStyle }>) {
	return (
		<Surface
			elevation={1}
			style={[
				{ padding: spacing.lg, gap: spacing.md, borderRadius: 24 },
				style,
			]}
		>
			{children}
		</Surface>
	);
}
export function Button({
	title,
	onPress,
	variant = "filled",
	icon,
	disabled,
	loading,
	testID,
}: {
	title: string;
	onPress?: () => void | Promise<void>;
	variant?: "filled" | "outline" | "text" | "danger";
	icon?: keyof typeof MaterialCommunityIcons.glyphMap;
	disabled?: boolean;
	loading?: boolean;
	testID?: string;
}) {
	const theme = useAppTheme();
	return (
		<PaperButton
			testID={testID}
			accessibilityLabel={title}
			mode={
				variant === "filled"
					? "contained"
					: variant === "outline"
						? "outlined"
						: "text"
			}
			icon={icon}
			disabled={disabled || loading}
			loading={loading}
			textColor={variant === "danger" ? theme.error : undefined}
			onPress={() => void onPress?.()}
			contentStyle={{ minHeight: 48 }}
			labelStyle={{ fontSize: 14 }}
		>
			{title}
		</PaperButton>
	);
}
export function Field({
	label,
	error,
	...props
}: Omit<ComponentProps<typeof TextInput>, "error" | "label"> & {
	label: string;
	error?: string;
}) {
	return (
		<View>
			<TextInput
				mode="outlined"
				label={label}
				accessibilityLabel={label}
				error={Boolean(error)}
				{...props}
			/>
			{error && (
				<HelperText type="error" accessibilityLiveRegion="polite">
					{error}
				</HelperText>
			)}
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
	return (
		<Appbar.Header
			statusBarHeight={0}
			style={{ backgroundColor: "transparent" }}
		>
			{onBack && (
				<Appbar.BackAction accessibilityLabel="Voltar" onPress={onBack} />
			)}
			<Appbar.Content title={title} />
			{action}
		</Appbar.Header>
	);
}
export function ProgressBar({
	value,
	color,
}: {
	value: number;
	color?: string;
}) {
	return (
		<PaperProgressBar
			progress={Math.min(Math.max(value, 0), 1)}
			color={color}
			accessibilityRole="progressbar"
			accessibilityValue={{
				min: 0,
				max: 100,
				now: Math.round(Math.min(Math.max(value, 0), 1) * 100),
				text: `${Math.round(value * 100)}%`,
			}}
			style={{ height: 8, borderRadius: 8 }}
		/>
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
	const t = useAppTheme(),
		stroke = 9,
		r = (size - stroke) / 2,
		circumference = 2 * Math.PI * r;
	return (
		<View
			accessible
			accessibilityRole="progressbar"
			accessibilityLabel={label ?? "Progresso"}
			accessibilityValue={{
				min: 0,
				max: 100,
				now: Math.round(Math.min(Math.max(value, 0), 1) * 100),
				text: `${Math.round(value * 100)}%`,
			}}
			style={{
				width: size,
				height: size,
				alignItems: "center",
				justifyContent: "center",
			}}
		>
			<Svg
				width={size}
				height={size}
				style={StyleSheet.absoluteFill}
				accessible={false}
			>
				<Circle
					cx={size / 2}
					cy={size / 2}
					r={r}
					fill="none"
					stroke={trackColor ?? t.surfaceVariant}
					strokeWidth={stroke}
				/>
				<Circle
					cx={size / 2}
					cy={size / 2}
					r={r}
					fill="none"
					stroke={color ?? t.primary}
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
			<Text variant="titleMedium" style={{ color: valueColor ?? t.onSurface }}>
				{Math.round(value * 100)}%
			</Text>
			{label && (
				<Text
					variant="labelSmall"
					style={{ color: labelColor ?? t.onSurfaceVariant }}
				>
					{label}
				</Text>
			)}
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
	const t = useAppTheme();
	return (
		<Card style={{ alignItems: "center" }}>
			<MaterialCommunityIcons
				name={icon}
				size={42}
				color={t.onSurfaceVariant}
			/>
			<Subtitle>{title}</Subtitle>
			<Muted>{text}</Muted>
		</Card>
	);
}
const styles = StyleSheet.create({
	screen: { flex: 1, padding: spacing.lg, gap: spacing.lg },
});

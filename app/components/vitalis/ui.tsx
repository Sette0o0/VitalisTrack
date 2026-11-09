import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { ComponentProps, PropsWithChildren, ReactNode } from "react";
import {
	KeyboardAvoidingView,
	Platform,
	ScrollView,
	StyleSheet,
	View,
	ViewStyle,
	useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
	Appbar,
	ActivityIndicator,
	Surface,
	TouchableRipple,
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
	onLayout,
}: PropsWithChildren<{ scroll?: boolean; style?: ViewStyle; onLayout?: ComponentProps<typeof View>["onLayout"] }>) {
	const theme = useAppTheme(),
		insets = useSafeAreaInsets();
 const {fontScale} = useWindowDimensions();
	const content = (
		<View
   // RN 0.81 retains paragraph measurements across Android font changes.
   // Remount presentation nodes while controlled values stay in screen state.
   key={fontScale}
			onLayout={onLayout}
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
			behavior={Platform.OS === "ios" ? "padding" : "height"}
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
	onPress,
	accessibilityLabel,
	testID,
}: PropsWithChildren<{
	style?: ViewStyle;
	onPress?: () => void;
	accessibilityLabel?: string;
	testID?: string;
}>) {
	return (
		<Surface
			elevation={1}
			testID={onPress ? undefined : testID}
			style={[
				{ borderRadius: 24 },
				!onPress && { padding: spacing.lg, gap: spacing.md },
				style,
			]}
		>
			{onPress ? (
				<TouchableRipple
					onPress={onPress}
					accessibilityRole="button"
					accessibilityLabel={accessibilityLabel}
					testID={testID}
					borderless
					style={{ borderRadius: 24 }}
				>
					<View style={{ padding: spacing.lg, gap: spacing.md }}>
						{children}
					</View>
				</TouchableRipple>
			) : (
				children
			)}
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
	accessibilityLabel,
}: {
	title: string;
	accessibilityLabel?: string;
	onPress?: () => void | Promise<void>;
	variant?: "filled" | "outline" | "text" | "danger";
	icon?: keyof typeof MaterialCommunityIcons.glyphMap;
	disabled?: boolean;
	loading?: boolean;
	testID?: string;
}) {
	const theme = useAppTheme();
 const inactive = Boolean(disabled || loading);
 const color = inactive ? theme.onSurfaceVariant : variant === "filled" ? theme.onPrimary : variant === "danger" ? theme.error : theme.primary;
 return (
  <TouchableRipple testID={testID} accessibilityRole="button"
   accessibilityLabel={accessibilityLabel ?? title}
   accessibilityState={{disabled:inactive,busy:Boolean(loading)}} disabled={inactive}
   onPress={() => void onPress?.()}
   style={{borderRadius:24,borderWidth:variant === "outline" ? 1 : 0,borderColor:theme.outline,
    backgroundColor:variant === "filled" ? (inactive ? theme.surfaceVariant : theme.primary) : "transparent"}}>
   <View style={{minHeight:48,paddingHorizontal:16,paddingVertical:12,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:8}}>
    {loading ? <ActivityIndicator size={20} color={color}/> : icon ? <MaterialCommunityIcons name={icon} size={20} color={color}/> : null}
    <Text variant="labelLarge" style={{color,flexShrink:1,textAlign:"center",lineHeight:undefined}}>{title}</Text>
   </View>
  </TouchableRipple>
 );
}
export function Field({
	label,
	error,
	style,
	...props
}: Omit<ComponentProps<typeof TextInput>, "error" | "label"> & {
	label: string;
	error?: string;
}) {
 const {fontScale} = useWindowDimensions();
	return (
		<View style={{gap:4}}>
   <Text variant="bodyMedium" style={{lineHeight:undefined}}>{label}</Text>
			<TextInput
				mode="outlined"
				accessibilityLabel={label}
				error={Boolean(error)}
				{...props}
    style={[{minHeight:Math.max(56,32 * fontScale + 24)},style]}
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
  <View style={{flexDirection:"row",alignItems:"center",gap:8,minHeight:64}}>
   {onBack && <Appbar.BackAction accessibilityLabel="Voltar" onPress={onBack} style={{width:48,height:48}}/>}
   <Text variant="titleLarge" accessibilityRole="header" style={{flex:1,lineHeight:undefined}}>{title}</Text>
   {action}
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
	text?: string;
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
			{text && <Muted>{text}</Muted>}
		</Card>
	);
}
const styles = StyleSheet.create({
	screen: { flex: 1, padding: spacing.lg, gap: spacing.lg },
});

import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Link, router } from "expo-router";
import { useMemo, useState } from "react";
import {
	KeyboardAvoidingView,
	Platform,
	StyleSheet,
	Text,
	View,
} from "react-native";
import {
	Button,
	Eyebrow,
	Field,
	Muted,
	Screen,
	Title,
} from "@/components/vitalis/ui";
import { radius, spacing, type ThemeTokens } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { loginSchema } from "@vitalis/contracts";
import { parseInput } from "@/lib/validation";
import { useSubmit } from "@/hooks/use-submit";
import { HelperText } from "react-native-paper";
import { useAppState } from "@/state/app-state";

export default function LoginScreen() {
	const theme = useAppTheme();
	const styles = useMemo(() => createStyles(theme), [theme]);
	const { login } = useAppState();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const { submit, saving, error } = useSubmit();
	const save = () =>
		submit(async () => {
			const input = parseInput(loginSchema, { email: email.trim(), password });
			await login(input.email, input.password);
			router.replace("/(tabs)");
		});
	return (
		<KeyboardAvoidingView
			style={{ flex: 1 }}
			behavior={Platform.OS === "ios" ? "padding" : undefined}
		>
			<Screen style={styles.screen}>
				<View style={styles.brand}>
					<View style={styles.logo}>
						<MaterialCommunityIcons
							name="water-plus"
							size={36}
							color={theme.onPrimary}
						/>
					</View>
					<Text style={styles.brandName}>VitalisTrack</Text>
				</View>
				<View style={{ gap: 7 }}>
					<Eyebrow>Bem-vindo de volta</Eyebrow>
					<Title>Entre na sua conta</Title>
					<Muted>Acompanhe sua saúde e seus hábitos em um só lugar.</Muted>
				</View>
				<View style={{ gap: spacing.md }}>
					<Field
						label="E-mail"
						autoCapitalize="none"
						keyboardType="email-address"
						value={email}
						onChangeText={setEmail}
					/>
					<Field
						label="Senha"
						secureTextEntry
						value={password}
						onChangeText={setPassword}
					/>
					{error ? (
						<HelperText type="error" accessibilityLiveRegion="polite">
							{error}
						</HelperText>
					) : null}
					<Button title="Entrar" onPress={save} loading={saving} />
				</View>
				<Text style={styles.switch}>
					Ainda não tem conta?{" "}
					<Link href="/(auth)/register" style={styles.link}>
						Criar conta
					</Link>
				</Text>
			</Screen>
		</KeyboardAvoidingView>
	);
}
const createStyles = (theme: ThemeTokens) =>
	StyleSheet.create({
		screen: { justifyContent: "center", paddingHorizontal: 24 },
		brand: { flexDirection: "row", alignItems: "center", gap: 12 },
		logo: {
			width: 64,
			height: 64,
			borderRadius: radius.lg,
			backgroundColor: theme.primary,
			alignItems: "center",
			justifyContent: "center",
		},
		brandName: { fontSize: 22, color: theme.onSurface, fontWeight: "900" },
		error: { color: theme.error, fontSize: 12 },
		switch: { textAlign: "center", color: theme.onSurfaceVariant },
		link: { color: theme.primary, fontWeight: "800" },
	});

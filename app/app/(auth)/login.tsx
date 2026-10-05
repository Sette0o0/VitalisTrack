import { useQaReady } from "@/hooks/use-qa-ready";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
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
import { HelperText, Text } from "react-native-paper";
import { useAppState } from "@/state/app-state";

export default function LoginScreen() {
	const onReady = useQaReady("login");
	const theme = useAppTheme();
	const styles = useMemo(() => createStyles(theme), [theme]);
	const { login, biometrics, loginWithBiometrics } = useAppState();
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
		<Screen style={styles.screen} onLayout={onReady}>
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
				{biometrics.enabled ? (
					<>
						<Button
							title="Entrar com biometria"
							icon="fingerprint"
							variant="outline"
							disabled={saving || !biometrics.available}
							onPress={() => submit(async () => {
								await loginWithBiometrics();
								router.replace("/(tabs)");
							})}
						/>
						<Muted>
							{biometrics.available
								? "Use sua digital ou entre com e-mail e senha."
								: "Biometria indisponível. Entre com e-mail e senha."}
						</Muted>
					</>
				) : (
					<Muted>Você pode ativar o login por biometria no Perfil após entrar.</Muted>
				)}
			</View>
			<View style={{ gap: 8 }}>
				<Text variant="bodyMedium" style={styles.switch}>
					Ainda não tem conta?
				</Text>
				<Button
					title="Criar conta"
					variant="text"
					onPress={() => router.push("/(auth)/register")}
				/>
			</View>
		</Screen>
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
	});

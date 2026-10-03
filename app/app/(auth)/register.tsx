import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import {
	Button,
	Field,
	Header,
	Muted,
	Screen,
	Title,
} from "@/components/vitalis/ui";
import { registerSchema } from "@vitalis/contracts";
import { parseInput } from "@/lib/validation";
import { useSubmit } from "@/hooks/use-submit";
import { HelperText } from "react-native-paper";
import { goBackOrReplace } from "@/lib/navigation";
import { useAppState } from "@/state/app-state";

export default function RegisterScreen() {
	const { register } = useAppState();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const { submit, saving, error } = useSubmit();
	const save = () =>
		submit(async () => {
			const input = parseInput(registerSchema, {
				name,
				email: email.trim(),
				password,
				passwordConfirmation: confirm,
			});
			await register(
				input.name,
				input.email,
				input.password,
				input.passwordConfirmation,
			);
			router.replace("/(tabs)");
		});
	return (
		<Screen>
			<Header
				title="Criar conta"
				onBack={() => goBackOrReplace(router, "/(auth)/login")}
			/>
			<Title>Crie seu acesso</Title>
			<Muted>Seus dados serão protegidos e sincronizados com sua conta.</Muted>
			<View style={{ gap: 12 }}>
				<Field
					testID="auth-name"
					label="Nome"
					value={name}
					onChangeText={setName}
				/>
				<Field
					testID="auth-email"
					label="E-mail"
					value={email}
					keyboardType="email-address"
					autoCapitalize="none"
					onChangeText={setEmail}
				/>
				<Field
					testID="auth-password"
					label="Senha"
					secureTextEntry
					value={password}
					onChangeText={setPassword}
				/>
				<Field
					testID="auth-confirm"
					label="Confirmar senha"
					secureTextEntry
					value={confirm}
					onChangeText={setConfirm}
				/>
				{error ? (
					<HelperText type="error" accessibilityLiveRegion="polite">
						{error}
					</HelperText>
				) : null}
				<Button
					testID="auth-submit"
					title="Criar conta"
					onPress={save}
					loading={saving}
				/>
			</View>
		</Screen>
	);
}

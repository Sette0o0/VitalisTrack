import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import {
	Button,
	Field,
	Header,
	Muted,
	Screen,
	Title,
} from "@/components/vitalis/ui";
import { useAppTheme } from "@/hooks/use-app-theme";
import { isEmail } from "@/lib/health";
import { goBackOrReplace } from "@/lib/navigation";
import { useAppState } from "@/state/app-state";

export default function RegisterScreen() {
	const theme = useAppTheme();
	const { register } = useAppState();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [error, setError] = useState("");
	const submit = async () => {
		if (
			!name.trim() ||
			!isEmail(email) ||
			password.length < 8 ||
			password !== confirm
		)
			return setError(
				"Revise os campos. As senhas devem ser iguais e ter ao menos 8 caracteres.",
			);
		try {
			setError("");
			await register(name.trim(), email.trim(), password, confirm);
			router.replace("/(tabs)");
		} catch (cause) {
			setError(
				cause instanceof Error
					? cause.message
					: "Não foi possível criar a conta.",
			);
		}
	};
	return (
		<Screen>
			<Header
				title="Criar conta"
				onBack={() => goBackOrReplace(router, "/(auth)/login")}
			/>
			<Title>Crie seu acesso</Title>
			<Muted>Seus dados serão protegidos e sincronizados com sua conta.</Muted>
			<View style={{ gap: 12 }}>
				<Field label="Nome" value={name} onChangeText={setName} />
				<Field
					label="E-mail"
					value={email}
					keyboardType="email-address"
					autoCapitalize="none"
					onChangeText={setEmail}
				/>
				<Field
					label="Senha"
					secureTextEntry
					value={password}
					onChangeText={setPassword}
				/>
				<Field
					label="Confirmar senha"
					secureTextEntry
					value={confirm}
					onChangeText={setConfirm}
				/>
				{error ? <Text style={{ color: theme.error }}>{error}</Text> : null}
				<Button title="Criar conta" onPress={submit} />
			</View>
		</Screen>
	);
}

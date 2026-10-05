import { formatNumber } from "@/lib/format";
import { router } from "expo-router";
import { View, useColorScheme } from "react-native";
import { HelperText, List, RadioButton, Text } from "react-native-paper";
import { ProfileAvatar } from "@/components/vitalis/avatar";
import {
	Button,
	Card,
	Eyebrow,
	Muted,
	Screen,
	Subtitle,
	Title,
} from "@/components/vitalis/ui";
import { useSubmit } from "@/hooks/use-submit";
import { calculateAge, calculateBmi, classifyBmi } from "@/lib/health";
import { useAppState } from "@/state/app-state";
export default function ProfileScreen() {
	const { state, dispatch, logout, lastError, biometrics, setBiometricLogin } = useAppState(),
		scheme = useColorScheme(),
		{ submit, saving, error } = useSubmit(),
		p = state.profile;
	const bmi =
		p.hasWeight === false || p.hasHeight === false
			? null
			: calculateBmi(p.weightKg, p.heightCm);
	const status =
		state.syncStatus === "offline"
			? "Offline · dados salvos no aparelho"
			: state.syncStatus === "syncing"
				? "Sincronizando…"
				: state.syncStatus === "pending"
					? "Salvo no aparelho · aguardando sincronização"
					: state.syncStatus === "error"
						? "Falha ao sincronizar · alterações preservadas"
						: "Dados sincronizados";
	return (
		<Screen>
			<Eyebrow>Perfil</Eyebrow>
			<View
				style={{
					flexDirection: "row",
					flexWrap: "wrap",
					alignItems: "center",
					gap: 16,
				}}
			>
				<ProfileAvatar profile={p} />
				<View style={{ flex: 1, minWidth: 180 }}>
					<Title>{p.name}</Title>
					<Text variant="bodyMedium">{p.email}</Text>
				</View>
			</View>
			<Muted>{status}</Muted>
			{lastError && <Muted>{lastError}</Muted>}
			<Button
				title="Editar perfil"
				icon="pencil"
				variant="outline"
				onPress={() => router.push("/profile/edit")}
			/>
			<Card>
				<List.Item
					title="Idade"
					description={
						p.birthDate
							? `${calculateAge(p.birthDate)} anos`
							: "Nascimento não informado"
					}
				/>
				<List.Item
					title="Peso"
					description={
						p.hasWeight === false
							? "Não informado"
							: `${formatNumber(p.weightKg, 1)} kg`
					}
				/>
				<List.Item
					title="Altura"
					description={
						p.hasHeight === false
							? "Não informada"
							: `${formatNumber(p.heightCm / 100, 2)} m`
					}
				/>
				<Subtitle>
					{bmi === null ? "IMC indisponível" : `IMC ${formatNumber(bmi, 1)}`}
				</Subtitle>
				<Muted>
					{bmi === null
						? "Complete peso e altura no perfil."
						: classifyBmi(bmi)}
				</Muted>
				<Button
					title="Ver evolução do peso"
					variant="text"
					onPress={() => router.push("/weight")}
				/>
			</Card>
			<Card>
				<Subtitle>Login por biometria</Subtitle>
				<Muted>
					{biometrics.enabled
						? "Ativado. Use sua digital para entrar ao iniciar o app. Sair da conta desativa esse acesso."
						: biometrics.available
							? "Use sua digital para entrar ao iniciar o app, sem digitar a senha."
							: "Cadastre uma digital nas configurações de segurança do celular para ativar."}
				</Muted>
				<Button
					title={biometrics.enabled ? "Desativar biometria" : "Ativar biometria"}
					icon="fingerprint"
					variant="outline"
					disabled={saving || (!biometrics.enabled && !biometrics.available)}
					onPress={() => submit(() => setBiometricLogin(!biometrics.enabled))}
				/>
				{error && <HelperText type="error" accessibilityLiveRegion="polite">{error}</HelperText>}
			</Card>
			<Card>
				<Subtitle>Aparência</Subtitle>
				<RadioButton.Group
					value={state.themeMode ?? (state.darkMode ? "dark" : "light")}
					onValueChange={(value) =>
						void dispatch({
							type: "SET_THEME",
							value: value as "system" | "light" | "dark",
							dark: value === "system" ? scheme === "dark" : value === "dark",
						})
					}
				>
					{[
						{ value: "system", label: "Usar tema do sistema" },
						{ value: "light", label: "Tema claro" },
						{ value: "dark", label: "Tema escuro" },
					].map((x) => (
						<RadioButton.Item key={x.value} {...x} style={{ minHeight: 48 }} />
					))}
				</RadioButton.Group>
			</Card>
			<Button
				title="Sair da conta"
				icon="logout"
				variant="danger"
				loading={saving}
				onPress={() =>
					submit(async () => {
						await logout();
						router.replace("/(auth)/login");
					})
				}
			/>
		</Screen>
	);
}

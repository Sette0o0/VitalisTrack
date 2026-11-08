import { useState } from "react";
import { useMeasurements } from "@/hooks/use-measurements";
import { formatNumber } from "@/lib/format";
import { router } from "expo-router";
import { View, useColorScheme } from "react-native";
import { HelperText, List, RadioButton, Text } from "react-native-paper";
import { ProfileAvatar } from "@/components/vitalis/avatar";
import {
	Button,
	Field,
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
	const {
			state,
			dispatch,
			logout,
			lastError,
			biometrics,
			setBiometricLogin,
			profiles,
			createProfile,
			selectProfile,
		} = useAppState(),
		scheme = useColorScheme(),
		{ submit, saving, error } = useSubmit(),
		p = state.profile;
	const measurements = useMeasurements();
	const [newName, setNewName] = useState("");
	const bmi =
		p.hasWeight === false || p.hasHeight === false ? null : calculateBmi(p.weightKg, p.heightCm);
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
 <Button title="Lembretes neste aparelho" variant="outline" onPress={()=>router.push("/profile/reminders")}/>
 <Button title="Amizades" variant="outline" onPress={()=>router.push("/profile/friends")}/>
			<Button title="Documentos médicos" variant="outline" onPress={()=>router.push("/profile/documents")}/>
 <Button title="Backup e limpeza" variant="outline" onPress={()=>router.push("/profile/data")}/>
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
				<Subtitle>Perfis de saúde</Subtitle>
				<RadioButton.Group
					value={state.profileId ?? state.userId ?? ""}
					onValueChange={(id) => void submit(() => selectProfile(id))}
				>
					{profiles.map((profile) => (
						<RadioButton.Item
							key={profile.id}
							value={profile.id}
							label={profile.name + (profile.isPrimary ? " · Principal" : "")}
							disabled={saving}
							style={{ minHeight: 48 }}
						/>
					))}
				</RadioButton.Group>
				<Field label="Nome do novo perfil" value={newName} onChangeText={setNewName} />
				<Button
					title="Cadastrar perfil"
					disabled={saving}
					onPress={() =>
						void submit(async () => {
							await createProfile(newName);
							setNewName("");
						})
					}
				/>
				{error && (
					<HelperText type="error" accessibilityLiveRegion="polite">
						{error}
					</HelperText>
				)}
			</Card>
			<Card>
				<Subtitle>Unidades de medida</Subtitle>
				<RadioButton.Group
					value={state.unitSystem ?? "metric"}
					onValueChange={(value) =>
						void submit(() => dispatch({ type: "UNITS", value: value as "metric" | "imperial" }))
					}
				>
					<RadioButton.Item value="metric" label="Métrico · kg, cm, km" style={{ minHeight: 48 }} />
					<RadioButton.Item
						value="imperial"
						label="Imperial · lb, in, mi"
						style={{ minHeight: 48 }}
					/>
				</RadioButton.Group>
				<Button
					title="Perfil nutricional"
					variant="outline"
					onPress={() => router.push("/profile/nutrition")}
				/>
				<Button
					title="Minhas receitas"
					variant="outline"
					onPress={() => router.push("/meals/recipes")}
				/>
			</Card>
			<Card>
				<List.Item
					title="Idade"
					description={
						p.birthDate ? `${calculateAge(p.birthDate)} anos` : "Nascimento não informado"
					}
				/>
				<List.Item
					title="Peso"
					description={
						p.hasWeight === false ? "Não informado" : measurements.weightText(p.weightKg)
					}
				/>
				<List.Item
					title="Altura"
					description={
						p.hasHeight === false
							? "Não informada"
							: `${formatNumber(measurements.height(p.heightCm), 2)} ${measurements.heightUnit}`
					}
				/>
				<Subtitle>{bmi === null ? "IMC indisponível" : `IMC ${formatNumber(bmi, 1)}`}</Subtitle>
				<Muted>{bmi === null ? "Complete peso e altura no perfil." : classifyBmi(bmi)}</Muted>
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
				{error && (
					<HelperText type="error" accessibilityLiveRegion="polite">
						{error}
					</HelperText>
				)}
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

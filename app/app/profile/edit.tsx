import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import {
	Button,
	Field,
	Header,
	Muted,
	Screen,
	Title,
} from "@/components/vitalis/ui";
import { radius, ThemeTokens } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppState } from "@/state/app-state";
import type { Gender } from "@/state/types";

export default function EditProfileScreen() {
	const theme = useAppTheme();
	const styles = useMemo(() => createStyles(theme), [theme]);
	const { state, dispatch, uploadAvatar } = useAppState();
	const p = state.profile;
	const [name, setName] = useState(p.name);
	const [birthDate, setBirthDate] = useState(p.birthDate);
	const [weight, setWeight] = useState(String(p.weightKg));
	const [height, setHeight] = useState(String(p.heightCm));
	const [gender, setGender] = useState<Gender>(p.gender);
	const [uploading, setUploading] = useState(false);
	const chooseAvatar = async () => {
		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ["images"],
			allowsEditing: true,
			aspect: [1, 1],
			quality: 0.8,
		});
		if (result.canceled) return;
		try {
			setUploading(true);
			await uploadAvatar(result.assets[0].uri, result.assets[0].mimeType);
		} catch (cause) {
			Alert.alert(
				"Falha no envio",
				cause instanceof Error
					? cause.message
					: "Não foi possível atualizar a foto.",
			);
		} finally {
			setUploading(false);
		}
	};
	const save = () => {
		const w = Number(weight),
			h = Number(height);
		if (
			!name.trim() ||
			!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) ||
			w <= 0 ||
			h <= 0
		)
			return Alert.alert(
				"Dados inválidos",
				"Revise nome, nascimento, peso e altura.",
			);
		dispatch({
			type: "PROFILE",
			value: {
				...p,
				name: name.trim(),
				birthDate,
				weightKg: w,
				heightCm: h,
				gender,
			},
		});
		router.back();
	};
	return (
		<Screen>
			<Header title="Editar perfil" onBack={() => router.back()} />
			<Title>Seus dados</Title>
			<Muted>A foto e os dados pessoais ficam associados à sua conta.</Muted>
			<Button
				title={uploading ? "Enviando foto…" : "Escolher foto"}
				variant="outline"
				onPress={() => void chooseAvatar()}
			/>
			<Field label="Nome" value={name} onChangeText={setName} />
			<Field label="E-mail (não editável)" value={p.email} editable={false} />
			<Field
				label="Nascimento (AAAA-MM-DD)"
				value={birthDate}
				onChangeText={setBirthDate}
			/>
			<View style={styles.row}>
				<View style={{ flex: 1 }}>
					<Field
						label="Peso (kg)"
						keyboardType="decimal-pad"
						value={weight}
						onChangeText={setWeight}
					/>
				</View>
				<View style={{ flex: 1 }}>
					<Field
						label="Altura (cm)"
						keyboardType="numeric"
						value={height}
						onChangeText={setHeight}
					/>
				</View>
			</View>
			<Text style={styles.label}>Gênero</Text>
			<View style={styles.segment}>
				{(["Feminino", "Masculino", "Outro"] as Gender[]).map((x) => (
					<Pressable
						key={x}
						onPress={() => setGender(x)}
						style={[styles.option, gender === x && styles.active]}
					>
						<Text
							style={{
								color: gender === x ? theme.onPrimary : theme.onSurface,
								fontWeight: "700",
								fontSize: 12,
							}}
						>
							{x}
						</Text>
					</Pressable>
				))}
			</View>
			<Button title="Salvar perfil" onPress={save} />
		</Screen>
	);
}
const createStyles = (theme: ThemeTokens) =>
	StyleSheet.create({
		row: { flexDirection: "row", gap: 10 },
		label: { color: theme.onSurfaceVariant, fontSize: 12, fontWeight: "700" },
		segment: {
			flexDirection: "row",
			borderWidth: 1,
			borderColor: theme.outline,
			borderRadius: radius.sm,
			overflow: "hidden",
		},
		option: { flex: 1, paddingVertical: 13, alignItems: "center" },
		active: { backgroundColor: theme.primary },
	});

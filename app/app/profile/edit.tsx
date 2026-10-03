import { profileUpdateSchema } from "@vitalis/contracts";
import { parseInput, parseDecimal } from "@/lib/validation";
import { useSubmit } from "@/hooks/use-submit";
import { HelperText, RadioButton, Text } from "react-native-paper";
import { DateField } from "@/components/vitalis/date-field";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
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
import { goBackOrReplace } from "@/lib/navigation";
import { useAppState } from "@/state/app-state";
import type { Gender } from "@/state/types";

export default function EditProfileScreen() {
	const theme = useAppTheme();
	const styles = useMemo(() => createStyles(theme), [theme]);
	const { submit, saving, error } = useSubmit();
	const { state, dispatch, uploadAvatar } = useAppState();
	const p = state.profile;
	const [name, setName] = useState(p.name);
	const [birthDate, setBirthDate] = useState(p.birthDate);
	const [weight, setWeight] = useState(
		p.hasWeight === false ? "" : String(p.weightKg),
	);
	const [height, setHeight] = useState(
		p.hasHeight === false ? "" : String(p.heightCm),
	);
	const [gender, setGender] = useState<Gender>(p.gender);
	const [uploading, setUploading] = useState(false);
	const chooseAvatar = () =>
		submit(async () => {
			try {
				setUploading(true);
				const result = await ImagePicker.launchImageLibraryAsync({
					mediaTypes: ["images"],
					allowsEditing: true,
					aspect: [1, 1],
					quality: 0.8,
				});
				if (!result.canceled)
					await uploadAvatar(result.assets[0].uri, result.assets[0].mimeType);
			} finally {
				setUploading(false);
			}
		});
	const save = () =>
		submit(async () => {
			const data = parseInput(profileUpdateSchema, {
				name: name.trim(),
				birthDate,
				weightKg: parseDecimal(weight),
				heightCm: parseDecimal(height),
				gender,
			});
			await dispatch({ type: "PROFILE", value: { ...p, ...data } });
			goBackOrReplace(router, "/(tabs)/profile");
		});
	return (
		<Screen>
			<Header
				title="Editar perfil"
				onBack={() => goBackOrReplace(router, "/(tabs)/profile")}
			/>
			<Title>Seus dados</Title>
			<Muted>A foto e os dados pessoais ficam associados à sua conta.</Muted>
			<Button
				title={uploading ? "Enviando foto…" : "Escolher foto"}
				variant="outline"
				disabled={saving}
				onPress={() => void chooseAvatar()}
			/>
			<Field label="Nome" value={name} onChangeText={setName} />
			<Field label="E-mail (não editável)" value={p.email} editable={false} />
			<DateField
				label="Nascimento"
				value={birthDate}
				onChange={setBirthDate}
				maximumDate={new Date()}
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
			<RadioButton.Group
				value={gender}
				onValueChange={(x) => setGender(x as Gender)}
			>
				{["Feminino", "Masculino", "Outro"].map((x) => (
					<RadioButton.Item
						key={x}
						value={x}
						label={x}
						style={{ minHeight: 48 }}
					/>
				))}
			</RadioButton.Group>
			<Button title="Salvar perfil" loading={saving} onPress={save} />
			{error ? (
				<HelperText type="error" accessibilityLiveRegion="polite">
					{error}
				</HelperText>
			) : null}
		</Screen>
	);
}
const createStyles = (theme: ThemeTokens) =>
	StyleSheet.create({
		row: { gap: 10 },
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

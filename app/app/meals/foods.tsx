import { UserFacingError } from "@/lib/user-error";
import { useEffect, useRef, useState } from "react";
import { Linking, View } from "react-native";
import { router } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { HelperText, RadioButton, Text } from "react-native-paper";
import { foodNutrition, type FoodProduct, mealInputSchema } from "@vitalis/contracts";
import { Button, Card, Field, Header, Screen, Subtitle, Muted } from "@/components/vitalis/ui";
import { useSubmit } from "@/hooks/use-submit";
import { useAppState } from "@/state/app-state";
import { apiRequest } from "@/lib/api";
import { cacheFoods, savedFoods } from "@/lib/food-cache";
import { formatNumber } from "@/lib/format";
import { parseDecimal, parseInput } from "@/lib/validation";
import { isoDate, newId } from "@/lib/health";
import { goBackOrReplace } from "@/lib/navigation";
const nutrientLabels = {
	calories: "Calorias (kcal)",
	proteins: "Proteínas (g)",
	carbohydrates: "Carboidratos (g)",
	fat: "Gorduras (g)",
};
export default function FoodsScreen() {
	const { state, dispatch } = useAppState(),
		{ submit, saving, error } = useSubmit();
	const [permission, requestPermission] = useCameraPermissions();
	const [query, setQuery] = useState(""),
		[code, setCode] = useState("");
	const [rows, setRows] = useState<FoodProduct[]>([]),
		[selected, setSelected] = useState<FoodProduct | null>(null);
	const [basis, setBasis] = useState<"g" | "mL" | "">(""),
		[quantity, setQuantity] = useState("100"),
		[manualCalories, setManualCalories] = useState("");
	const [scanning, setScanning] = useState(false),
		[message, setMessage] = useState("");
	const scanned = useRef(false),
		revision = useRef(0);
	useEffect(
		() => () => {
			revision.current++;
		},
		[],
	);
	useEffect(() => {
		const version = ++revision.current;
		const timer = setTimeout(
			() =>
				void savedFoods().then((foods) => {
					if (version === revision.current)
						setRows(
							foods.filter((p) =>
								p.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
							),
						);
				}),
			300,
		);
		return () => clearTimeout(timer);
	}, [query]);
	const choose = (product: FoodProduct) => {
		setSelected(product);
		setBasis(product.basisUnit ?? "");
		setManualCalories("");
		setQuantity("100");
	};
	const lookup = (barcode: string) =>
		submit(async () => {
			if (!/^\d{8,14}$/.test(barcode)) throw new UserFacingError("Informe um código com 8 a 14 dígitos.");
			const version = ++revision.current;
			const local = (await savedFoods()).find((p) => p.code === barcode);
			if (local) {
				if (version === revision.current) {
					choose(local);
					setMessage("Alimento salvo no aparelho.");
				}
				return;
			}
			const product = await apiRequest<FoodProduct | null>(
				`/v1/foods/${encodeURIComponent(barcode)}`,
				{},
				true,
				state.userId,
			);
			if (version !== revision.current) return;
			if (!product) {
				setSelected(null);
				setMessage("Produto não encontrado. Você pode registrar a refeição manualmente.");
				return;
			}
			await cacheFoods([product]);
			choose(product);
			setMessage("");
		});
	return (
		<Screen>
			<Header title="Buscar alimentos" onBack={() => goBackOrReplace(router, "/(tabs)/meals")} />
			<Field label="Nome do alimento" value={query} onChangeText={setQuery} />
			<Button
				title="Buscar online"
				loading={saving}
				onPress={() =>
					void submit(async () => {
						if (query.trim().length < 2) throw new UserFacingError("Digite ao menos dois caracteres.");
						const version = ++revision.current;
						const products = await apiRequest<FoodProduct[]>(
							`/v1/foods?q=${encodeURIComponent(query.trim())}`,
							{},
							true,
							state.userId,
						);
						if (version !== revision.current) return;
						await cacheFoods(products);
						setRows(products);
						setMessage(products.length ? "" : "Nenhum alimento encontrado.");
					})
				}
			/>
			<Field
				label="Código de barras"
				value={code}
				onChangeText={setCode}
				keyboardType="number-pad"
			/>
			<Button title="Consultar código" disabled={saving} onPress={() => void lookup(code.trim())} />
			<Button
				title="Escanear código de barras"
				variant="outline"
				disabled={saving}
				onPress={() =>
					void submit(async () => {
						const allowed = permission?.granted ? permission : await requestPermission();
						if (!allowed.granted)
							throw new UserFacingError(
								"Câmera não autorizada. Digite o código ou permita o acesso nas configurações do aparelho.",
							);
						scanned.current = false;
						setScanning(true);
					})
				}
			/>
			{scanning && (
				<View style={{ height: 260, gap: 8 }}>
					<CameraView
						style={{ flex: 1 }}
						barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e"] }}
						onBarcodeScanned={({ data }) => {
							if (scanned.current) return;
							scanned.current = true;
							setScanning(false);
							setCode(data);
							void lookup(data);
						}}
					/>
					<Button title="Fechar câmera" variant="text" onPress={() => setScanning(false)} />
				</View>
			)}
			{message && <Muted>{message}</Muted>}
			{error && (
				<HelperText type="error" accessibilityLiveRegion="polite">
					{error}
				</HelperText>
			)}
			{selected && (
				<Card>
					<Subtitle>{selected.name}</Subtitle>
					<Muted>{selected.brand ?? "Marca não informada"}</Muted>
					<Text>Informações por 100 {selected.basisUnit ?? "g ou mL — confirme no rótulo"}</Text>
					{(Object.keys(nutrientLabels) as (keyof typeof nutrientLabels)[]).map((key) => (
						<Text key={key}>
							{nutrientLabels[key]}:{" "}
							{selected.values[key] == null
								? "Não informado"
								: formatNumber(selected.values[key]!, 1)}
						</Text>
					))}
					{!selected.basisUnit && (
						<>
							<Muted>Confirme a unidade de referência no rótulo antes de adicionar.</Muted>
							<RadioButton.Group value={basis} onValueChange={(v) => setBasis(v as "g" | "mL")}>
								<RadioButton.Item label="Por 100 g" value="g" style={{ minHeight: 48 }} />
								<RadioButton.Item label="Por 100 mL" value="mL" style={{ minHeight: 48 }} />
							</RadioButton.Group>
						</>
					)}
					<Field
						label={`Quantidade consumida (${basis || "g ou mL"})`}
						value={quantity}
						onChangeText={setQuantity}
						keyboardType="decimal-pad"
					/>
					{selected.values.calories == null && (
						<Field
							label="Calorias da quantidade consumida (kcal)"
							value={manualCalories}
							onChangeText={setManualCalories}
							keyboardType="decimal-pad"
						/>
					)}
					<Button
						title="Adicionar ao diário"
						loading={saving}
						onPress={() =>
							void submit(async () => {
								if (!basis) throw new UserFacingError("Confirme a unidade de referência no rótulo.");
								const amount = parseDecimal(quantity),
									values = foodNutrition({ ...selected, basisUnit: basis }, amount, basis);
								const calories = values.calories ?? parseDecimal(manualCalories);
								const now = new Date();
								const input = parseInput(mealInputSchema, {
									id: newId(),
									name: selected.name,
									date: isoDate(),
									time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
									quantity: amount,
									unit: basis,
									calories: Math.round(calories),
									nutrition: {
										source: "openfoodfacts",
										code: selected.code,
										basisUnit: basis,
										values,
									},
								});
								await dispatch({ type: "MEAL_SAVE", value: input });
								goBackOrReplace(router, "/(tabs)/meals");
							})
						}
					/>
				</Card>
			)}
			{rows.map((product) => (
				<Button
					key={product.code}
					title={product.name}
					variant="outline"
					onPress={() => choose(product)}
				/>
			))}
			<Button
				title="Registrar refeição manualmente"
				variant="text"
				onPress={() => router.push("/meals/form")}
			/>
			<Text
				onPress={() => void Linking.openURL("https://world.openfoodfacts.org")}
				accessibilityRole="link"
			>
				Dados: Open Food Facts · ODbL
			</Text>
		</Screen>
	);
}

import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";
import { useAppState } from "@/state/app-state";
import { initialState } from "@/state/reducer";
import NutritionScreen from "@/app/profile/nutrition";
import RecipesScreen from "@/app/meals/recipes";
import FoodsScreen from "@/app/meals/foods";
import EditProfile from "@/app/profile/edit";
import WeightScreen from "@/app/weight";
import { isoDate } from "@/lib/health";
import { apiRequest } from "@/lib/api";
import { savedFoods } from "@/lib/food-cache";
import { toDisplayHeight, toDisplayWeight, type FoodProduct } from "@vitalis/contracts";
import { decimalInput } from "@/lib/format";
const mockPermission = jest.fn(async () => ({ granted: false }));
jest.mock("expo-camera", () => ({
	CameraView: "CameraView",
	useCameraPermissions: () => [{ granted: false }, mockPermission],
}));
jest.mock("@/state/app-state", () => ({ useAppState: jest.fn() }));
jest.mock("@/lib/api", () => ({ apiRequest: jest.fn() }));
jest.mock("@/lib/food-cache", () => ({
	savedFoods: jest.fn(async () => []),
	cacheFoods: jest.fn(async () => {}),
}));
jest.mock("expo-router", () => ({
	router: { replace: jest.fn(), push: jest.fn(), canGoBack: () => false },
}));
jest.mock(
	"react-native-safe-area-context",
	() => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);
const dispatch = jest.fn(async () => {});
const product: FoodProduct = {
	code: "12345678",
	name: "Produto QA",
	brand: null,
	basisUnit: "g",
	source: "openfoodfacts",
	fetchedAt: "2026-10-26T12:00:00Z",
	values: { calories: 200, proteins: 10, carbohydrates: null, fat: 2 },
};
beforeEach(() => {
	jest.clearAllMocks();
	(savedFoods as jest.Mock).mockResolvedValue([]);
	(useAppState as jest.Mock).mockReturnValue({
		state: {
			...initialState,
			userId: "account",
			profileId: "profile",
			profile: { ...initialState.profile, name: "Familiar" },
		},
		dispatch,
	});
});
test("perfil nutricional salva objetivo e listas sem depender da conexão", async () => {
	const ui = render(
		<PaperProvider>
			<NutritionScreen />
		</PaperProvider>,
	);
	fireEvent.press(ui.getByRole("radio", { name: "Ganhar peso" }));
	fireEvent.changeText(ui.getByLabelText("Restrições alimentares"), "lactose\n amendoim ");
	fireEvent.changeText(ui.getByLabelText("Preferências alimentares"), "arroz,feijão");
	fireEvent.press(ui.getByRole("button", { name: "Salvar perfil nutricional" }));
	await waitFor(() =>
		expect(dispatch).toHaveBeenCalledWith({
			type: "NUTRITION",
			value: expect.objectContaining({
				objective: "gain",
				restrictions: ["lactose", "amendoim"],
				preferences: ["arroz", "feijão"],
			}),
		}),
	);
});
test("receita própria valida campos e preserva nutrientes ausentes", async () => {
	const ui = render(
		<PaperProvider>
			<RecipesScreen />
		</PaperProvider>,
	);
	fireEvent.press(ui.getByRole("button", { name: "Cadastrar receita" }));
	fireEvent.press(ui.getByRole("button", { name: "Salvar receita" }));
	await waitFor(() => expect(ui.getByText(/Nome: valor inválido/)).toBeTruthy());
	expect(dispatch).not.toHaveBeenCalled();
	for (const [label, value] of [
		["Nome da receita", "Arroz"],
		["Ingredientes", "Arroz e água"],
		["Modo de preparo", "Cozinhar"],
		["Calorias (kcal)", "123,5"],
	])
		fireEvent.changeText(ui.getByLabelText(label), value);
	fireEvent.press(ui.getByRole("button", { name: "Salvar receita" }));
	await waitFor(() =>
		expect(dispatch).toHaveBeenCalledWith({
			type: "RECIPE_SAVE",
			value: expect.objectContaining({
				name: "Arroz",
				nutrition: { calories: 123.5, proteins: null, carbohydrates: null, fat: null },
			}),
		}),
	);
});
test("alimento salvo fica disponível offline e gera snapshot da quantidade", async () => {
	(savedFoods as jest.Mock).mockResolvedValue([product]);
	const ui = render(
		<PaperProvider>
			<FoodsScreen />
		</PaperProvider>,
	);
	await waitFor(() => expect(ui.getByRole("button", { name: "Produto QA" })).toBeTruthy());
	fireEvent.press(ui.getByRole("button", { name: "Produto QA" }));
	fireEvent.changeText(ui.getByLabelText("Quantidade consumida (g)"), "50");
	fireEvent.press(ui.getByRole("button", { name: "Adicionar ao diário" }));
	await waitFor(() =>
		expect(dispatch).toHaveBeenCalledWith({
			type: "MEAL_SAVE",
			value: expect.objectContaining({
				quantity: 50,
				unit: "g",
				calories: 100,
				nutrition: {
					source: "openfoodfacts",
					code: "12345678",
					basisUnit: "g",
					values: { calories: 100, proteins: 5, carbohydrates: null, fat: 1 },
				},
			}),
		}),
	);
	expect(apiRequest).not.toHaveBeenCalled();
});
test("base ambígua exige confirmação e câmera negada mantém alternativa manual", async () => {
	(savedFoods as jest.Mock).mockResolvedValue([{ ...product, basisUnit: null }]);
	const ui = render(
		<PaperProvider>
			<FoodsScreen />
		</PaperProvider>,
	);
	await waitFor(() => expect(ui.getByRole("button", { name: "Produto QA" })).toBeTruthy());
	fireEvent.press(ui.getByRole("button", { name: "Produto QA" }));
	fireEvent.press(ui.getByRole("button", { name: "Adicionar ao diário" }));
	await waitFor(() =>
		expect(ui.getByText("Confirme a unidade de referência no rótulo.")).toBeTruthy(),
	);
	expect(dispatch).not.toHaveBeenCalled();
	fireEvent.press(ui.getByRole("button", { name: "Escanear código de barras" }));
	await waitFor(() => expect(ui.getByText(/Câmera não autorizada/)).toBeTruthy());
	expect(ui.getByLabelText("Código de barras")).toBeTruthy();
});
test("catálogo indisponível mostra erro sem impedir cadastro manual", async () => {
	(apiRequest as jest.Mock).mockRejectedValue({status:503,code:"FOOD_UNAVAILABLE"});
	const ui = render(
		<PaperProvider>
			<FoodsScreen />
		</PaperProvider>,
	);
	fireEvent.changeText(ui.getByLabelText("Nome do alimento"), "arroz");
	await act(async () => {});
	fireEvent.press(ui.getByRole("button", { name: "Buscar online" }));
	await waitFor(() => expect(ui.getByText("Catálogo temporariamente indisponível. Tente novamente mais tarde.")).toBeTruthy());
	expect(ui.getByRole("button", { name: "Registrar refeição manualmente" })).toBeTruthy();
});
test("salvar perfil em imperial sem editar conserva as medidas canônicas", async () => {
	(useAppState as jest.Mock).mockReturnValue({
		state: {
			...initialState,
			unitSystem: "imperial",
			profile: {
				...initialState.profile,
				name: "Familiar",
				birthDate: "1990-01-01",
				weightKg: 68.423456,
				heightCm: 170.54321,
				hasWeight: true,
				hasHeight: true,
			},
		},
		dispatch,
	});
	const ui = render(
		<PaperProvider>
			<EditProfile />
		</PaperProvider>,
	);
	expect(ui.getByLabelText("Peso (lb)").props.value).toBe(
		decimalInput(toDisplayWeight(68.423456, "imperial")),
	);
	expect(ui.getByLabelText("Altura (in)").props.value).toBe(
		decimalInput(toDisplayHeight(170.54321, "imperial")),
	);
	fireEvent.press(ui.getByRole("button", { name: "Salvar perfil" }));
	await waitFor(() =>
		expect(dispatch).toHaveBeenCalledWith({
			type: "PROFILE",
			value: expect.objectContaining({ weightKg: 68.423456, heightCm: 170.54321 }),
		}),
	);
});

test("comparação de peso imperial converte variação e descrições acessíveis", () => {
	const today = new Date(),
		previous = new Date(today);
	previous.setDate(previous.getDate() - 7);
	(useAppState as jest.Mock).mockReturnValue({
		state: {
			...initialState,
			unitSystem: "imperial",
			weights: [
				{ id: "current", date: isoDate(today), weightKg: 70 },
				{ id: "previous", date: isoDate(previous), weightKg: 69 },
			],
		},
		dispatch,
	});
	const ui = render(
		<PaperProvider>
			<WeightScreen />
		</PaperProvider>,
	);
	expect(ui.getByText("Variação: 2,2 lb")).toBeTruthy();
	expect(ui.getByLabelText("154,3 lb")).toBeTruthy();
	expect(ui.queryByText(/Variação:.*kg/)).toBeNull();
});

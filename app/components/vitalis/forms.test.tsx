import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";
import { initialState } from "@/state/reducer";
import RegisterScreen from "@/app/(auth)/register";
import LoginScreen from "@/app/(auth)/login";
import WaterScreen from "@/app/water";
import MealForm from "@/app/meals/form";
import { useAppState } from "@/state/app-state";

jest.mock("@/state/app-state", () => ({
	useAppState: jest.fn(),
	useDailySummary: () => ({ water: 0, waterProgress: 0 }),
}));
jest.mock("expo-router", () => ({
	router: { replace: jest.fn(), canGoBack: () => false },
	useLocalSearchParams: () => ({}),
}));
jest.mock(
	"react-native-safe-area-context",
	() => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);
const dispatch = jest.fn(async () => {}),
	register = jest.fn(async () => {}),
	login = jest.fn(async () => {});
beforeEach(() => {
	jest.clearAllMocks();
	(useAppState as jest.Mock).mockReturnValue({
		state: initialState,
		dispatch,
		register,
		login,
	});
});
test("login inicia vazio e valida o e-mail antes de enviar as credenciais", async () => {
	const ui = render(
		<PaperProvider>
			<LoginScreen />
		</PaperProvider>,
	);
	expect(ui.getByLabelText("E-mail").props.value).toBe("");
	fireEvent.changeText(ui.getByLabelText("E-mail"), "invalido");
	fireEvent.changeText(ui.getByLabelText("Senha"), "12345678");
	fireEvent.press(ui.getByRole("button", { name: "Entrar" }));
	await waitFor(() =>
		expect(ui.getByText(/E-mail: valor inválido/)).toBeTruthy(),
	);
	expect(login).not.toHaveBeenCalled();
	fireEvent.changeText(ui.getByLabelText("E-mail"), "PESSOA@example.com");
	fireEvent.press(ui.getByRole("button", { name: "Entrar" }));
	await waitFor(() =>
		expect(login).toHaveBeenCalledWith("pessoa@example.com", "12345678"),
	);
});
test("cadastro inicia vazio, anuncia erro e envia uma única solicitação válida", async () => {
	const ui = render(
		<PaperProvider>
			<RegisterScreen />
		</PaperProvider>,
	);
	expect(ui.getByLabelText("E-mail").props.value).toBe("");
	fireEvent.press(ui.getByRole("button", { name: "Criar conta" }));
	await waitFor(() =>
		expect(ui.getByText(/Nome: valor inválido/)).toBeTruthy(),
	);
	expect(register).not.toHaveBeenCalled();
	for (const [label, value] of [
		["Nome", "Pessoa Teste"],
		["E-mail", "PESSOA@example.com"],
		["Senha", "12345678"],
		["Confirmar senha", "12345678"],
	])
		fireEvent.changeText(ui.getByLabelText(label), value);
	fireEvent.press(ui.getByRole("button", { name: "Criar conta" }));
	await waitFor(() =>
		expect(register).toHaveBeenCalledWith(
			"Pessoa Teste",
			"pessoa@example.com",
			"12345678",
			"12345678",
		),
	);
});
test("alimento usa vírgula decimal e rejeita quantidade zero", async () => {
	const ui = render(
		<PaperProvider>
			<MealForm />
		</PaperProvider>,
	);
	fireEvent.changeText(ui.getByLabelText("Alimento ou refeição"), "Café");
	fireEvent.changeText(ui.getByLabelText("Quantidade"), "0");
	fireEvent.changeText(ui.getByLabelText("Calorias (kcal)"), "80");
	fireEvent.press(ui.getByRole("button", { name: "Salvar refeição" }));
	await waitFor(() =>
		expect(ui.getByText(/Quantidade: valor inválido/)).toBeTruthy(),
	);
	expect(dispatch).not.toHaveBeenCalled();
	fireEvent.changeText(ui.getByLabelText("Quantidade"), "100,5");
	fireEvent.press(ui.getByRole("button", { name: "Salvar refeição" }));
	await waitFor(() =>
		expect(dispatch).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "MEAL_SAVE",
				value: expect.objectContaining({ quantity: 100.5, calories: 80 }),
			}),
		),
	);
});

test("atalhos de água registram 200, 500 e 1.000 mL", async () => {
	const ui = render(
		<PaperProvider>
			<WaterScreen />
		</PaperProvider>,
	);
	for (const [label, amountMl] of [
		["200 mL", 200],
		["500 mL", 500],
		["1 L", 1000],
	] as const) {
		fireEvent.press(ui.getByRole("button", { name: label }));
		await waitFor(() =>
			expect(dispatch).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "WATER_ADD",
					value: expect.objectContaining({ amountMl }),
				}),
			),
		);
	}
});

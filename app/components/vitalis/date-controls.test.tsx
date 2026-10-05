import { useState } from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { DateRangeFilter } from "./date-range-filter";
import { BirthDateField } from "./birth-date-field";
import EditProfileScreen from "@/app/profile/edit";
import MealsScreen from "@/app/(tabs)/meals";
import { useAppState } from "@/state/app-state";
import { initialState } from "@/state/reducer";
import { isoDate } from "@/lib/health";
import { recentDateRange, type DateRange } from "@/lib/date-filter";

jest.mock("@react-native-community/datetimepicker", () => ({
	DateTimePickerAndroid: { open: jest.fn() },
}));
jest.mock("@/state/app-state", () => ({
	useAppState: jest.fn(),
	useDailySummary: () => ({ calories: 80, calorieProgress: 0.04 }),
}));
jest.mock("expo-router", () => ({ router: { replace: jest.fn(), canGoBack: () => false } }));
jest.mock("react-native-safe-area-context", () =>
	jest.requireActual("react-native-safe-area-context/jest/mock").default);
const dispatch = jest.fn(async () => {});
beforeEach(() => {
	jest.clearAllMocks();
	(useAppState as jest.Mock).mockReturnValue({
		state: { ...initialState, profile: {
			...initialState.profile, name: "Pessoa Teste", email: "pessoa@example.com",
			hasWeight: true, hasHeight: true,
		} },
		dispatch,
	});
});
async function mount(children: React.ReactNode) {
	const ui = render(<PaperProvider>{children}</PaperProvider>);
	await act(async () => {});
	return ui;
}
function chooseDate(ui: Awaited<ReturnType<typeof mount>>, label: string, value: string) {
	fireEvent.press(ui.getByRole("button", { name: label }));
	const options = (DateTimePickerAndroid.open as jest.Mock).mock.calls.at(-1)![0];
	act(() => options.onChange({ type: "set" }, new Date(`${value}T12:00:00`)));
}

test("intervalo invertido bloqueia aplicação; extremidades válidas são aplicadas", async () => {
	const onChange = jest.fn();
	const ui = await mount(<DateRangeFilter value={{ start: "2026-04-02", end: "2026-04-08" }} onChange={onChange} />);
	fireEvent.press(ui.getByTestId("date-range-customize"));
	chooseDate(ui, "Data inicial", "2026-04-09");
	expect(ui.getByText("A data final deve ser igual ou posterior à inicial.")).toBeTruthy();
	fireEvent.press(ui.getByRole("button", { name: "Aplicar filtro" }));
	expect(onChange).not.toHaveBeenCalled();
	chooseDate(ui, "Data final", "2026-04-12");
	fireEvent.press(ui.getByRole("button", { name: "Aplicar filtro" }));
	expect(onChange).toHaveBeenCalledWith({ start: "2026-04-09", end: "2026-04-12" });
});
test("um dia define início e fim iguais, e cancelar não aplica o rascunho", async () => {
	const onChange = jest.fn();
	const ui = await mount(<DateRangeFilter value={recentDateRange(7)} onChange={onChange} />);
	fireEvent.press(ui.getByTestId("date-range-customize"));
	fireEvent.press(ui.getByRole("button", { name: "Um dia" }));
	chooseDate(ui, "Dia específico", "2006-04-08");
	fireEvent.press(ui.getByRole("button", { name: "Cancelar" }));
	expect(onChange).not.toHaveBeenCalled();
	fireEvent.press(ui.getByTestId("date-range-customize"));
	fireEvent.press(ui.getByRole("button", { name: "Um dia" }));
	chooseDate(ui, "Dia específico", "2026-04-08");
	fireEvent.press(ui.getByRole("button", { name: "Aplicar filtro" }));
	expect(onChange).toHaveBeenCalledWith({ start: "2026-04-08", end: "2026-04-08" });
});
test("atalhos mudam o período e todas as datas limpa o filtro", async () => {
	const onChange = jest.fn();
	function Harness() {
		const [range, setRange] = useState<DateRange | null>(recentDateRange(7));
		return <DateRangeFilter value={range} onChange={(next) => { onChange(next); setRange(next); }} />;
	}
	const ui = await mount(<Harness />);
	fireEvent.press(ui.getByRole("button", { name: "Hoje" }));
	expect(onChange).toHaveBeenLastCalledWith({ start: isoDate(), end: isoDate() });
	fireEvent.press(ui.getByRole("button", { name: "30 dias" }));
	expect(onChange).toHaveBeenLastCalledWith(recentDateRange(30));
	fireEvent.press(ui.getByRole("button", { name: "Todas as datas" }));
	expect(onChange).toHaveBeenLastCalledWith(null);
});
test("nascimento oferece seleção de ano separada e cancelar preserva o valor", async () => {
	const onChange = jest.fn();
	const ui = await mount(<BirthDateField value="2006-04-08" onChange={onChange} />);
	fireEvent.press(ui.getByRole("button", { name: "Selecionar dia, mês e ano de nascimento" }));
	const options = (DateTimePickerAndroid.open as jest.Mock).mock.calls[0][0];
	expect(options.display).toBe("spinner");
	expect(options.value.getFullYear()).toBe(2006);
	act(() => options.onChange({ type: "dismissed" }, new Date(2000, 0, 1)));
	expect(onChange).not.toHaveBeenCalled();
});
test("digitar nascimento antigo salva ISO; data impossível não salva o valor anterior", async () => {
	const ui = await mount(<EditProfileScreen />);
	const field = ui.getByLabelText("Nascimento (dd/mm/aaaa)");
	fireEvent.changeText(field, "31022000");
	expect(ui.getByText("Informe uma data válida em dd/mm/aaaa.")).toBeTruthy();
	fireEvent.press(ui.getByRole("button", { name: "Salvar perfil" }));
	await waitFor(() => expect(ui.getByText(/Nascimento: valor inválido/)).toBeTruthy());
	expect(dispatch).not.toHaveBeenCalled();
	fireEvent.changeText(field, "08042000");
	expect(ui.getByLabelText("Nascimento (dd/mm/aaaa)").props.value).toBe("08/04/2000");
	fireEvent.press(ui.getByRole("button", { name: "Salvar perfil" }));
	await waitFor(() => expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
		type: "PROFILE", value: expect.objectContaining({ birthDate: "2000-04-08" }),
	})));
});
test("refeições filtradas não alteram o resumo de hoje nem a ordem armazenada", async () => {
	const meals = [
		{ id: "old", name: "Antiga", date: "2020-04-08", time: "08:00", quantity: 100, unit: "g", calories: 200 },
		{ id: "today", name: "Hoje", date: isoDate(), time: "09:00", quantity: 100, unit: "g", calories: 80 },
	];
	(useAppState as jest.Mock).mockReturnValue({ state: { ...initialState, meals }, dispatch });
	const ui = await mount(<MealsScreen />);
	expect(ui.queryByText("Antiga")).toBeNull();
	fireEvent.press(ui.getByRole("button", { name: "Todas as datas" }));
	expect(ui.getByText("Antiga")).toBeTruthy();
	expect(ui.getByText("Resumo de hoje")).toBeTruthy();
	expect(ui.getByText(/consumidas 80/)).toBeTruthy();
	expect(meals.map((meal) => meal.id)).toEqual(["old", "today"]);
});

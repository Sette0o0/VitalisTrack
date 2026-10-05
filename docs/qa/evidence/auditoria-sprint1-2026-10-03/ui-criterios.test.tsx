import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useAppState } from "@/state/app-state";
import { initialState } from "@/state/reducer";
import { selectDailySummary, selectProgressSummary } from "@/state/selectors";
import { isoDate } from "@/lib/health";
import ProgressScreen from "@/app/(tabs)/progress";
import MealsScreen from "@/app/(tabs)/meals";

jest.mock("@/state/app-state", () => ({
  useAppState: jest.fn(),
  useDailySummary: () => {
    const selectors = jest.requireActual("@/state/selectors");
    return selectors.selectDailySummary(jest.requireMock("@/state/app-state").useAppState().state);
  },
  useProgress: (period: string) => {
    const selectors = jest.requireActual("@/state/selectors");
    return selectors.selectProgressSummary(jest.requireMock("@/state/app-state").useAppState().state, period);
  },
}));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);
const dispatch = jest.fn(async () => {});
beforeEach(() => {
  jest.clearAllMocks();
  (useAppState as jest.Mock).mockReturnValue({ state: initialState, dispatch });
});
test("US-022.C6: aviso aparece acima do limite e desaparece no limite", async () => {
  const meal = { id: "qa", name: "Almoço QA", date: isoDate(), time: "12:00", quantity: 100, unit: "g", calories: 701 };
  (useAppState as jest.Mock).mockReturnValue({ state: { ...initialState, meals: [meal] }, dispatch });
  const ui = render(<PaperProvider><MealsScreen /></PaperProvider>);
  await act(async () => {});
  expect(ui.getByText("Esta refeição excedeu o limite de 700 kcal.")).toBeTruthy();
  (useAppState as jest.Mock).mockReturnValue({ state: { ...initialState, meals: [{ ...meal, calories: 700 }] }, dispatch });
  ui.rerender(<PaperProvider><MealsScreen /></PaperProvider>);
  expect(ui.queryByText(/Esta refeição excedeu/)).toBeNull();
});
test("US-022.C1/C5: metas de calorias e limite por refeição podem ser enviados", async () => {
  const ui = render(<PaperProvider><MealsScreen /></PaperProvider>);
  await act(async () => {});
  fireEvent.press(ui.getByRole("button", { name: "Configurar metas" }));
  fireEvent.changeText(ui.getByLabelText("Meta diária (kcal)"), "2300");
  fireEvent.changeText(ui.getByLabelText("Limite por refeição (kcal)"), "600");
  fireEvent.press(ui.getByRole("button", { name: "Salvar metas" }));
  await waitFor(() => expect(dispatch).toHaveBeenCalledWith({ type: "GOALS", value: { calories: 2300, mealCalories: 600 } }));
});
test.each(["up", "down"])("US-031.C6: tendência %s deve mostrar uma seta", async (direction) => {
  const steps = direction === "up" ? [7000, 3500] : [3500, 7000];
  const previous = new Date(`${isoDate()}T12:00:00`);
  previous.setDate(previous.getDate() - 7);
  (useAppState as jest.Mock).mockReturnValue({ state: {
    ...initialState, dailySteps: [{ date: isoDate(), steps: steps[0] }, { date: isoDate(previous), steps: steps[1] }],
  }, dispatch });
  const ui = render(<PaperProvider><ProgressScreen /></PaperProvider>);
  await act(async () => {});
  expect(ui.getByText(direction === "up" ? /Em crescimento/ : /Em queda/)).toBeTruthy();
  const names = ui.UNSAFE_queryAllByType(MaterialCommunityIcons).map(node => String(node.props.name));
  const arrowPattern = direction === "up" ? /arrow.*up|trending-up/ : /arrow.*down|trending-down/;
  const textualArrow = direction === "up" ? /[↑↗⬆]/ : /[↓↘⬇]/;
  expect(names.some(name => arrowPattern.test(name)) || ui.queryAllByText(textualArrow).length > 0).toBe(true);
});

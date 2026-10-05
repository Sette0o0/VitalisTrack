import { act, fireEvent, render } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";
import EditProfileScreen from "@/app/profile/edit";
import { useAppState } from "@/state/app-state";
import { initialState } from "@/state/reducer";
jest.mock("@/state/app-state", () => ({ useAppState: jest.fn() }));
jest.mock("expo-router", () => ({ router: { replace: jest.fn(), canGoBack: () => false } }));
jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);
const dispatch = jest.fn(async () => {});
afterEach(() => jest.useRealTimers());
test("US-016.C3: nascimento de amanhã não pode ser salvo depois das 21h no Brasil", async () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-10-04T00:30:00Z"));
  expect(new Date().getDate()).toBe(3); // Executar com TZ=America/Sao_Paulo.
  (useAppState as jest.Mock).mockReturnValue({ state: { ...initialState, profile: {
    ...initialState.profile, name: "Pessoa QA", email: "qa@example.com", birthDate: "2000-01-01", hasWeight: true, hasHeight: true,
  } }, dispatch });
  const ui = render(<PaperProvider><EditProfileScreen /></PaperProvider>);
  await act(async () => {});
  fireEvent.changeText(ui.getByLabelText("Nascimento (dd/mm/aaaa)"), "04102026");
  expect(ui.getByText("Nascimento não pode estar no futuro.")).toBeTruthy();
  await act(async () => fireEvent.press(ui.getByRole("button", { name: "Salvar perfil" })));
  expect(dispatch).not.toHaveBeenCalled();
});

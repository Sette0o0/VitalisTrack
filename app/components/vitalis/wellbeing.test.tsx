import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";
import StepsGoal from "@/app/activities/steps";
import Form from "@/app/wellbeing/form";
import { initialState as mockInitialState } from "@/state/reducer";
let mockKind = "sleep";
const mockSave = jest.fn(async () => {});
const mockBack = jest.fn();
const mockDispatch=jest.fn(async()=>{});
jest.mock("expo-router", () => ({
  router: { back: () => mockBack() },
  useLocalSearchParams: () => ({ kind: mockKind }),
}));
jest.mock("@/state/app-state", () => ({
  useAppState: () => ({
    dispatch:mockDispatch,
    state: {
      ...mockInitialState,
      userId: "a",
      profileId: "a",
      authenticated: true,
    },
  }),
}));
jest.mock("@/hooks/use-wellbeing", () => ({
  useWellbeing: () => ({ save: mockSave }),
}));
jest.mock("@/lib/wellbeing-store", () => ({ getWellbeing: jest.fn() }));
jest.mock("@/components/vitalis/date-field", () => ({
  DateField: () => null,
  TimeField: () => null,
}));
const screen = () =>
  render(
    <PaperProvider>
      <Form />
    </PaperProvider>,
  );
beforeEach(() => {
  mockSave.mockClear();
  mockBack.mockClear();
});
test("sleep form converts hours/minutes and waits for a committed save before navigation", async () => {
  mockKind = "sleep";
  const s = screen();
  fireEvent.changeText(s.getByLabelText("Horas dormidas"), "7");
  fireEvent.changeText(s.getByLabelText("Minutos adicionais"), "30");
  fireEvent.press(s.getByLabelText("Salvar registro"));
  await waitFor(() =>
    expect(mockSave).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "sleep",
        data: expect.objectContaining({ durationMinutes: 450 }),
      }),
    ),
  );
  expect(mockBack).toHaveBeenCalled();
});
test("pressure rejects swapped readings and saves valid values without clinical advice", async () => {
  mockKind = "bloodPressure";
  const s = screen();
  fireEvent.changeText(s.getByLabelText("Pressão sistólica (mmHg)"), "80");
  fireEvent.changeText(s.getByLabelText("Pressão diastólica (mmHg)"), "120");
  fireEvent.press(s.getByLabelText("Salvar registro"));
  await waitFor(() =>
    expect(
      s.getByText("A sistólica deve ser maior que a diastólica"),
    ).toBeTruthy(),
  );
  expect(mockSave).not.toHaveBeenCalled();
  fireEvent.changeText(s.getByLabelText("Pressão sistólica (mmHg)"), "120");
  fireEvent.changeText(s.getByLabelText("Pressão diastólica (mmHg)"), "80");
  fireEvent.press(s.getByLabelText("Salvar registro"));
  await waitFor(() =>
    expect(mockSave).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "bloodPressure",
        data: expect.objectContaining({ systolic: 120, diastolic: 80 }),
      }),
    ),
  );
});
test("medication preserves supplied dosage and weekly schedule", async () => {
  mockKind = "medication";
  const s = screen();
  fireEvent.changeText(s.getByLabelText("Nome do medicamento"), "QA Medicação");
  fireEvent.changeText(
    s.getByLabelText("Dosagem informada"),
    "Conforme cadastro",
  );
  fireEvent.press(s.getByLabelText("Salvar registro"));
  await waitFor(() =>
    expect(mockSave).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "medication",
        data: expect.objectContaining({
          name: "QA Medicação",
          dosage: "Conforme cadastro",
          times: ["08:00"],
          enabled: true,
        }),
      }),
    ),
  );
});

test("step goals accept Brazilian thousands without shrinking the target",async()=>{
 const ui=render(<PaperProvider><StepsGoal/></PaperProvider>);
 fireEvent.changeText(ui.getByLabelText("Meta em passos"),"12.000");
 fireEvent.press(ui.getByLabelText("Salvar meta de passos"));
 await waitFor(()=>expect(mockDispatch).toHaveBeenCalledWith({type:"GOALS",value:{steps:12000}}));
});

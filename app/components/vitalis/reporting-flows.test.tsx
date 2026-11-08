import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";
import Reports from "@/app/reports/index";
import Timeline from "@/app/reports/timeline";
import Documents from "@/app/profile/documents";
import Data from "@/app/profile/data";
import { initialState } from "@/state/reducer";
import { buildHealthReport } from "@vitalis/contracts";
import { readReport, listTimeline } from "@/lib/report-store";
import { exportPdf } from "@/lib/exports";
import { executeCleanup, previewCleanup } from "@/lib/retention";
import { importDocument } from "@/lib/document-files";
import * as Picker from "expo-document-picker";
let mockState = { ...initialState, userId: "owner", profileId: "profile", authenticated: true };
const mockConfirm = jest.fn(), mockSync = jest.fn(async () => {}), mockRun = jest.fn(async (work: () => Promise<void>) => work());
jest.mock("@/state/app-state", () => ({ useAppState: () => ({ state: mockState, syncNow: mockSync, runLocalOperation: mockRun }) }));
jest.mock("expo-router", () => ({ router: { back: jest.fn() }, useFocusEffect: (callback: () => unknown) => jest.requireActual("react").useEffect(callback, [callback]) }));
jest.mock("@/components/vitalis/confirmation", () => ({ useConfirm: () => mockConfirm }));
jest.mock("@/components/vitalis/date-field", () => ({ DateField: () => null }));
jest.mock("@/lib/report-store", () => ({ readReport: jest.fn(), listTimeline: jest.fn() }));
jest.mock("@/lib/report-extras", () => ({ dailyReportExtras: jest.fn(async () => ["Última pressão: 120/80 mmHg."]) }));
jest.mock("@/lib/wellbeing-store", () => ({ onWellbeingChanged: () => () => {} }));
jest.mock("@/lib/history-projection", () => ({ onHistoryChanged: () => () => {} }));
jest.mock("@/lib/document-store", () => ({ listDocuments: jest.fn(async () => ({ records: [] })), deleteDocument: jest.fn(), onDocumentsChanged: () => () => {} }));
jest.mock("@/lib/document-files", () => ({ importDocument: jest.fn(async () => {}), ensureDocumentFile: jest.fn() }));
jest.mock("@/lib/exports", () => ({ exportPdf: jest.fn(async () => "file:///qa/report.pdf"), exportCsv: jest.fn(), exportAccountBackup: jest.fn() }));
jest.mock("@/lib/file-tools", () => ({ shareFile: jest.fn(), saveFileAs: jest.fn(), fileTools: jest.fn() }));
jest.mock("@/lib/retention", () => ({ previewCleanup: jest.fn(), executeCleanup: jest.fn(async () => ({ removed: 1, skipped: 0 })) }));
jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn(async () => ({ canceled: true })) }));
jest.mock("expo-file-system", () => ({ Paths: { cache: { uri: "file:///cache/" } }, File: class {} }));
const view = (Child: React.ComponentType) => render(<PaperProvider><Child /></PaperProvider>);
beforeEach(() => {
  jest.clearAllMocks(); mockState = { ...initialState, userId: "owner", profileId: "profile", authenticated: true };
  (readReport as jest.Mock).mockImplementation(async (_u, _p, period, date, goals) => buildHealthReport({ water: [], meals: [], activities: [], weights: [], steps: [] }, period, date, goals));
  (listTimeline as jest.Mock).mockResolvedValue({ records: [] });
  (exportPdf as jest.Mock).mockResolvedValue("file:///qa/report.pdf");
  (previewCleanup as jest.Mock).mockResolvedValue({ userId: "owner", profileId: "profile", cutoff: "2025-11-08", candidates: [{ entity: "water", id: "one", fingerprint: "old" }], counts: { water: 1 } });
});
test("cleanup requires a preview and a separate explicit confirmation for every execution", async () => {
  const s = view(Data); fireEvent.press(s.getByLabelText("Ver prévia da limpeza")); await waitFor(() => expect(s.getByText("Água: 1")).toBeTruthy());
  fireEvent.press(s.getByLabelText("Confirmar limpeza dos registros")); expect(mockConfirm).toHaveBeenCalledTimes(1); expect(executeCleanup).not.toHaveBeenCalled();
  await act(async () => { await mockConfirm.mock.calls[0][2](); }); expect(executeCleanup).toHaveBeenCalledTimes(1); expect(mockRun).toHaveBeenCalledTimes(1);
  fireEvent.press(s.getByLabelText("Ver prévia da limpeza")); await waitFor(() => expect(s.getByLabelText("Confirmar limpeza dos registros")).toBeTruthy()); fireEvent.press(s.getByLabelText("Confirmar limpeza dos registros")); expect(mockConfirm).toHaveBeenCalledTimes(2); expect(executeCleanup).toHaveBeenCalledTimes(1);
});
test("file picker cancellation leaves data unchanged; a selection uses the originating profile", async () => {
  const s = view(Documents); await act(async()=>{fireEvent.press(s.getByLabelText("Anexar documento"));}); await waitFor(() => expect(Picker.getDocumentAsync).toHaveBeenCalled()); expect(importDocument).not.toHaveBeenCalled();
  const asset = { uri: "content://qa/picked", name: "QA.pdf", mimeType: "application/pdf" };
  (Picker.getDocumentAsync as jest.Mock).mockResolvedValueOnce({ canceled: false, assets: [asset] }); fireEvent.press(s.getByLabelText("Anexar documento")); await waitFor(() => expect(importDocument).toHaveBeenCalledWith("owner", "profile", asset)); expect(mockSync).toHaveBeenCalled();
});
test("timeline queries and filters only the selected account/profile", async () => {
  const s = view(Timeline); await waitFor(() => expect(listTimeline).toHaveBeenCalledWith("owner", "profile", undefined, undefined, 30, "metric")); fireEvent.press(s.getByText("Humor")); await waitFor(() => expect(listTimeline).toHaveBeenLastCalledWith("owner", "profile", "mood", undefined, 30, "metric"));
});
test("generated PDF remains available when synchronization refreshes unchanged goals", async () => {
  const s = view(Reports); await waitFor(() => expect(s.getByLabelText("Gerar PDF")).toBeTruthy()); fireEvent.press(s.getByLabelText("Gerar PDF")); await waitFor(() => expect(s.getByLabelText("Compartilhar arquivo")).toBeTruthy());
  mockState = { ...mockState, goals: { ...mockState.goals } }; s.rerender(<PaperProvider><Reports /></PaperProvider>); await waitFor(() => expect(s.getByLabelText("Compartilhar arquivo")).toBeTruthy());
});
test("a delayed PDF from an old period cannot replace the current report selection", async () => {
  let finish!: (uri: string) => void; (exportPdf as jest.Mock).mockImplementationOnce(() => new Promise<string>(resolve => { finish = resolve; }));
  const s = view(Reports); await waitFor(() => expect(s.getByLabelText("Gerar PDF")).toBeTruthy()); fireEvent.press(s.getByLabelText("Gerar PDF")); await waitFor(() => expect(exportPdf).toHaveBeenCalled()); fireEvent.press(s.getByText("Resumo diário"));
  await waitFor(() => expect(readReport).toHaveBeenLastCalledWith("owner", "profile", "day", expect.any(String), expect.any(Object))); await act(async () => { finish("file:///qa/old-period.pdf"); }); expect(s.queryByLabelText("Compartilhar arquivo")).toBeNull();
});

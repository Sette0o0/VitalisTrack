import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { AppState } from "react-native";
import { PaperProvider } from "react-native-paper";
import * as Location from "expo-location";
import WorkoutScreen from "@/app/activities/workout";
import { initialState } from "@/state/reducer";
import { useAppState } from "@/state/app-state";
import { getValue } from "@/lib/local-database";
import { createWorkout } from "@/lib/workout";

jest.mock("expo-location", () => ({
	Accuracy: { High: 4 },
	getForegroundPermissionsAsync: jest.fn(),
	requestForegroundPermissionsAsync: jest.fn(),
	hasServicesEnabledAsync: jest.fn(async () => true),
	watchPositionAsync: jest.fn(async () => ({ remove: jest.fn() })),
}));
jest.mock("@/components/vitalis/workout-map", () => ({ WorkoutMap: () => null }));
jest.mock("@/components/vitalis/confirmation", () => ({ useConfirm: () => jest.fn() }));
jest.mock("@/state/app-state", () => ({
	useAppState: jest.fn(),
}));
jest.mock("@/lib/local-database", () => ({
	getValue: jest.fn(async () => null),
	setValue: jest.fn(async () => {}),
}));
jest.mock("expo-router", () => ({ router: { replace: jest.fn() }, useLocalSearchParams: () => ({}) }));
jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);

beforeEach(() => {
	jest.clearAllMocks();
	(useAppState as jest.Mock).mockReturnValue({ state: initialState, dispatch: jest.fn() });
	AppState.currentState = "active";
	(getValue as jest.Mock).mockResolvedValue(null);
	(Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
});

test("retoma o treino com permissão existente sem reabrir o diálogo Android", async () => {
	(getValue as jest.Mock).mockResolvedValue(JSON.stringify(createWorkout("run")));
	const ui = render(<PaperProvider><WorkoutScreen /></PaperProvider>);
	await waitFor(() => expect(ui.getByText("Treino pausado")).toBeTruthy());
	fireEvent.press(ui.getByRole("button", { name: "Retomar" }));
	await waitFor(() => expect(ui.getByText("GPS ativo")).toBeTruthy());
	expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
	expect(Location.watchPositionAsync).toHaveBeenCalledTimes(1);
	fireEvent.press(ui.getByRole("button", { name: "Pausar" }));
	fireEvent.press(ui.getByRole("button", { name: "Retomar" }));
	await waitFor(() => expect(Location.watchPositionAsync).toHaveBeenCalledTimes(2));
	expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
});

test("solicita a permissão ausente e mantém o treino pausado quando negada", async () => {
	(Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });
	(Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });
	const ui = render(<PaperProvider><WorkoutScreen /></PaperProvider>);
	await waitFor(() => expect(ui.getByText(/Permita a localização/)).toBeTruthy());
	expect(ui.getByText("Treino pausado")).toBeTruthy();
	expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
	expect(Location.watchPositionAsync).not.toHaveBeenCalled();
});

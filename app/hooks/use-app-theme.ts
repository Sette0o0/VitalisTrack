import { darkTheme, lightTheme } from "@/constants/theme";
import { useAppState } from "@/state/app-state";

export function useAppTheme() {
	const { state } = useAppState();
	return state.darkMode ? darkTheme : lightTheme;
}

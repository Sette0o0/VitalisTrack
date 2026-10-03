import { ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import { ConfirmationProvider } from "@/components/vitalis/confirmation";
import { PaperProvider } from "react-native-paper";
import { createPaperTheme, navigationThemes } from "@/constants/paper-theme";
import { AppStateProvider, useAppState } from "@/state/app-state";

function Navigation() {
	const { state } = useAppState();
	return (
		<PaperProvider theme={createPaperTheme(state.darkMode)}>
			<ConfirmationProvider>
				<ThemeProvider
					value={
						state.darkMode
							? navigationThemes.DarkTheme
							: navigationThemes.LightTheme
					}
				>
					<Stack
						screenOptions={{
							headerShown: false,
							animation: "slide_from_right",
						}}
					>
						<Stack.Screen name="index" />
						<Stack.Protected guard={!state.authenticated}>
							<Stack.Screen name="(auth)" />
						</Stack.Protected>
						<Stack.Protected guard={state.authenticated}>
							<Stack.Screen name="(tabs)" />
							<Stack.Screen name="activities" />
							<Stack.Screen name="meals" />
							<Stack.Screen name="profile" />
							<Stack.Screen name="water" />
							<Stack.Screen name="weight" />
						</Stack.Protected>
					</Stack>
					<StatusBar style={state.darkMode ? "light" : "dark"} />
				</ThemeProvider>
			</ConfirmationProvider>
		</PaperProvider>
	);
}
export default function RootLayout() {
	return (
		<AppStateProvider>
			<Navigation />
		</AppStateProvider>
	);
}

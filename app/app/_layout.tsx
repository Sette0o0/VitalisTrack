import {
	DarkTheme,
	DefaultTheme,
	ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import { AppStateProvider, useAppState } from "@/state/app-state";

function Navigation() {
	const { state } = useAppState();
	return (
		<ThemeProvider value={state.darkMode ? DarkTheme : DefaultTheme}>
			<Stack
				screenOptions={{ headerShown: false, animation: "slide_from_right" }}
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
	);
}
export default function RootLayout() {
	return (
		<AppStateProvider>
			<Navigation />
		</AppStateProvider>
	);
}

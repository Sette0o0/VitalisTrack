import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAppState } from "@/state/app-state";
export default function Index() {
	const { state, loading } = useAppState();
	if (loading)
		return (
			<View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
				<ActivityIndicator />
			</View>
		);
	return <Redirect href={state.authenticated ? "/(tabs)" : "/(auth)/login"} />;
}

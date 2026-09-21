import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Tabs } from "expo-router";
import { useAppTheme } from "@/hooks/use-app-theme";
const icon = (name: keyof typeof MaterialCommunityIcons.glyphMap) =>
	function TabBarIcon({ color, focused }: { color: string; focused: boolean }) {
		return (
			<MaterialCommunityIcons
				name={name}
				size={focused ? 27 : 24}
				color={color}
			/>
		);
	};
export default function TabLayout() {
	const theme = useAppTheme();
	return (
		<Tabs
			screenOptions={{
				headerShown: false,
				tabBarActiveTintColor: theme.primary,
				tabBarInactiveTintColor: theme.onSurfaceVariant,
				tabBarStyle: {
					height: 68,
					paddingTop: 6,
					paddingBottom: 8,
					borderTopColor: theme.outline,
					backgroundColor: theme.surface,
				},
				tabBarLabelStyle: { fontSize: 10, fontWeight: "700" },
			}}
		>
			<Tabs.Screen
				name="index"
				options={{ title: "Início", tabBarIcon: icon("home") }}
			/>
			<Tabs.Screen
				name="meals"
				options={{
					title: "Alimentação",
					tabBarIcon: icon("silverware-fork-knife"),
				}}
			/>
			<Tabs.Screen
				name="add"
				options={{ title: "Registrar", tabBarIcon: icon("plus-circle") }}
			/>
			<Tabs.Screen
				name="progress"
				options={{ title: "Progresso", tabBarIcon: icon("chart-line") }}
			/>
			<Tabs.Screen
				name="profile"
				options={{ title: "Perfil", tabBarIcon: icon("account") }}
			/>
		</Tabs>
	);
}

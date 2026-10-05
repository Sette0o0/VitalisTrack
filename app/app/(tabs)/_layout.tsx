import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { BottomNavigation, Text } from "react-native-paper";
import { CommonActions } from "@react-navigation/native";
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
			tabBar={({ navigation, state, descriptors, insets }) => (
				<BottomNavigation.Bar
					navigationState={state}
					safeAreaInsets={insets}
					onTabPress={({ route, preventDefault }) => {
						const event = navigation.emit({
							type: "tabPress",
							target: route.key,
							canPreventDefault: true,
						});
						if (event.defaultPrevented) preventDefault();
						else
							navigation.dispatch({
								...CommonActions.navigate(route.name, route.params),
								target: state.key,
							});
					}}
					renderIcon={({ route, focused, color }) =>
						descriptors[route.key].options.tabBarIcon?.({
							focused,
							color,
							size: 24,
						})
					}
					getLabelText={({ route }) =>
						descriptors[route.key].options.title ?? route.name
					}
					renderLabel={({ route, color }) => (
						<Text
							variant="labelMedium"
							allowFontScaling={false}
							style={{ color, fontSize: 10, lineHeight: 16, height: 16, includeFontPadding: false, fontWeight: "700", textAlign: "center", textAlignVertical: "center" }}
						>
							{descriptors[route.key].options.title ?? route.name}
						</Text>
					)}
					getAccessibilityLabel={({ route }) =>
						descriptors[route.key].options.title ?? route.name
					}
				/>
			)}
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

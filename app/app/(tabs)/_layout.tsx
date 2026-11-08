import { StyleSheet, View, useWindowDimensions } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { TouchableRipple, Text } from "react-native-paper";
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
function TabBar({ navigation, state, descriptors, insets }: BottomTabBarProps) {
	const theme = useAppTheme();
	const { fontScale } = useWindowDimensions();
	const columns = fontScale >= 1.5 ? 3 : state.routes.length;
	const rows = Array.from({ length: Math.ceil(state.routes.length / columns) }, (_, row) =>
		state.routes.slice(row * columns, (row + 1) * columns),
	);
	return (
		<View
			key={fontScale}
			style={[
				styles.bar,
				{
					backgroundColor: theme.surface,
					borderTopColor: theme.outline,
					paddingBottom: Math.max(insets.bottom, 6),
					paddingLeft: insets.left,
					paddingRight: insets.right,
				},
			]}
		>
			{rows.map((routes) => (
				<View key={routes[0].key} style={styles.row}>
					{routes.map((route) => {
						const focused = state.routes[state.index].key === route.key;
						const color = focused ? theme.primary : theme.onSurfaceVariant;
						const options = descriptors[route.key].options;
						const label = options.title ?? route.name;
						return (
							<TouchableRipple
								key={route.key}
								accessibilityRole="tab"
								accessibilityLabel={label}
								accessibilityState={{ selected: focused }}
								style={styles.tab}
								onPress={() => {
									const event = navigation.emit({
										type: "tabPress", target: route.key, canPreventDefault: true,
									});
									if (!event.defaultPrevented)
										navigation.dispatch({
											...CommonActions.navigate(route.name, route.params), target: state.key,
										});
								}}
								onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
							>
								<View style={styles.item}>
									{options.tabBarIcon?.({ focused, color, size: 24 })}
									<Text variant="labelMedium" style={[styles.label, { color }]}>{label}</Text>
								</View>
							</TouchableRipple>
						);
					})}
				</View>
			))}
		</View>
	);
}

const styles = StyleSheet.create({
	bar: { paddingTop: 6, borderTopWidth: StyleSheet.hairlineWidth },
	row: { flexDirection: "row" },
	tab: { flex: 1, minWidth: 0 },
	item: { minHeight: 64, padding: 4, alignItems: "center", justifyContent: "center", gap: 4 },
	label: { fontSize: 10, lineHeight: 14, fontWeight: "700", textAlign: "center" },
});

export default function TabLayout() {
	return (
		<Tabs
			tabBar={(props) => <TabBar {...props} />}
			screenOptions={{ headerShown: false }}
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

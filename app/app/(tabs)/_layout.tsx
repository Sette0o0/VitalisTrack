import { View, useWindowDimensions } from "react-native";
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
export default function TabLayout() {
	const theme = useAppTheme();
 const {fontScale} = useWindowDimensions();
	return (
		<Tabs
			tabBar={({ navigation, state, descriptors, insets }) => (
    <View style={{flexDirection:"row",flexWrap:"wrap",paddingBottom:insets.bottom,paddingTop:6,backgroundColor:theme.surface}}>
     {state.routes.map((route,index) => {
      const focused=state.index===index, color=focused ? theme.primary : theme.onSurfaceVariant;
      const label=descriptors[route.key].options.title ?? route.name;
      return <TouchableRipple key={`${route.key}:${fontScale}`} accessibilityRole="tab" accessibilityLabel={label}
       accessibilityState={{selected:focused}} style={{width:fontScale>=1.5 ? "33.333%" : "20%"}}
       onPress={() => {
        const event=navigation.emit({type:"tabPress",target:route.key,canPreventDefault:true});
        if(!event.defaultPrevented) navigation.dispatch({...CommonActions.navigate(route.name,route.params),target:state.key});
       }}>
       <View style={{minHeight:64,padding:4,alignItems:"center",gap:4}}>
        {descriptors[route.key].options.tabBarIcon?.({focused,color,size:24})}
        <Text variant="labelMedium" style={{color,textAlign:"center",lineHeight:undefined}}>{label}</Text>
       </View>
      </TouchableRipple>;
     })}
    </View>
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

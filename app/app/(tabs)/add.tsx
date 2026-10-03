import { router } from "expo-router";
import { Button, Eyebrow, Screen, Title } from "@/components/vitalis/ui";
export default function AddScreen() {
	return (
		<Screen>
			<Eyebrow>Registro rápido</Eyebrow>
			<Title>O que você quer registrar?</Title>
			<Button
				title="Água"
				icon="water"
				variant="outline"
				onPress={() => router.push("/water")}
			/>
			<Button
				title="Refeição"
				icon="silverware-fork-knife"
				variant="outline"
				onPress={() => router.push("/meals/form")}
			/>
			<Button
				title="Atividade"
				icon="run"
				variant="outline"
				onPress={() => router.push("/activities")}
			/>
			<Button
				title="Peso"
				icon="scale-bathroom"
				variant="outline"
				onPress={() => router.push("/weight")}
			/>
		</Screen>
	);
}

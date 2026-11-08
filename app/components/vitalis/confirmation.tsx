import { ScrollView, useWindowDimensions } from "react-native";
import { userError } from "@/lib/user-error";
import { createContext, PropsWithChildren, useContext, useState } from "react";
import { Button, Dialog, HelperText, Portal, Text } from "react-native-paper";
const Context = createContext<
	(
		title: string,
		message: string,
		action: () => void | Promise<void>,
		label?: string,
	) => void
>(() => {});
export function ConfirmationProvider({ children }: PropsWithChildren) {
 const {fontScale, height} = useWindowDimensions();
	const [value, setValue] = useState<{
			title: string;
			message: string;
			action: () => void | Promise<void>;
			label: string;
		} | null>(null),
		[saving, setSaving] = useState(false),
		[error, setError] = useState("");
	return (
		<Context.Provider
			value={(title, message, action, label = "Excluir") => {
				setError("");
				setValue({ title, message, action, label });
			}}
		>
			{children}
			<Portal>
				<Dialog key={fontScale}
					style={{ maxHeight: height - 48 }}
					visible={Boolean(value)}
					dismissable={!saving}
					onDismiss={() => setValue(null)}
				>
					<ScrollView style={{ maxHeight: Math.max(120, height - (fontScale >= 1.5 ? 180 : 120)) }}>
					<Dialog.Title>{value?.title}</Dialog.Title>
					<Dialog.Content>
						<Text variant="bodyMedium">{value?.message}</Text>
						{error && (
							<HelperText type="error" accessibilityLiveRegion="polite">
								{error}
							</HelperText>
						)}
					</Dialog.Content>
					</ScrollView>
					<Dialog.Actions style={{ flexDirection: fontScale >= 1.5 ? "column" : "row", alignItems: fontScale >= 1.5 ? "stretch" : "center" }}>
						<Button
							contentStyle={{ minHeight: 48 }}
							disabled={saving}
							onPress={() => setValue(null)}
						>
							Continuar
						</Button>
						<Button
							contentStyle={{ minHeight: 48 }}
							loading={saving}
							disabled={saving}
							onPress={async () => {
								setSaving(true);
								try {
									await value?.action();
									setValue(null);
								} catch (cause) {
									setError(userError(cause));
								} finally {
									setSaving(false);
								}
							}}
						>
							{value?.label}
						</Button>
					</Dialog.Actions>
				</Dialog>
			</Portal>
		</Context.Provider>
	);
}
export const useConfirm = () => useContext(Context);

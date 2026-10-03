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
				<Dialog
					visible={Boolean(value)}
					dismissable={!saving}
					onDismiss={() => setValue(null)}
				>
					<Dialog.Title>{value?.title}</Dialog.Title>
					<Dialog.Content>
						<Text variant="bodyMedium">{value?.message}</Text>
						{error && (
							<HelperText type="error" accessibilityLiveRegion="polite">
								{error}
							</HelperText>
						)}
					</Dialog.Content>
					<Dialog.Actions>
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
									setError(
										cause instanceof Error
											? cause.message
											: "Não foi possível concluir.",
									);
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

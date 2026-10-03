import type { ComponentProps, ReactNode } from "react";
import {
	KeyboardAvoidingView,
	Platform,
	ScrollView,
	StyleSheet,
	View,
} from "react-native";
import { Dialog, Portal } from "react-native-paper";

export function FormDialog({
	title,
	children,
	actions,
	style,
	...props
}: Omit<ComponentProps<typeof Dialog>, "children"> & {
	title: string;
	children: ReactNode;
	actions: ReactNode;
}) {
	return (
		<Portal>
			<KeyboardAvoidingView
				pointerEvents="box-none"
				style={StyleSheet.absoluteFill}
				behavior={Platform.OS === "ios" ? "padding" : "height"}
			>
				<Dialog
					{...props}
					style={[{ maxHeight: "90%", marginVertical: 16 }, style]}
				>
					<Dialog.Title>{title}</Dialog.Title>
					<Dialog.ScrollArea>
						<ScrollView keyboardShouldPersistTaps="handled">
							<View style={{ gap: 12, paddingVertical: 8 }}>{children}</View>
						</ScrollView>
					</Dialog.ScrollArea>
					<Dialog.Actions style={{ flexWrap: "wrap", gap: 8 }}>
						{actions}
					</Dialog.Actions>
				</Dialog>
			</KeyboardAvoidingView>
		</Portal>
	);
}

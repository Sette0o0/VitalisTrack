import { useRef, useState } from "react";
export function useSubmit() {
	const active = useRef(false);
	const [saving, setSaving] = useState(false),
		[error, setError] = useState("");
	const submit = async (action: () => Promise<void>) => {
		if (active.current) return;
		active.current = true;
		setSaving(true);
		setError("");
		try {
			await action();
		} catch (cause) {
			setError(
				cause instanceof Error
					? cause.message
					: "Não foi possível salvar. Tente novamente.",
			);
		} finally {
			active.current = false;
			setSaving(false);
		}
	};
	return { submit, saving, error };
}

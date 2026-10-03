import { useEffect } from "react";
import { AppState } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { ensureFreshSession } from "./api";
import { loadTokens, onSessionChange, sessionExpiresAt } from "./session";

export function useSessionRefresh(authenticated: boolean, invalidate: () => void) {
	useEffect(() => {
		if (!authenticated) return;
		let stopped = false;
		let timer: ReturnType<typeof setTimeout>;
		const schedule = () => {
			clearTimeout(timer);
			if (!stopped) timer = setTimeout(() => void check(), Math.min(2_147_483_647, Math.max(1000, sessionExpiresAt() - Date.now() - 60_000)));
		};
		const check = async () => {
			try {
				const network = await NetInfo.fetch();
				if (network.isConnected && network.isInternetReachable !== false) await ensureFreshSession();
				else {
					if (!stopped) timer = setTimeout(() => void check(), 30_000);
					return;
				}
				schedule();
			} catch {
				if (!stopped) timer = setTimeout(() => void check(), 30_000);
			}
		};
		const unsubscribe = onSessionChange((valid) => valid ? schedule() : invalidate());
		const foreground = AppState.addEventListener("change", (status) => {
			if (status === "active") { clearTimeout(timer); void check(); }
		});
		void loadTokens().then(() => { if (!stopped) void check(); });
		return () => { stopped = true; clearTimeout(timer); unsubscribe(); foreground.remove(); };
	}, [authenticated, invalidate]);
}

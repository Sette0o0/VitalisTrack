import type { Href, Router } from "expo-router";

/** Returns through history, or to a stable route when the screen was opened directly. */
export function goBackOrReplace(router: Router, fallback: Href) {
	if (router.canGoBack()) {
		router.back();
		return;
	}

	router.replace(fallback);
}

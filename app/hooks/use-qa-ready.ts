import { useCallback, useEffect, useRef } from "react";
import { useAppState } from "@/state/app-state";

// QA-only readiness marker: timestamps use the device clock, not UIAutomator polling.
export function useQaReady(screen: string) {
	const { loading } = useAppState();
	const laidOut = useRef(false), emitted = useRef(false);
	const signal = useCallback(() => {
		if (process.env.EXPO_PUBLIC_ANDROID_QA !== "true" || loading || !laidOut.current || emitted.current) return;
		emitted.current = true;
		requestAnimationFrame(() => requestAnimationFrame(() => console.info(`VITALIS_QA_READY ${JSON.stringify({ screen, at: Date.now() })}`)));
	}, [loading, screen]);
	useEffect(signal, [signal]);
	return () => { laidOut.current = true; signal(); };
}

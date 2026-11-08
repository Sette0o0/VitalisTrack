import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { AppState } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { apiRequest } from "@/lib/api";
import { useAppState } from "@/state/app-state";
import { UserFacingError, userError } from "@/lib/user-error";
export function useOnlineProfile<T>(path: string) {
  const { state } = useAppState();
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState("");
  const epoch = useRef(0);
  const request = useCallback(
    async <R>(url: string, init: RequestInit = {}) => {
      const n = await NetInfo.fetch();
      if (!n.isConnected || n.isInternetReachable === false)
        throw new UserFacingError(
          "Conecte-se à internet para acessar amizades e atividades compartilhadas.",
        );
      return apiRequest<R>(
        url,
        {
          ...init,
          headers: {
            ...init.headers,
            "x-profile-id": state.profileId ?? state.userId!,
          },
        },
        true,
        state.userId,
      );
    },
    [state.userId, state.profileId],
  );
  const reload = useCallback(async () => {
    const current = ++epoch.current;
    setData(null);
    try {
      const value = await request<T>(path);
      if (current === epoch.current) {
        setData(value);
        setError("");
      }
    } catch (e) {
      if (current === epoch.current) setError(userError(e, "load"));
    }
  }, [request, path]);
  useFocusEffect(
    useCallback(() => {
      void reload();
      const net = NetInfo.addEventListener((n) => {
        if (!n.isConnected || n.isInternetReachable === false) {
          epoch.current++;
          setData(null);
          setError("Conecte-se para consultar estes dados.");
        }
      });
      const app = AppState.addEventListener("change", (v) => {
        epoch.current++;
        setData(null);
        if (v === "active") void reload();
      });
      return () => {
        epoch.current++;
        net();
        app.remove();
        setData(null);
      };
    }, [reload]),
  );
  return { data, error, reload, request };
}

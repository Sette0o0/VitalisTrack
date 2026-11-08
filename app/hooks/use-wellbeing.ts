import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import type {
  WellbeingInput,
  WellbeingKind,
  WellbeingRecord,
} from "@vitalis/contracts";
import {
  listWellbeing,
  onWellbeingChanged,
  saveWellbeing,
} from "@/lib/wellbeing-store";
import { reconcileReminders } from "@/lib/reminders";
import { useAppState } from "@/state/app-state";
import { userError, UserFacingError } from "@/lib/user-error";
export function useWellbeing(kind: WellbeingKind) {
  const { state, syncNow } = useAppState();
  const owner = state.userId!,
    profileId = state.profileId ?? owner;
  const [records, setRecords] = useState<WellbeingRecord[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const alive = useRef(true);
  const cursor = useRef<{ at: string; id: string } | undefined>(undefined),
    epoch = useRef(0),
    busy = useRef(false);
  const reload = useCallback(async () => {
    const revision = ++epoch.current;
    setLoading(true);
    try {
      const page = await listWellbeing(owner, profileId, kind);
      if (revision === epoch.current) {
        setRecords(page.records);
        cursor.current = page.nextCursor;
        setError("");
      }
    } catch (e) {
      if (revision === epoch.current) setError(userError(e, "load"));
    } finally {
      if (revision === epoch.current) setLoading(false);
    }
  }, [owner, profileId, kind]);
  useFocusEffect(
    useCallback(() => {
      void reload();
      const off = onWellbeingChanged(() => void reload());
      return () => {
        off();
        epoch.current++;
      };
    }, [reload]),
  );
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      epoch.current++;
    };
  }, []);
  const more = async () => {
    if (!cursor.current || busy.current) return;
    busy.current = true;
    const revision = epoch.current;
    try {
      const p = await listWellbeing(owner, profileId, kind, cursor.current);
      if (revision === epoch.current) {
        setRecords((r) => [
          ...new Map([...r, ...p.records].map((x) => [x.id, x])).values(),
        ]);
        cursor.current = p.nextCursor;
      }
    } catch (e) {
      setError(userError(e, "load"));
    } finally {
      busy.current = false;
    }
  };
  const save = async (value: WellbeingInput, remove = false) => {
    if (!alive.current || !state.authenticated || !owner)
      throw new UserFacingError("Entre na sua conta.");
    await saveWellbeing(owner, profileId, value, remove);
    if (!alive.current)
      throw new UserFacingError(
        "O perfil foi alterado. O registro foi preservado no perfil de origem.",
      );
    await reload();
    // A scheduling or network failure must not turn a committed local save into a failed save.
    void reconcileReminders(owner).catch(() =>
      setError("Registro salvo. Confira a configuração dos lembretes."),
    );
    void syncNow();
  };
  return {
    records,
    error,
    loading,
    reload,
    more,
    hasMore: !!cursor.current,
    save,
  };
}

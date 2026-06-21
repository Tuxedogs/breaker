import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { SignatureDockContext } from "./signatureDockContext";
import {
  SIGNATURE_DOCK_LS_KEY,
  loadSignatureDockState,
  patchSignatureDockState,
} from "./signatureDockState";

export function SignatureDockProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(() => loadSignatureDockState().enabled === true);

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next);
    patchSignatureDockState({ enabled: next });
  }, []);

  const toggleEnabled = useCallback(() => {
    setEnabled(!enabled);
  }, [enabled, setEnabled]);

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== SIGNATURE_DOCK_LS_KEY || !event.newValue) return;
      try {
        const parsed = JSON.parse(event.newValue) as { enabled?: boolean };
        setEnabledState(parsed.enabled === true);
      } catch {
        /* ignore */
      }
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo(
    () => ({ enabled, setEnabled, toggleEnabled }),
    [enabled, setEnabled, toggleEnabled],
  );

  return (
    <SignatureDockContext.Provider value={value}>
      {children}
    </SignatureDockContext.Provider>
  );
}
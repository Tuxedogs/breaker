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
  normalizeSignatureDockState,
  patchSignatureDockState,
  type SignatureDockPersistedState,
} from "./signatureDockState";

type Visibility = { enabled: boolean; minimized: boolean };

function visibilityOf(state: SignatureDockPersistedState): Visibility {
  return { enabled: state.enabled === true, minimized: state.minimized };
}

export function SignatureDockProvider({ children }: { children: ReactNode }) {
  const [visibility, setVisibility] = useState<Visibility>(() => visibilityOf(loadSignatureDockState()));
  const { enabled, minimized } = visibility;

  // Enabling always opens the full panel; disabling hides every piece of dock UI.
  const setEnabled = useCallback((next: boolean) => {
    setVisibility({ enabled: next, minimized: false });
    patchSignatureDockState({ enabled: next, open: next, minimized: false });
  }, []);

  const toggleEnabled = useCallback(() => {
    setEnabled(!enabled);
  }, [enabled, setEnabled]);

  const setMinimized = useCallback((next: boolean) => {
    setVisibility((current) => (current.enabled ? { ...current, minimized: next } : current));
    if (loadSignatureDockState().enabled) patchSignatureDockState({ minimized: next });
  }, []);

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== SIGNATURE_DOCK_LS_KEY || !event.newValue) return;
      try {
        const parsed = JSON.parse(event.newValue) as Partial<SignatureDockPersistedState>;
        setVisibility(visibilityOf(normalizeSignatureDockState(parsed)));
      } catch {
        /* ignore */
      }
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo(
    () => ({ enabled, minimized, setEnabled, toggleEnabled, setMinimized }),
    [enabled, minimized, setEnabled, toggleEnabled, setMinimized],
  );

  return (
    <SignatureDockContext.Provider value={value}>
      {children}
    </SignatureDockContext.Provider>
  );
}

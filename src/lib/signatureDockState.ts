export const SIGNATURE_DOCK_LS_KEY = "sdock_state";

export interface SignatureDockPersistedState {
  enabled?: boolean;
  open: boolean;
  minimized: boolean;
  fontWeight?: number;
  fontSize: number;
  pos: { x: number; y: number } | null;
  activeIds: number[];
  activePresetId?: string | null;
  activeMaterialKeys?: string[];
  isPresetModified?: boolean;
}

// Visibility is opt-in: `enabled` is the only visibility switch and `open` mirrors it.
// A disabled dock is never minimized. Legacy saves with enabled && !open showed the
// header-only strip, which is now the minimized state.
export function normalizeSignatureDockState(parsed: Partial<SignatureDockPersistedState>): SignatureDockPersistedState {
  const enabled = parsed.enabled === true;
  return {
    enabled,
    open: enabled,
    minimized: enabled && (parsed.minimized === true || parsed.open !== true),
    fontWeight: parsed.fontWeight ?? 800,
    fontSize: parsed.fontSize ?? 12,
    pos: parsed.pos ?? null,
    activeIds: Array.isArray(parsed.activeIds) ? parsed.activeIds : [],
    activePresetId: parsed.activePresetId ?? null,
    activeMaterialKeys: Array.isArray(parsed.activeMaterialKeys) ? parsed.activeMaterialKeys : undefined,
    isPresetModified: parsed.isPresetModified ?? false,
  };
}

export function loadSignatureDockState(): SignatureDockPersistedState {
  try {
    const raw = localStorage.getItem(SIGNATURE_DOCK_LS_KEY);
    if (raw) return normalizeSignatureDockState(JSON.parse(raw) as Partial<SignatureDockPersistedState>);
  } catch {
    /* ignore */
  }

  return normalizeSignatureDockState({});
}

export function saveSignatureDockState(state: SignatureDockPersistedState) {
  try {
    localStorage.setItem(SIGNATURE_DOCK_LS_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function patchSignatureDockState(patch: Partial<SignatureDockPersistedState>) {
  saveSignatureDockState({ ...loadSignatureDockState(), ...patch });
}

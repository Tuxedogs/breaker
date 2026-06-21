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

export function loadSignatureDockState(): SignatureDockPersistedState {
  try {
    const raw = localStorage.getItem(SIGNATURE_DOCK_LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SignatureDockPersistedState>;
      return {
        enabled: parsed.enabled === true,
        open: parsed.open ?? false,
        minimized: parsed.minimized ?? false,
        fontWeight: parsed.fontWeight ?? 800,
        fontSize: parsed.fontSize ?? 12,
        pos: parsed.pos ?? null,
        activeIds: Array.isArray(parsed.activeIds) ? parsed.activeIds : [],
        activePresetId: parsed.activePresetId ?? null,
        activeMaterialKeys: Array.isArray(parsed.activeMaterialKeys) ? parsed.activeMaterialKeys : undefined,
        isPresetModified: parsed.isPresetModified ?? false,
      };
    }
  } catch {
    /* ignore */
  }

  return {
    enabled: false,
    open: false,
    minimized: false,
    fontWeight: 800,
    fontSize: 12,
    pos: null,
    activeIds: [],
  };
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
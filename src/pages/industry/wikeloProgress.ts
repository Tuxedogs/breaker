export type WikeloProgress = { version: 1; owned: Record<string, number>; pins: string[] };
const KEY = 'moonbreaker:wikelo:manual:v1';
export const emptyWikeloProgress = (): WikeloProgress => ({ version: 1, owned: {}, pins: [] });

export function withOwnedEntry(progress: WikeloProgress, key: string, raw: string): WikeloProgress | null {
  if (raw !== '' && !/^\d+$/.test(raw)) return null;
  const quantity = raw === '' ? undefined : Number(raw);
  if (quantity !== undefined && !Number.isSafeInteger(quantity)) return null;
  const owned = { ...progress.owned };
  if (quantity === undefined) delete owned[key];
  else owned[key] = quantity;
  return { ...progress, owned };
}

export function readWikeloProgress(): WikeloProgress {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1 ||
      !('owned' in value) || !value.owned || typeof value.owned !== 'object' ||
      !('pins' in value) || !Array.isArray(value.pins)) return emptyWikeloProgress();
    const record = value as WikeloProgress;
    const owned = Object.fromEntries(Object.entries(record.owned).filter((entry): entry is [string, number] =>
      typeof entry[1] === 'number' && Number.isSafeInteger(entry[1]) && entry[1] >= 0));
    return { version: 1, owned, pins: record.pins.filter((pin): pin is string => typeof pin === 'string') };
  } catch { return emptyWikeloProgress(); }
}

export function writeWikeloProgress(value: WikeloProgress) {
  try { localStorage.setItem(KEY, JSON.stringify(value)); } catch { /* Browser storage may be unavailable. */ }
}

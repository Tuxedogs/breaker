import { purgeFittingComponentCacheNamespace } from "./fittingComponentStore";

export type FittingChannel = "LIVE" | "PTU";

export type FittingBuildContext = {
  channel: FittingChannel;
  buildId: string | null;
};

type FittingMetaCapture = {
  channel: FittingChannel;
  buildId: string;
};

let activeChannel: FittingChannel = "LIVE";
let resolvedBuildId: string | null = null;
const buildIdByChannel = new Map<FittingChannel, string>();

export function getFittingChannel(): FittingChannel {
  return activeChannel;
}

export function getFittingBuildId(): string | null {
  return resolvedBuildId;
}

export function getFittingBuildContext(): FittingBuildContext {
  return { channel: activeChannel, buildId: resolvedBuildId };
}

export function setFittingChannel(channel: FittingChannel): void {
  if (channel === activeChannel) return;
  activeChannel = channel;
  resolvedBuildId = buildIdByChannel.get(channel) ?? null;
}

export function captureFittingApiMeta(meta: FittingMetaCapture): void {
  const buildId = meta.buildId.trim();
  if (!buildId) return;

  const previousBuildId = buildIdByChannel.get(meta.channel) ?? null;
  if (previousBuildId !== buildId) {
    if (previousBuildId) {
      purgeFittingComponentCacheNamespace(meta.channel, previousBuildId);
    }
    purgeFittingComponentCacheNamespace(meta.channel, null);
  }

  buildIdByChannel.set(meta.channel, buildId);
  if (meta.channel === activeChannel) {
    resolvedBuildId = buildId;
  }
}

export function appendFittingBuildQuery(path: string): string {
  const separator = path.includes("?") ? "&" : "?";
  let query = `channel=${encodeURIComponent(activeChannel)}`;
  if (resolvedBuildId) {
    query += `&buildId=${encodeURIComponent(resolvedBuildId)}`;
  }
  return `${path}${separator}${query}`;
}

export function resetFittingBuildContextForTests(): void {
  activeChannel = "LIVE";
  resolvedBuildId = null;
  buildIdByChannel.clear();
}

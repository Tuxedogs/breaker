import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { Channel, DatasetSelection } from "./fitting.types.ts";
import { FittingHttpError } from "./fitting.types.ts";

const BUILD_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

export function getFittingDataRoot(): string {
  if (process.env.FITTING_DATA_ROOT) return path.resolve(process.env.FITTING_DATA_ROOT);
  return path.resolve(process.cwd(), "server-data", "fitting");
}

async function directoryExists(value: string): Promise<boolean> {
  try {
    return (await stat(value)).isDirectory();
  } catch {
    return false;
  }
}

function parseChannel(raw: string | null): Channel {
  const channel = (raw ?? "LIVE").toUpperCase();
  if (channel !== "LIVE" && channel !== "PTU") {
    throw new FittingHttpError(400, "INVALID_REQUEST", "Invalid request", "channel must be LIVE or PTU.", [
      { path: "query.channel", code: "INVALID_VALUE", message: "Expected LIVE or PTU." },
    ]);
  }
  return channel;
}

function currentIdFromPayload(payload: Record<string, unknown>, channel: Channel): string | null {
  const channels = payload.channels;
  if (channels && typeof channels === "object") {
    const channelPayload = (channels as Record<string, unknown>)[channel];
    if (channelPayload && typeof channelPayload === "object") {
      const value = (channelPayload as Record<string, unknown>).currentBuildId
        ?? (channelPayload as Record<string, unknown>).activeBuildId
        ?? (channelPayload as Record<string, unknown>).buildId;
      if (typeof value === "string" && value.length > 0) return value;
    }
  }
  const declaredChannel = typeof payload.channel === "string" ? payload.channel.toUpperCase() : null;
  if (declaredChannel && declaredChannel !== channel) return null;
  const value = payload.currentBuildId ?? payload.activeBuildId ?? payload.buildId;
  return typeof value === "string" && value.length > 0 ? value : null;
}

async function currentBuildId(dataRoot: string, channel: Channel): Promise<string | null> {
  try {
    const payload = JSON.parse(await readFile(path.join(dataRoot, "current.json"), "utf8")) as Record<string, unknown>;
    return currentIdFromPayload(payload, channel);
  } catch {
    return null;
  }
}

export async function resolveDataset(searchParams: URLSearchParams, dataRoot = getFittingDataRoot()): Promise<DatasetSelection> {
  const channel = parseChannel(searchParams.get("channel"));
  const requestedBuild = searchParams.get("buildId");
  const explicitBuild = requestedBuild !== null;
  const buildId = requestedBuild ?? (await currentBuildId(dataRoot, channel));

  if (!buildId || !BUILD_ID_PATTERN.test(buildId)) {
    throw new FittingHttpError(
      404,
      "BUILD_NOT_FOUND",
      "Build not found",
      explicitBuild ? "The requested fitting build does not exist." : `No current fitting build is configured for ${channel}.`,
    );
  }

  const fittingRoot = path.join(dataRoot, channel, buildId);
  if (!(await directoryExists(fittingRoot))) {
    throw new FittingHttpError(503, "DATASET_UNAVAILABLE", "Dataset unavailable", "The selected build has no readable fitting server-data bundle.");
  }

  return { channel, buildId, fittingRoot, explicitBuild, legacyStorageFallback: false };
}

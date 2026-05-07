import { getBuildQueueRequirements } from "../buildQueue/buildQueue.service";
import type { BuildQueueRequirementsRequest } from "../buildQueue/buildQueue.types";

export const buildQueueRequirementsApiPath = "/api/build-queue/requirements";

export async function handleBuildQueueRoute(
  method: string,
  url: string,
  body: unknown,
): Promise<{ status: number; body: unknown } | null> {
  if (url !== buildQueueRequirementsApiPath) return null;
  if (method !== "POST") return { status: 405, body: { error: "Method not allowed" } };
  return { status: 200, body: await getBuildQueueRequirements((body ?? {}) as BuildQueueRequirementsRequest) };
}

import { aggregateBuildQueueRequirements } from "./aggregateBuildQueueRequirements";
import type { BuildQueueRequirementsRequest, BuildQueueRequirementsResponse, BuildQueueWarning } from "./buildQueue.types";

export async function getBuildQueueRequirements(
  request: BuildQueueRequirementsRequest,
): Promise<BuildQueueRequirementsResponse> {
  const warnings: BuildQueueWarning[] = [];
  return {
    requirements: await aggregateBuildQueueRequirements(request, warnings),
    warnings,
  };
}

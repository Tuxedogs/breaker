import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

export type MissionPublicationGenerationContract = {
  missionSchemaVersion: number;
  sourceContractVersion: number;
  offerSchemaVersion?: number;
};

export type MissionPublicationGateReceiptV1 = {
  schemaVersion: 1;
  sourceBuildId: string;
  refIndex: {
    status: "explicit" | "not_configured";
    path?: string;
    sha256?: string;
    buildId?: string;
    recordCount: number;
    auditedBuildId?: string;
    auditedPath?: string;
  };
  semantics: {
    variantCount: number;
    reputationScopeResolvedCount: number;
    unresolvedLocationCount: number;
  };
};

function normalizedFilePath(value: string): string {
  return path.resolve(value).replaceAll("\\", "/").toLowerCase();
}

export function assertMissionPublicationGate(
  contract: MissionPublicationGenerationContract,
  receipt?: MissionPublicationGateReceiptV1,
): asserts receipt is MissionPublicationGateReceiptV1 {
  const isOfferGeneration = contract.missionSchemaVersion === 3
    && contract.sourceContractVersion === 4
    && contract.offerSchemaVersion === 1;
  if (!isOfferGeneration) return;
  if (!receipt || receipt.schemaVersion !== 1) {
    throw new Error("Offer-capable mission publication is missing its publication gate receipt.");
  }
  if (
    receipt.refIndex.status !== "explicit"
    || !receipt.refIndex.path
    || !receipt.refIndex.sha256
    || receipt.refIndex.recordCount <= 0
  ) {
    throw new Error("Offer-capable mission publication requires a configured, non-empty MISSION_REF_INDEX.");
  }
  if (
    !receipt.sourceBuildId
    || receipt.refIndex.buildId !== receipt.sourceBuildId
    || receipt.refIndex.auditedBuildId !== receipt.sourceBuildId
    || !receipt.refIndex.auditedPath
    || normalizedFilePath(receipt.refIndex.path) !== normalizedFilePath(receipt.refIndex.auditedPath)
    || !normalizedFilePath(receipt.refIndex.path).split("/").includes(receipt.sourceBuildId.toLowerCase())
  ) {
    throw new Error("MISSION_REF_INDEX does not match the accepted mission source build.");
  }
  const { variantCount, reputationScopeResolvedCount, unresolvedLocationCount } = receipt.semantics;
  if (variantCount <= 0 || reputationScopeResolvedCount <= 0) {
    throw new Error("Mission semantic publication gate rejected zero resolved reputation scopes.");
  }
  const severeUnresolvedLocationLimit = Math.max(50, Math.ceil(variantCount * 0.1));
  if (unresolvedLocationCount > severeUnresolvedLocationLimit) {
    throw new Error(
      `Mission semantic publication gate rejected ${unresolvedLocationCount} unresolved locations `
      + `(limit ${severeUnresolvedLocationLimit}).`,
    );
  }
}

export async function verifyMissionPublicationGate(
  contract: MissionPublicationGenerationContract,
  receipt?: MissionPublicationGateReceiptV1,
): Promise<void> {
  assertMissionPublicationGate(contract, receipt);
  if (!(
    contract.missionSchemaVersion === 3
    && contract.sourceContractVersion === 4
    && contract.offerSchemaVersion === 1
  )) return;
  const content = await readFile(receipt.refIndex.path!, "utf8").catch((reason: unknown) => {
    throw new Error(
      `Configured MISSION_REF_INDEX is not readable: ${reason instanceof Error ? reason.message : String(reason)}`,
    );
  });
  const sha256 = createHash("sha256").update(content).digest("hex");
  if (sha256 !== receipt.refIndex.sha256) {
    throw new Error("Configured MISSION_REF_INDEX changed after publication validation.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Configured MISSION_REF_INDEX is not valid JSON.");
  }
  if (!Array.isArray(parsed) || parsed.length !== receipt.refIndex.recordCount) {
    throw new Error("Configured MISSION_REF_INDEX record count does not match its publication receipt.");
  }
}

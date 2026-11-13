import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

type ReceiptArtifact = {
  sha256?: unknown;
};

type MiningGenerationReceipt = {
  buildId?: unknown;
  datasetRoot?: unknown;
  validatedAt?: unknown;
  receiptedAt?: unknown;
  validatedArtifacts?: Record<string, ReceiptArtifact | undefined>;
};

export type AcceptedMiningSourceProvenance = {
  buildId: string;
  datasetRoot: string;
  receiptPath: string;
  receiptSha256: string;
  validatedAt: string | null;
  receiptedAt: string | null;
  validatedArtifactHashes: Record<string, string>;
};

const REQUIRED_RECEIPTED_ARTIFACTS = [
  "mining/material_sources_quality_enriched.json",
  "recommendations/location_material_index.json",
] as const;

function normalizedPath(value: string): string {
  return path.resolve(value).replaceAll("\\", "/").toLowerCase();
}

async function sha256(filePath: string): Promise<string> {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`Accepted Mining receipt is missing ${label}.`);
  return value;
}

/**
 * Refuses source trees that are not the exact accepted Scintel dataset named by
 * the publication invocation. This protects against partial/manual registry
 * updates where hashes look internally valid but came from a different build.
 */
export async function verifyAcceptedMiningSource(
  sourceRoot: string,
  expectedBuildId: string,
): Promise<AcceptedMiningSourceProvenance> {
  const datasetRoot = path.resolve(sourceRoot);
  const receiptPath = path.join(datasetRoot, "..", "reports", "mining", "mining_generation_receipt.json");
  const receiptBytes = await readFile(receiptPath);
  const receipt = JSON.parse(receiptBytes.toString("utf8")) as MiningGenerationReceipt;
  const buildId = requiredString(receipt.buildId, "buildId");
  const receiptedDatasetRoot = requiredString(receipt.datasetRoot, "datasetRoot");

  if (buildId !== expectedBuildId) {
    throw new Error(`Accepted Mining receipt build ${buildId} does not match SCINTEL_SOURCE_BUILD_ID ${expectedBuildId}.`);
  }
  if (normalizedPath(receiptedDatasetRoot) !== normalizedPath(datasetRoot)) {
    throw new Error(`Accepted Mining receipt datasetRoot ${receiptedDatasetRoot} does not match SCINTEL_API_ROOT ${datasetRoot}.`);
  }

  const validatedArtifactHashes: Record<string, string> = {};
  for (const relativePath of REQUIRED_RECEIPTED_ARTIFACTS) {
    const expectedHash = receipt.validatedArtifacts?.[relativePath]?.sha256;
    if (typeof expectedHash !== "string" || !/^[a-f0-9]{64}$/i.test(expectedHash)) {
      throw new Error(`Accepted Mining receipt has no valid SHA-256 for ${relativePath}.`);
    }
    const actualHash = await sha256(path.join(datasetRoot, relativePath));
    if (actualHash !== expectedHash.toLowerCase()) {
      throw new Error(`Accepted Mining source hash mismatch for ${relativePath}: expected ${expectedHash}, received ${actualHash}.`);
    }
    validatedArtifactHashes[relativePath] = actualHash;
  }

  return {
    buildId,
    datasetRoot,
    receiptPath,
    receiptSha256: createHash("sha256").update(receiptBytes).digest("hex"),
    validatedAt: typeof receipt.validatedAt === "string" ? receipt.validatedAt : null,
    receiptedAt: typeof receipt.receiptedAt === "string" ? receipt.receiptedAt : null,
    validatedArtifactHashes,
  };
}

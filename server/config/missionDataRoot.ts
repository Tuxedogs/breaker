import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export function getMissionDataRoot(): string {
  const baseRoot = path.resolve(
    process.env.MISSION_DATA_ROOT ?? path.join(process.cwd(), "server-data", "missions"),
  );
  const pointerPath = path.join(baseRoot, "current.json");
  if (!existsSync(pointerPath)) return baseRoot;

  const pointer = JSON.parse(readFileSync(pointerPath, "utf8")) as {
    schemaVersion?: unknown;
    missionSchemaVersion?: unknown;
    sourceContractVersion?: unknown;
    offerSchemaVersion?: unknown;
    generationId?: unknown;
    generationPath?: unknown;
  };
  const supportedContract = (
    pointer.missionSchemaVersion === 2
    && pointer.sourceContractVersion === 3
    && pointer.offerSchemaVersion === undefined
  ) || (
    pointer.missionSchemaVersion === 3
    && pointer.sourceContractVersion === 4
    && pointer.offerSchemaVersion === 1
  );
  if (
    pointer.schemaVersion !== 1
    || !supportedContract
    || typeof pointer.generationId !== "string"
    || !pointer.generationId
    || typeof pointer.generationPath !== "string"
    || !pointer.generationPath
  ) {
    throw new Error("Mission current-generation pointer is invalid.");
  }
  const generationRoot = path.resolve(baseRoot, pointer.generationPath);
  const relativeToBase = path.relative(baseRoot, generationRoot);
  if (
    !relativeToBase
    || relativeToBase.startsWith("..")
    || path.isAbsolute(relativeToBase)
    || path.basename(generationRoot) !== pointer.generationId
  ) {
    throw new Error("Mission current-generation pointer escapes its data root.");
  }
  return generationRoot;
}

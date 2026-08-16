import { cp, mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  verifyMissionPublicationGate,
  type MissionPublicationGateReceiptV1,
} from "./publication-gates.mts";

type MissionGenerationPointerBaseV1 = {
  schemaVersion: 1;
  shaperVersion: string;
  generationId: string;
  generationPath: string;
};

export type MissionGenerationContractV1 =
  | {
    missionSchemaVersion: 2;
    sourceContractVersion: 3;
    offerSchemaVersion?: never;
  }
  | {
    missionSchemaVersion: 3;
    sourceContractVersion: 4;
    offerSchemaVersion: 1;
  };

export type MissionGenerationPointerV1 = MissionGenerationPointerBaseV1
  & MissionGenerationContractV1;

export function buildMissionGenerationPointerV1(options: {
  generationId: string;
  shaperVersion: string;
  generationContract?: MissionGenerationContractV1;
  publicationGate?: MissionPublicationGateReceiptV1;
}): MissionGenerationPointerV1 {
  const generationContract = options.generationContract ?? {
    missionSchemaVersion: 2,
    sourceContractVersion: 3,
  };
  return {
    schemaVersion: 1,
    ...generationContract,
    shaperVersion: options.shaperVersion,
    generationId: options.generationId,
    generationPath: `generations/${options.generationId}`,
  };
}

async function directoryExists(directory: string): Promise<boolean> {
  try {
    return (await stat(directory)).isDirectory();
  } catch {
    return false;
  }
}

export async function publishImmutableMissionGeneration(options: {
  missionRoot: string;
  stagingRoot: string;
  generationId: string;
  shaperVersion: string;
  generationContract?: MissionGenerationContractV1;
  legacyRootFiles: readonly string[];
  legacyShardDirectories: readonly string[];
}): Promise<MissionGenerationPointerV1> {
  const generationContract = options.generationContract ?? {
    missionSchemaVersion: 2,
    sourceContractVersion: 3,
  };
  await verifyMissionPublicationGate(generationContract, options.publicationGate);
  const generationsRoot = path.join(options.missionRoot, "generations");
  const finalGenerationRoot = path.join(generationsRoot, options.generationId);
  await mkdir(generationsRoot, { recursive: true });

  if (await directoryExists(finalGenerationRoot)) {
    await rm(options.stagingRoot, { recursive: true, force: true });
  } else {
    try {
      await rename(options.stagingRoot, finalGenerationRoot);
    } catch (reason) {
      const code = reason instanceof Error && "code" in reason
        ? String((reason as NodeJS.ErrnoException).code)
        : "";
      if (process.platform !== "win32" || code !== "EPERM") throw reason;
      await cp(options.stagingRoot, finalGenerationRoot, {
        recursive: true,
        errorOnExist: true,
        force: false,
      });
      await rm(options.stagingRoot, { recursive: true, force: true });
    }
  }

  const pointer = buildMissionGenerationPointerV1({
    shaperVersion: options.shaperVersion,
    generationId: options.generationId,
    generationContract: options.generationContract,
  });
  const pointerPath = path.join(options.missionRoot, "current.json");
  const temporaryPointerPath = path.join(
    options.missionRoot,
    `.current-${process.pid}-${options.generationId}.json`,
  );
  await writeFile(temporaryPointerPath, `${JSON.stringify(pointer, null, 2)}\n`, "utf8");
  await rm(pointerPath, { force: true });
  await rename(temporaryPointerPath, pointerPath);

  await Promise.all([
    ...options.legacyRootFiles.map((fileName) =>
      rm(path.join(options.missionRoot, fileName), { force: true })
    ),
    ...options.legacyShardDirectories.map((directory) =>
      rm(path.join(options.missionRoot, directory), { recursive: true, force: true })
    ),
  ]);
  return pointer;
}

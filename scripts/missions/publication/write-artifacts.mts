import { mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export type MissionGenerationPointerV1 = {
  schemaVersion: 1;
  missionSchemaVersion: 2;
  sourceContractVersion: 3;
  shaperVersion: string;
  generationId: string;
  generationPath: string;
};

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
  legacyRootFiles: readonly string[];
  legacyShardDirectories: readonly string[];
}): Promise<MissionGenerationPointerV1> {
  const generationsRoot = path.join(options.missionRoot, "generations");
  const finalGenerationRoot = path.join(generationsRoot, options.generationId);
  const relativeGenerationPath = `generations/${options.generationId}`;
  await mkdir(generationsRoot, { recursive: true });

  if (await directoryExists(finalGenerationRoot)) {
    await rm(options.stagingRoot, { recursive: true, force: true });
  } else {
    await rename(options.stagingRoot, finalGenerationRoot);
  }

  const pointer: MissionGenerationPointerV1 = {
    schemaVersion: 1,
    missionSchemaVersion: 2,
    sourceContractVersion: 3,
    shaperVersion: options.shaperVersion,
    generationId: options.generationId,
    generationPath: relativeGenerationPath,
  };
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

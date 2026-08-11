import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { getCraftingReferenceRoot } from "../server/config/craftingReferenceRoot.ts";
import { getScintelCraftingSourcePath } from "./lib/scintelDatasetSource.mts";

const outputRoot = getCraftingReferenceRoot();

const sources = [
  {
    source: getScintelCraftingSourcePath("crafted_properties.json"),
    target: "crafted-properties.json",
  },
  {
    source: getScintelCraftingSourcePath("quality_quantization.json"),
    target: "quality-quantization.json",
  },
  {
    source: getScintelCraftingSourcePath("material_quality_quantization.json"),
    target: "material-quality-quantization.json",
  },
  {
    source: getScintelCraftingSourcePath("material_identity_index.json"),
    target: "material-identity-index.json",
  },
] as const;

async function main() {
  await mkdir(outputRoot, { recursive: true });
  const manifest: Array<{ target: string; source: string; bytes: number }> = [];

  for (const entry of sources) {
    const raw = await readFile(entry.source, "utf8");
    const targetPath = path.join(outputRoot, entry.target);
    await writeFile(targetPath, raw, "utf8");
    manifest.push({
      target: entry.target,
      source: entry.source,
      bytes: Buffer.byteLength(raw, "utf8"),
    });
  }

  await writeFile(
    path.join(outputRoot, "manifest.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      files: manifest,
    }, null, 2)}\n`,
    "utf8",
  );

  console.log(JSON.stringify({ outputRoot, files: manifest }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

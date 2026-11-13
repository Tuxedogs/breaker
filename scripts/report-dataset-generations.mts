import { writeFile } from "node:fs/promises";
import path from "node:path";

import { checkPublishedDatasetConsistency } from "./missions/publication/dataset-consistency.mts";

// Usage: npm run data:generations:report [-- --out <file>]
const outIndex = process.argv.indexOf("--out");
const outPath = outIndex >= 0 ? process.argv[outIndex + 1] : undefined;

const report = checkPublishedDatasetConsistency({ serverDataRoot: path.resolve("server-data") });
const text = `${JSON.stringify(report, null, 2)}\n`;
if (outPath) await writeFile(path.resolve(outPath), text, "utf8");
process.stdout.write(text);
if (!report.ok) {
  console.error(`Published dataset generations are inconsistent: ${report.errors.map((e) => e.code).join(", ")}`);
  process.exit(1);
}

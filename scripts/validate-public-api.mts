import { readdir } from "node:fs/promises";
import path from "node:path";

const publicApiRoot = path.resolve("public", "api");
const forbiddenFilePatterns = [
  /\.bak_/,
  /_audit\.json$/i,
  /fixture.*\.json$/i,
  /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts|py|ps1|sh)$/i,
];
const forbiddenDirectoryNames = new Set(["server", "scripts"]);

async function walk(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (forbiddenDirectoryNames.has(entry.name)) {
        files.push(fullPath);
        continue;
      }
      files.push(...await walk(fullPath));
    } else if (entry.isFile() && forbiddenFilePatterns.some((pattern) => pattern.test(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

const offenders = await walk(publicApiRoot);

if (offenders.length > 0) {
  console.error("public/api contains non-contract artifacts:");
  for (const offender of offenders) {
    console.error(`- ${path.relative(process.cwd(), offender)}`);
  }
  process.exit(1);
}

console.log("public/api contract hygiene check passed.");

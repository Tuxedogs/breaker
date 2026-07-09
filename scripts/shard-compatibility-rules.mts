import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";

type CompatibilityRulesEnvelope = {
  records: unknown[];
  recordCount?: number;
  registry?: string;
  shard?: {
    index: number;
    total: number;
    source: string;
  };
  [key: string]: unknown;
};

async function shardCompatibilityRules(sourcePath: string, shardCount = 3): Promise<void> {
  const absoluteSource = path.resolve(sourcePath);
  const directory = path.dirname(absoluteSource);
  const raw = await readFile(absoluteSource, "utf8");
  const envelope = JSON.parse(raw) as CompatibilityRulesEnvelope;
  const records = envelope.records;
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error(`No records found in ${absoluteSource}`);
  }

  const chunkSize = Math.ceil(records.length / shardCount);
  const prefix = "compatibility_rules.part-";

  for (let index = 0; index < shardCount; index += 1) {
    const start = index * chunkSize;
    const chunk = records.slice(start, start + chunkSize);
    if (chunk.length === 0) continue;

    const shardEnvelope: CompatibilityRulesEnvelope = {
      ...envelope,
      recordCount: chunk.length,
      records: chunk,
      registry: "compatibility_rules",
      shard: {
        index: index + 1,
        total: shardCount,
        source: "compatibility_rules.json",
      },
    };

    const shardName = `${prefix}${String(index + 1).padStart(3, "0")}.json`;
    await writeFile(path.join(directory, shardName), `${JSON.stringify(shardEnvelope, null, 2)}\n`, "utf8");
  }

  await unlink(absoluteSource);
  console.log(
    JSON.stringify(
      {
        source: absoluteSource,
        recordCount: records.length,
        shardCount,
        outputDirectory: directory,
      },
      null,
      2,
    ),
  );
}

const target = process.argv[2];
if (!target) {
  console.error("Usage: node --import tsx scripts/shard-compatibility-rules.mts <compatibility_rules.json>");
  process.exit(1);
}

await mkdir(path.dirname(path.resolve(target)), { recursive: true });
await shardCompatibilityRules(target);

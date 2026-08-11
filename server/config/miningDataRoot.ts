import path from "node:path";

export function getMiningDataRoot(): string {
  return path.resolve(
    process.env.MINING_DATA_ROOT ?? path.join(process.cwd(), "server-data", "mining"),
  );
}

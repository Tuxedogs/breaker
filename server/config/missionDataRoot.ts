import path from "node:path";

export const publicMissionFallbackRoot = path.resolve(process.cwd(), "public", "api", "missions");

export function getMissionDataRoot(): string {
  if (process.env.MISSION_DATA_ROOT) {
    return path.resolve(process.env.MISSION_DATA_ROOT);
  }
  return path.resolve(process.cwd(), "server-data", "missions");
}
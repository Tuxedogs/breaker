import { recommenderApiPath } from "../config/apiPaths";
import { getRecommendations } from "../recommender";
import type { RecommendRequest } from "../recommender";

export async function handleRecommenderRoute(
  method: string,
  url: string,
  body: unknown,
): Promise<{ status: number; body: unknown } | null> {
  if (url !== recommenderApiPath) return null;
  if (method !== "POST") return { status: 405, body: { error: "Method not allowed" } };
  return { status: 200, body: await getRecommendations((body ?? {}) as RecommendRequest) };
}

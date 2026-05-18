import { AuthError, requireAuthenticatedUser } from "../auth/requireDiscordUserId";
import {
  getBlueprintTrackerState,
  saveBlueprintTrackerState,
} from "./blueprintTrackerService";

type HeaderValue = string | string[] | undefined;
type HeaderBag = Record<string, HeaderValue> | Headers;

type RouteResult = {
  status: number;
  body: unknown;
};

function safeError(status: number, message: string): RouteResult {
  return { status, body: { error: message } };
}

export async function handleBlueprintTrackerRoute(
  method: string,
  headers: HeaderBag,
  body: unknown,
): Promise<RouteResult> {
  try {
    if (!["GET", "PUT"].includes(method)) {
      return safeError(405, "Method not allowed.");
    }

    const { userId } = await requireAuthenticatedUser(headers);

    if (method === "GET") {
      return { status: 200, body: { state: await getBlueprintTrackerState(userId) } };
    }

    return { status: 200, body: { state: await saveBlueprintTrackerState(userId, body) } };
  } catch (error) {
    if (error instanceof AuthError) return safeError(error.status, error.message);
    if (error instanceof TypeError) return safeError(400, error.message);
    return safeError(500, "Database request failed.");
  }
}

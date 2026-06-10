import {
  calculateFittingLoadout,
  getCompatibleItems,
  getFittingLoadout,
  getFittingShip,
  listFittingComponents,
  listFittingShips,
  validateFittingLoadout,
} from "../fitting/fitting.service";

type RouteResult = { status: number; body: unknown };

function parseRouteUrl(rawUrl: string): URL {
  return new URL(rawUrl, "http://localhost");
}

function methodNotAllowed(): RouteResult {
  return { status: 405, body: { error: "Method not allowed" } };
}

export async function handleFittingRoute(
  method: string,
  rawUrl: string,
  body: unknown,
): Promise<RouteResult | null> {
  const url = parseRouteUrl(rawUrl);
  const path = url.pathname;

  if (path === "/api/fitting/ships") {
    if (method !== "GET") return methodNotAllowed();
    return listFittingShips();
  }

  const shipLoadoutMatch = path.match(/^\/api\/fitting\/ships\/([^/]+)\/loadout$/);
  if (shipLoadoutMatch) {
    if (method !== "GET") return methodNotAllowed();
    return getFittingLoadout(decodeURIComponent(shipLoadoutMatch[1] ?? ""));
  }

  const shipMatch = path.match(/^\/api\/fitting\/ships\/([^/]+)$/);
  if (shipMatch) {
    if (method !== "GET") return methodNotAllowed();
    return getFittingShip(decodeURIComponent(shipMatch[1] ?? ""));
  }

  if (path === "/api/fitting/components") {
    if (method !== "GET") return methodNotAllowed();
    return listFittingComponents();
  }

  if (path === "/api/fitting/compatible") {
    if (method !== "GET") return methodNotAllowed();
    return getCompatibleItems(url);
  }

  if (path === "/api/fitting/validate") {
    if (method !== "POST") return methodNotAllowed();
    return validateFittingLoadout(body);
  }

  if (path === "/api/fitting/calculate") {
    if (method !== "POST") return methodNotAllowed();
    return calculateFittingLoadout(body);
  }

  return null;
}

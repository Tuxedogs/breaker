export function logUnhandledRouteError(route: string, method: string, error: unknown): void {
  const errorName = error instanceof Error ? error.name : "Error";
  const errorMessage = error instanceof Error ? error.message : String(error);

  console.error(`[${route}] Unhandled route error.`, {
    route,
    method,
    errorName,
    errorMessage,
    stack: error instanceof Error ? error.stack : undefined,
  });
}

export function unhandledRouteErrorBody(error: unknown, message: string): Record<string, unknown> {
  const body: Record<string, unknown> = { error: message };
  if (process.env.NODE_ENV !== "production") {
    body.detail = error instanceof Error ? error.message : String(error);
  }
  return body;
}

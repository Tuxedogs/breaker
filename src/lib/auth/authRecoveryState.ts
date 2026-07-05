import { AuthApiError } from "@supabase/supabase-js";

let authRecoveryFailed = false;

export function isAuthRecoveryFailed(): boolean {
  return authRecoveryFailed;
}

export function markAuthRecoveryFailed(): void {
  authRecoveryFailed = true;
}

export function resetAuthRecoveryFailed(): void {
  authRecoveryFailed = false;
}

export function isInvalidRefreshTokenError(error: unknown): boolean {
  if (!error) return false;

  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (error instanceof AuthApiError) {
    const refreshTokenIssue = normalized.includes("refresh token");
    if (refreshTokenIssue && (error.status === 400 || error.status === 401 || error.status === 403)) {
      return true;
    }
  }

  if (!normalized.includes("refresh") || !normalized.includes("token")) {
    return false;
  }

  return (
    normalized.includes("invalid refresh token")
    || normalized.includes("refresh token not found")
    || normalized.includes("refresh token revoked")
    || normalized.includes("refresh token expired")
    || normalized.includes("invalid")
    || normalized.includes("not found")
    || normalized.includes("revoked")
    || normalized.includes("expired")
  );
}

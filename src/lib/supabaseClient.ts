import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
const postAuthRedirectKey = "scintel-post-auth-redirect";
const defaultPostAuthRedirect = "/dashboard";
const supabaseProjectRef = getSupabaseProjectRef(supabaseUrl);
const supabaseAuthStorageKey = supabaseProjectRef ? `sb-${supabaseProjectRef}-auth-token` : null;

let client: SupabaseClient | null = null;
let clientInitError: string | null = null;

function getSupabaseProjectRef(url: string | undefined) {
  if (!url) return null;
  try {
    return new URL(url).hostname.split(".")[0] || null;
  } catch {
    return null;
  }
}

export interface SupabaseAuthDiagnostic {
  available: boolean;
  missingEnv: string[];
  message: string | null;
}

function getMissingSupabaseEnv() {
  return [
    supabaseUrl ? null : "VITE_SUPABASE_URL",
    supabaseAnonKey ? null : "VITE_SUPABASE_ANON_KEY",
  ].filter((key): key is string => Boolean(key));
}

export function getSupabaseAuthDiagnostic(): SupabaseAuthDiagnostic {
  const missingEnv = getMissingSupabaseEnv();
  if (missingEnv.length > 0) {
    return {
      available: false,
      missingEnv,
      message: `Missing ${missingEnv.join(", ")}.`,
    };
  }

  if (clientInitError) {
    return {
      available: false,
      missingEnv: [],
      message: `Supabase client failed to initialize: ${clientInitError}`,
    };
  }

  return { available: true, missingEnv: [], message: null };
}

export function hasSupabaseConfig() {
  return getSupabaseAuthDiagnostic().available;
}

export function getSupabaseClient() {
  const diagnostic = getSupabaseAuthDiagnostic();
  if (!diagnostic.available) {
    throw new Error(diagnostic.message ?? "Supabase auth is unavailable.");
  }

  if (!client) {
    try {
      client = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: "pkce",
        },
      });
      clientInitError = null;
    } catch (error) {
      clientInitError = error instanceof Error ? error.message : String(error);
      throw new Error(`Supabase client failed to initialize: ${clientInitError}`);
    }
  }
  return client;
}

export function hasSupabaseAuthStorageKey() {
  if (!supabaseAuthStorageKey) return false;
  return window.localStorage.getItem(supabaseAuthStorageKey) !== null;
}

export function getSupabaseAuthStorageKey() {
  return supabaseAuthStorageKey;
}

function getCurrentPostAuthRedirectPath() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function isAllowedPostAuthRedirectPath(path: string | null) {
  return Boolean(
    path === defaultPostAuthRedirect
      || path?.startsWith("/industry/crafting")
      || path?.startsWith("/industry/blueprint-tracker")
      || path?.startsWith("/logistics/inventory")
  );
}

export async function signInWithDiscord() {
  const supabase = getSupabaseClient();
  const path = getCurrentPostAuthRedirectPath();
  const nextPath = isAllowedPostAuthRedirectPath(path) ? path : defaultPostAuthRedirect;
  const redirectTo = `${window.location.origin}/auth/callback`;
  window.sessionStorage.setItem(postAuthRedirectKey, nextPath);

  if (import.meta.env.DEV) {
    console.info("[auth] Supabase URL", supabaseUrl);
    console.info("[auth] Discord redirect", {
      redirectTo,
      postAuthPath: nextPath,
    });
  }

  return supabase.auth.signInWithOAuth({
    provider: "discord",
    options: {
      redirectTo,
      scopes: "identify",
    },
  });
}

export async function logout() {
  const supabase = getSupabaseClient();
  return supabase.auth.signOut();
}

export function consumePostAuthRedirect() {
  const path = window.sessionStorage.getItem(postAuthRedirectKey);
  window.sessionStorage.removeItem(postAuthRedirectKey);
  if (isAllowedPostAuthRedirectPath(path)) {
    return path;
  }
  return defaultPostAuthRedirect;
}

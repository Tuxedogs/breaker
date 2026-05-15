import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const postAuthRedirectKey = "scintel-post-auth-redirect";

let client: SupabaseClient | null = null;

export function hasSupabaseConfig() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export function getSupabaseClient() {
  if (!hasSupabaseConfig()) {
    throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.");
  }

  client ??= createClient(supabaseUrl, supabaseAnonKey);
  return client;
}

export async function signInWithDiscord() {
  const supabase = getSupabaseClient();
  const path = `${window.location.pathname}${window.location.search}`;
  const nextPath = path.startsWith("/logistics/inventory") ? path : "/dashboard";
  const redirectTo = `${window.location.origin}/auth/callback`;
  window.sessionStorage.setItem(postAuthRedirectKey, nextPath);

  if (import.meta.env.DEV) {
    console.info("[auth] Supabase URL", supabaseUrl);
    console.info("[auth] Discord redirectTo", redirectTo);
  }

  return supabase.auth.signInWithOAuth({
    provider: "discord",
    options: {
      redirectTo,
      scopes: "identify email",
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
  if (path === "/dashboard" || path?.startsWith("/logistics/inventory")) {
    return path;
  }
  return "/dashboard";
}

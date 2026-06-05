import { createContext, createElement, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseClient, hasSupabaseAuthStorageKey, hasSupabaseConfig } from "../supabaseClient";

interface AuthSessionState {
  session: Session | null;
  user: User | null;
  loading: boolean;
}

const unauthenticatedState: AuthSessionState = {
  session: null,
  user: null,
  loading: false,
};

const AuthSessionContext = createContext<AuthSessionState | null>(null);
export const authSessionRefreshEvent = "scintel:auth-session-refresh";
const sessionRetryDelays = [0, 75, 200, 500];

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function hasAccessTokenHash() {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return hashParams.has("access_token");
}

async function getSessionWithRetry(shouldRetry: boolean) {
  const supabase = getSupabaseClient();
  let lastSession: Session | null = null;

  for (const delay of shouldRetry ? sessionRetryDelays : [0]) {
    if (delay > 0) {
      await wait(delay);
    }

    const { data } = await supabase.auth.getSession();
    lastSession = data.session;
    if (lastSession) break;
  }

  return lastSession;
}

function logAuthStateSnapshot(source: string, session: Session | null) {
  if (!import.meta.env.DEV) return;

  const metadata = session?.user?.user_metadata;
  const metadataKeys = metadata && typeof metadata === "object" ? Object.keys(metadata) : [];
  console.info("[auth] session snapshot", {
    source,
    pathname: window.location.pathname,
    hasAccessTokenHash: hasAccessTokenHash(),
    sessionExists: Boolean(session),
    userIdExists: Boolean(session?.user?.id),
    hasSupabaseAuthKey: hasSupabaseAuthStorageKey(),
    metadataKeys,
  });
}

function useAuthSessionState(): AuthSessionState {
  const [state, setState] = useState<AuthSessionState>({
    session: null,
    user: null,
    loading: hasSupabaseConfig(),
  });

  useEffect(() => {
    if (!hasSupabaseConfig()) {
      return;
    }

    const supabase = getSupabaseClient();
    let mounted = true;

    function refreshSession(source: string) {
      getSessionWithRetry(hasAccessTokenHash()).then((session) => {
        if (!mounted) return;
        logAuthStateSnapshot(source, session);
        setState({
          session,
          user: session?.user ?? null,
          loading: false,
        });
      }).catch((error: unknown) => {
        if (import.meta.env.DEV) {
          console.warn("[auth] getSession failed", error instanceof Error ? error.message : String(error));
        }
        if (!mounted) return;
        setState(unauthenticatedState);
      });
    }

    refreshSession("getSession");

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      logAuthStateSnapshot(`onAuthStateChange:${event}`, session);
      setState({
        session,
        user: session?.user ?? null,
        loading: false,
      });
    });
    const handleAuthSessionRefresh = () => refreshSession("callbackRefresh");
    window.addEventListener(authSessionRefreshEvent, handleAuthSessionRefresh);

    return () => {
      mounted = false;
      window.removeEventListener(authSessionRefreshEvent, handleAuthSessionRefresh);
      authListener.subscription.unsubscribe();
    };
  }, []);

  return state;
}

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const state = useAuthSessionState();
  const value = useMemo(() => state, [state]);

  return createElement(AuthSessionContext.Provider, { value }, children);
}

export function useAuthSession(): AuthSessionState {
  return useContext(AuthSessionContext) ?? unauthenticatedState;
}

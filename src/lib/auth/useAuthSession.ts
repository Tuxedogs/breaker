import { createContext, createElement, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseClient, hasSupabaseConfig } from "../supabaseClient";

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

function logAuthStateSnapshot(source: string, session: Session | null) {
  if (!import.meta.env.DEV) return;

  const metadata = session?.user?.user_metadata;
  const metadataKeys = metadata && typeof metadata === "object" ? Object.keys(metadata) : [];
  console.info("[auth] session snapshot", {
    source,
    sessionExists: Boolean(session),
    userIdExists: Boolean(session?.user?.id),
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
      setState({ session: null, user: null, loading: false });
      return;
    }

    const supabase = getSupabaseClient();
    let mounted = true;

    function refreshSession(source: string) {
      supabase.auth.getSession().then(({ data }) => {
        if (!mounted) return;
        logAuthStateSnapshot(source, data.session);
        setState({
          session: data.session,
          user: data.session?.user ?? null,
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

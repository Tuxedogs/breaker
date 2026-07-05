import { createContext, createElement, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { handleInvalidRefreshToken } from "./authSessionRecovery";
import {
  isAuthRecoveryFailed,
  isInvalidRefreshTokenError,
  resetAuthRecoveryFailed,
} from "./authRecoveryState";
import { getSupabaseClient, hasSupabaseAuthStorageKey, hasSupabaseConfig } from "../supabaseClient";

interface AuthSessionState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  sessionExpired: boolean;
}

const unauthenticatedState: AuthSessionState = {
  session: null,
  user: null,
  loading: false,
  sessionExpired: false,
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
  if (isAuthRecoveryFailed()) {
    return { session: null as Session | null, sessionExpired: true };
  }

  const supabase = getSupabaseClient();
  let lastSession: Session | null = null;
  const delays = shouldRetry ? sessionRetryDelays : [0];

  for (const delay of delays) {
    if (delay > 0) {
      await wait(delay);
    }

    const { data, error } = await supabase.auth.getSession();
    if (error && isInvalidRefreshTokenError(error)) {
      await handleInvalidRefreshToken("getSession");
      return { session: null, sessionExpired: true };
    }
    if (error && import.meta.env.DEV) {
      console.warn("[auth] getSession error", error.message);
    }

    lastSession = data.session;
    if (lastSession) break;
  }

  return { session: lastSession, sessionExpired: false };
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
    sessionExpired: false,
  });

  useEffect(() => {
    if (!hasSupabaseConfig()) {
      return;
    }

    const supabase = getSupabaseClient();
    let mounted = true;

    function setUnauthenticated(sessionExpired: boolean) {
      if (!mounted) return;
      setState({
        ...unauthenticatedState,
        sessionExpired,
      });
    }

    function refreshSession(source: string) {
      getSessionWithRetry(hasAccessTokenHash()).then(({ session, sessionExpired }) => {
        if (!mounted) return;
        logAuthStateSnapshot(source, session);
        setState({
          session,
          user: session?.user ?? null,
          loading: false,
          sessionExpired,
        });
      }).catch(async (error: unknown) => {
        if (isInvalidRefreshTokenError(error)) {
          await handleInvalidRefreshToken("getSessionCatch");
          setUnauthenticated(true);
          return;
        }
        if (import.meta.env.DEV) {
          console.warn("[auth] getSession failed", error instanceof Error ? error.message : String(error));
        }
        setUnauthenticated(false);
      });
    }

    refreshSession("getSession");

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === "SIGNED_IN" && session) {
        resetAuthRecoveryFailed();
        logAuthStateSnapshot(`onAuthStateChange:${event}`, session);
        setState({
          session,
          user: session.user,
          loading: false,
          sessionExpired: false,
        });
        return;
      }

      if (event === "SIGNED_OUT") {
        logAuthStateSnapshot(`onAuthStateChange:${event}`, session);
        setState({
          session: null,
          user: null,
          loading: false,
          sessionExpired: isAuthRecoveryFailed(),
        });
        return;
      }

      logAuthStateSnapshot(`onAuthStateChange:${event}`, session);
      setState({
        session,
        user: session?.user ?? null,
        loading: false,
        sessionExpired: isAuthRecoveryFailed(),
      });
    });

    const handleAuthSessionRefresh = () => refreshSession("callbackRefresh");
    window.addEventListener(authSessionRefreshEvent, handleAuthSessionRefresh);

    function handleUnhandledRejection(event: PromiseRejectionEvent) {
      if (!isInvalidRefreshTokenError(event.reason)) return;
      event.preventDefault();
      void handleInvalidRefreshToken("unhandledRejection").then(() => {
        setUnauthenticated(true);
      });
    }

    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      mounted = false;
      window.removeEventListener(authSessionRefreshEvent, handleAuthSessionRefresh);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
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

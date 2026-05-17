import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { authSessionRefreshEvent } from "../lib/auth/useAuthSession";
import {
  consumePostAuthRedirect,
  getSupabaseClient,
  hasSupabaseAuthStorageKey,
  hasSupabaseConfig,
} from "../lib/supabaseClient";

const noSessionMessage = "Auth callback completed but no Supabase session was found.";
const sessionRetryDelays = [0, 75, 200, 500];

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function hasAccessTokenHash() {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return hashParams.has("access_token");
}

function getSessionMetadataKeys(session: Session | null) {
  const metadata = session?.user?.user_metadata;
  return metadata && typeof metadata === "object" ? Object.keys(metadata) : [];
}

async function getSessionWithRetry(supabase: SupabaseClient, shouldRetry: boolean) {
  let lastError: Error | null = null;

  for (const delay of shouldRetry ? sessionRetryDelays : [0]) {
    if (delay > 0) {
      await wait(delay);
    }

    const { data, error } = await supabase.auth.getSession();
    if (error) {
      lastError = error;
    }
    if (data.session) {
      return { session: data.session, error };
    }
  }

  return { session: null as Session | null, error: lastError };
}

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!hasSupabaseConfig()) {
      navigate("/dashboard", { replace: true });
      return;
    }

    const supabase = getSupabaseClient();
    const code = new URLSearchParams(window.location.search).get("code");
    const hasCode = Boolean(code);
    const hasHashToken = hasAccessTokenHash();

    async function completeSignIn() {
      if (hasCode && code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error && import.meta.env.DEV) {
          console.warn("[auth] OAuth code exchange failed", error.message);
        }
      }

      const { session, error } = await getSessionWithRetry(supabase, hasHashToken && !hasCode);
      if (import.meta.env.DEV) {
        console.info("[auth] callback session", {
          pathname: window.location.pathname,
          hasCode,
          hasAccessTokenHash: hasHashToken,
          sessionExists: Boolean(session),
          userIdExists: Boolean(session?.user?.id),
          hasSupabaseAuthKey: hasSupabaseAuthStorageKey(),
          metadataKeys: getSessionMetadataKeys(session),
          sessionError: error?.message ?? null,
        });
      }

      if (!session) {
        if (hasHashToken) {
          console.warn("[auth] OAuth hash token was present, but Supabase did not store a session.");
        }
        console.error(`[auth] ${noSessionMessage}`);
        setErrorMessage(noSessionMessage);
        return;
      }

      window.dispatchEvent(new Event(authSessionRefreshEvent));
      navigate(consumePostAuthRedirect() || "/dashboard", { replace: true });
    }

    completeSignIn().catch((error: unknown) => {
      if (import.meta.env.DEV) {
        console.warn("[auth] callback failed", error instanceof Error ? error.message : String(error));
      }
      console.error(`[auth] ${noSessionMessage}`);
      setErrorMessage(noSessionMessage);
    });
  }, [navigate]);

  return (
    <div className="dash-page">
      <div className="flex min-h-screen flex-1 items-center justify-center px-4 text-center">
        <p className="base-card-kicker">{errorMessage ?? "Completing sign in..."}</p>
      </div>
    </div>
  );
}

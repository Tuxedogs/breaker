import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { consumePostAuthRedirect, getSupabaseClient, hasSupabaseConfig } from "../lib/supabaseClient";

export default function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!hasSupabaseConfig()) {
      navigate("/dashboard", { replace: true });
      return;
    }

    const supabase = getSupabaseClient();
    const code = new URLSearchParams(window.location.search).get("code");

    async function completeSignIn() {
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error && import.meta.env.DEV) {
          console.warn("[auth] OAuth code exchange failed", error.message);
        }
      }

      const { data, error } = await supabase.auth.getSession();
      if (import.meta.env.DEV) {
        const metadata = data.session?.user?.user_metadata;
        console.info("[auth] callback session", {
          sessionExists: Boolean(data.session),
          userIdExists: Boolean(data.session?.user?.id),
          metadataKeys: metadata && typeof metadata === "object" ? Object.keys(metadata) : [],
          sessionError: error?.message ?? null,
        });
      }

      navigate(data.session ? consumePostAuthRedirect() : "/dashboard", { replace: true });
    }

    completeSignIn().catch((error: unknown) => {
      if (import.meta.env.DEV) {
        console.warn("[auth] callback failed", error instanceof Error ? error.message : String(error));
      }
      navigate("/dashboard", { replace: true });
    });
  }, [navigate]);

  return (
    <div className="dash-page">
      <div className="flex min-h-screen flex-1 items-center justify-center px-4 text-center">
        <p className="base-card-kicker">Completing sign in...</p>
      </div>
    </div>
  );
}

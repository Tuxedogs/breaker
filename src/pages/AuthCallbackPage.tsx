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

    getSupabaseClient().auth.getSession().then(({ data }) => {
      navigate(data.session ? consumePostAuthRedirect() : "/dashboard", { replace: true });
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

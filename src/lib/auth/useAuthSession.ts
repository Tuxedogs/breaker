import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseClient, hasSupabaseConfig } from "../supabaseClient";

interface AuthSessionState {
  session: Session | null;
  user: User | null;
  loading: boolean;
}

export function useAuthSession(): AuthSessionState {
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

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setState({
        session: data.session,
        user: data.session?.user ?? null,
        loading: false,
      });
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({
        session,
        user: session?.user ?? null,
        loading: false,
      });
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  return state;
}

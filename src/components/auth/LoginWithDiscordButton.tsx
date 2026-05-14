import { useState } from "react";
import type { MouseEventHandler } from "react";
import type { User } from "@supabase/supabase-js";
import { logout, signInWithDiscord } from "../../lib/supabaseClient";
import { useAuthSession } from "../../lib/auth/useAuthSession";

interface LoginWithDiscordButtonProps {
  className?: string;
  collapsed?: boolean;
  onMouseEnter?: MouseEventHandler<HTMLButtonElement>;
  onMouseLeave?: MouseEventHandler<HTMLButtonElement>;
}

function getUserLabel(user: User | null) {
  const username = user?.user_metadata?.preferred_username
    ?? user?.user_metadata?.user_name
    ?? user?.user_metadata?.name
    ?? user?.email;
  return typeof username === "string" && username.trim() ? username : "Signed in";
}

export default function LoginWithDiscordButton({
  className,
  collapsed = false,
  onMouseEnter,
  onMouseLeave,
}: LoginWithDiscordButtonProps) {
  const { user, loading } = useAuthSession();
  const [busy, setBusy] = useState(false);
  const signedIn = Boolean(user);
  const disabled = loading || busy;

  async function handleClick() {
    setBusy(true);
    try {
      if (signedIn) {
        await logout();
      } else {
        await signInWithDiscord();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={className}
      aria-label={signedIn ? "Sign out" : "Sign in with Discord"}
      onClick={handleClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      disabled={disabled}
    >
      <div className="dash-user-avatar" aria-hidden />
      {!collapsed && (
        <div className="dash-user-info">
          <span className="dash-user-name">{loading ? "Checking session" : signedIn ? getUserLabel(user) : "Sign in"}</span>
          <span className="dash-user-level">{signedIn ? "Discord connected" : "Discord auth"}</span>
        </div>
      )}
    </button>
  );
}

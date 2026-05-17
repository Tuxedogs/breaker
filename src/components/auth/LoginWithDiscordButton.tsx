import { useEffect, useState } from "react";
import type { MouseEventHandler } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseAuthDiagnostic, logout, signInWithDiscord } from "../../lib/supabaseClient";
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
    ?? user?.user_metadata?.full_name
    ?? user?.user_metadata?.name
    ?? user?.user_metadata?.provider_id
    ?? user?.email;
  return typeof username === "string" && username.trim() ? username : "Signed in";
}

function getUserLabelSource(user: User | null) {
  if (typeof user?.user_metadata?.preferred_username === "string" && user.user_metadata.preferred_username.trim()) {
    return "preferred_username";
  }
  if (typeof user?.user_metadata?.user_name === "string" && user.user_metadata.user_name.trim()) {
    return "user_name";
  }
  if (typeof user?.user_metadata?.full_name === "string" && user.user_metadata.full_name.trim()) {
    return "full_name";
  }
  if (typeof user?.user_metadata?.name === "string" && user.user_metadata.name.trim()) {
    return "name";
  }
  if (typeof user?.user_metadata?.provider_id === "string" && user.user_metadata.provider_id.trim()) {
    return "provider_id";
  }
  if (typeof user?.email === "string" && user.email.trim()) {
    return "email";
  }
  return null;
}

function getUserAvatarUrl(user: User | null) {
  const avatarUrl = user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture;
  return typeof avatarUrl === "string" && avatarUrl.trim() ? avatarUrl : null;
}

function getUserAvatarSource(user: User | null) {
  if (typeof user?.user_metadata?.avatar_url === "string" && user.user_metadata.avatar_url.trim()) {
    return "avatar_url";
  }
  if (typeof user?.user_metadata?.picture === "string" && user.user_metadata.picture.trim()) {
    return "picture";
  }
  return null;
}

function getUserInitials(user: User | null) {
  const label = getUserLabel(user);
  const parts = label
    .replace(/[@#].*$/, "")
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const initials = parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : label.slice(0, 2);
  return initials.toUpperCase();
}

function DiscordLogo() {
  return (
    <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

function getSafeAuthErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

export default function LoginWithDiscordButton({
  className,
  collapsed = false,
  onMouseEnter,
  onMouseLeave,
}: LoginWithDiscordButtonProps) {
  const { user, loading } = useAuthSession();
  const [busy, setBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const signedIn = Boolean(user);
  const disabled = loading || busy;
  const userLabel = getUserLabel(user);
  const avatarUrl = getUserAvatarUrl(user);
  const title = authError ?? (signedIn ? `${userLabel} - click to sign out` : undefined);
  const avatar = signedIn ? (
    <span className="discord-btn-avatar" aria-hidden>
      {avatarUrl ? <img src={avatarUrl} alt="" referrerPolicy="no-referrer" /> : getUserInitials(user)}
    </span>
  ) : (
    <DiscordLogo />
  );

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    const metadata = user?.user_metadata;
    console.info("[auth] login button state", {
      loading,
      signedIn,
      userIdExists: Boolean(user?.id),
      metadataKeys: metadata && typeof metadata === "object" ? Object.keys(metadata) : [],
      labelSource: getUserLabelSource(user),
      avatarSource: getUserAvatarSource(user),
    });
  }, [loading, signedIn, user]);

  async function handleClick() {
    if (import.meta.env.DEV) {
      console.info("[auth] login button clicked");
    }

    setBusy(true);
    setAuthError(null);
    try {
      if (!signedIn) {
        const diagnostic = getSupabaseAuthDiagnostic();
        if (!diagnostic.available) {
          throw new Error(diagnostic.message ?? "Supabase auth is unavailable.");
        }
      }
      if (signedIn) {
        await logout();
      } else {
        const { error } = await signInWithDiscord();
        if (error) {
          console.error("[auth] Discord sign-in failed", error);
          setAuthError(error.message);
        }
      }
    } catch (error) {
      const message = getSafeAuthErrorMessage(error);
      const diagnostic = getSupabaseAuthDiagnostic();
      console.error("[auth] Discord sign-in failed", {
        message,
        missingEnv: diagnostic.missingEnv,
        authAvailable: diagnostic.available,
      });
      setAuthError(message);
    } finally {
      setBusy(false);
    }
  }

  if (collapsed) {
    return (
      <button
        type="button"
        className={["discord-btn discord-btn--icon", className].filter(Boolean).join(" ")}
        aria-label={signedIn ? "Sign out" : "Sign in with Discord"}
        onClick={handleClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        disabled={disabled}
        title={title}
      >
        {avatar}
      </button>
    );
  }

  return (
    <button
      type="button"
      className={["discord-btn", signedIn ? "discord-btn--signed-in" : "", className].filter(Boolean).join(" ")}
      aria-label={signedIn ? "Sign out" : "Sign in with Discord"}
      onClick={handleClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      disabled={disabled}
      title={title}
    >
      {avatar}
      <span className="discord-btn-label">
        {authError ?? (loading ? "Checking..." : signedIn ? userLabel : "Sign in with Discord")}
      </span>
      {signedIn && <span className="discord-btn-status">connected</span>}
    </button>
  );
}

import { createClient, type User } from "@supabase/supabase-js";
import { sql } from "drizzle-orm";

import { getDb } from "../../db/client";
import { profiles } from "../../db/schema";

type HeaderValue = string | string[] | undefined;
type HeaderBag = Record<string, HeaderValue> | Headers;

export class AuthError extends Error {
  readonly status = 401;

  constructor(message = "Authentication required.") {
    super(message);
    this.name = "AuthError";
  }
}

export interface AuthenticatedUserContext {
  userId: string;
  discordId: string | null;
  user: User;
}

function getHeader(headers: HeaderBag, name: string): string | undefined {
  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    return headers.get(name) ?? undefined;
  }

  const value = (headers as Record<string, HeaderValue>)[name.toLowerCase()]
    ?? (headers as Record<string, HeaderValue>)[name];
  return Array.isArray(value) ? value[0] : value;
}

function getBearerToken(headers: HeaderBag): string | null {
  const authorization = getHeader(headers, "authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getDiscordUserId(user: User): string | null {
  const discordIdentity = user.identities?.find((identity) => identity.provider === "discord");
  const identityRecord = asRecord(discordIdentity);
  const identityData = asRecord(discordIdentity?.identity_data);
  const appMetadata = asRecord(user.app_metadata);
  const userMetadata = asRecord(user.user_metadata);

  return (
    asString(identityRecord.provider_id)
    ?? asString(identityData.provider_id)
    ?? asString(identityData.sub)
    ?? asString(identityData.id)
    ?? asString(appMetadata.provider_id)
    ?? asString(userMetadata.provider_id)
    ?? asString(userMetadata.sub)
    ?? null
  );
}

function getMetadataString(user: User, keys: string[]): string | null {
  const userMetadata = asRecord(user.user_metadata);
  const appMetadata = asRecord(user.app_metadata);
  const discordIdentity = user.identities?.find((identity) => identity.provider === "discord");
  const identityData = asRecord(discordIdentity?.identity_data);

  for (const key of keys) {
    const value = asString(userMetadata[key]) ?? asString(identityData[key]) ?? asString(appMetadata[key]);
    if (value) return value;
  }

  return null;
}

async function upsertProfile(context: AuthenticatedUserContext) {
  const displayName = getMetadataString(context.user, ["full_name", "name", "preferred_username", "user_name"]);
  const discordUsername = getMetadataString(context.user, ["preferred_username", "user_name", "name"]);
  const avatarUrl = getMetadataString(context.user, ["avatar_url", "picture"]);

  await getDb()
    .insert(profiles)
    .values({
      id: context.userId,
      discordId: context.discordId,
      discordUsername,
      displayName,
      avatarUrl,
      metadata: {
        email: context.user.email ?? null,
        provider: "discord",
      },
      updatedAt: sql`now()`,
    })
    .onConflictDoUpdate({
      target: profiles.id,
      set: {
        discordId: context.discordId,
        discordUsername,
        displayName,
        avatarUrl,
        metadata: {
          email: context.user.email ?? null,
          provider: "discord",
        },
        updatedAt: sql`now()`,
      },
    });
}

export async function requireAuthenticatedUser(headers: HeaderBag): Promise<AuthenticatedUserContext> {
  const token = getBearerToken(headers);
  if (!token) throw new AuthError();

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new AuthError("Authentication is not configured.");
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new AuthError();

  const discordUserId = getDiscordUserId(data.user);
  if (!discordUserId) throw new AuthError("Discord identity is required.");

  const context = {
    userId: data.user.id,
    discordId: discordUserId,
    user: data.user,
  };
  await upsertProfile(context);
  return context;
}

export async function requireDiscordUserId(headers: HeaderBag): Promise<string> {
  const context = await requireAuthenticatedUser(headers);
  if (!context.discordId) throw new AuthError("Discord identity is required.");
  return context.discordId;
}

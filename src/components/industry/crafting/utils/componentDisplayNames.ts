// Tokens that are never meaningful as a standalone display name.
const BAD_TOKEN_RE = /^(Scitem|Item|Vehicle|Component|S\d{1,2}|\d+)$/i;

function isBadToken(token: string): boolean {
  return BAD_TOKEN_RE.test(token);
}

export function getComponentDisplayName(rawName: string): string {
  if (!rawName) return "Unknown Component";
  const tokens = rawName.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "Unknown Component";

  // Scitem fallback: token immediately before "Scitem" is usually the model name.
  // Only use it if it is not itself a bad token.
  const scitemIndex = tokens.indexOf("Scitem");
  if (scitemIndex > 0) {
    const candidate = tokens[scitemIndex - 1];
    if (!isBadToken(candidate)) return candidate;
  }

  // Strip all bad tokens and join the rest.
  // Handles "Wep Tractorbeam S1 Military 1" → "Wep Tractorbeam Military"
  // and "Grin Tractorbeam S1" → "Grin Tractorbeam".
  const cleaned = tokens.filter((t) => !isBadToken(t));
  if (cleaned.length > 0) return cleaned.join(" ");

  return rawName;
}

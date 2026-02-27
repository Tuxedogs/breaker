export type ParsedMdx = {
  frontmatter: Record<string, unknown>;
  body: string;
};

function unwrapRawMdx(rawContent: unknown, filePath: string, depth = 0): string {
  if (depth > 8) {
    throw new Error(`[content] ${filePath} raw MDX import exceeded unwrap depth.`);
  }

  if (typeof rawContent === "string") {
    return rawContent;
  }

  if (typeof rawContent === "function") {
    throw new Error(
      `[content] ${filePath} raw MDX import resolved to a loader function. Ensure import.meta.glob uses eager: true for raw content imports.`
    );
  }

  if (rawContent && typeof rawContent === "object") {
    const obj = rawContent as Record<string, unknown>;

    if ("default" in obj) {
      return unwrapRawMdx(obj.default, filePath, depth + 1);
    }

    if (typeof obj.raw === "string") {
      return obj.raw;
    }

    const stringValue = Object.values(obj).find((value) => typeof value === "string");
    if (typeof stringValue === "string") {
      return stringValue;
    }
  }

  throw new Error(
    `[content] ${filePath} raw MDX import is not a string. Expected ?raw text import, received ${typeof rawContent}.`
  );
}

function parseValue(rawValue: string, filePath: string, key: string): unknown {
  const trimmed = rawValue.trim();
  if (!trimmed) return "";

  if (
    trimmed.startsWith('"') ||
    trimmed.startsWith("[") ||
    trimmed.startsWith("{") ||
    trimmed === "true" ||
    trimmed === "false" ||
    /^-?\d+(\.\d+)?$/.test(trimmed)
  ) {
    try {
      return JSON.parse(trimmed);
    } catch (error) {
      throw new Error(
        `[content] ${filePath} has invalid JSON-like frontmatter for "${key}": ${String(error)}`
      );
    }
  }

  return trimmed;
}

export function parseMdxFile(rawContent: unknown, filePath: string): ParsedMdx {
  const raw = unwrapRawMdx(rawContent, filePath);
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    throw new Error(
      `[content] ${filePath} is missing frontmatter. Expected a leading --- block.`
    );
  }

  const [, frontmatterBlock, body = ""] = match;
  const frontmatter: Record<string, unknown> = {};

  for (const line of frontmatterBlock.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf(":");
    if (separatorIndex < 1) {
      throw new Error(`[content] ${filePath} has invalid frontmatter line: "${line}"`);
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1);
    frontmatter[key] = parseValue(rawValue, filePath, key);
  }

  return { frontmatter, body };
}

export function requireString(meta: Record<string, unknown>, key: string, filePath: string): string {
  const value = meta[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`[content] ${filePath} is missing required string field "${key}"`);
  }
  return value;
}

export function optionalString(meta: Record<string, unknown>, key: string): string | undefined {
  const value = meta[key];
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }
  return value;
}

export function requireStringArray(
  meta: Record<string, unknown>,
  key: string,
  filePath: string
): string[] {
  const value = meta[key];
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== "string")) {
    throw new Error(`[content] ${filePath} is missing required string[] field "${key}"`);
  }
  return value;
}

export function optionalStringArray(meta: Record<string, unknown>, key: string): string[] {
  const value = meta[key];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    return [];
  }
  return value;
}

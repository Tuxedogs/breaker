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

  // Bracket arrays — try JSON first, fall back to unquoted comma list
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      const inner = trimmed.slice(1, -1).trim();
      if (!inner) return [];
      return inner.split(",").map((s) => {
        const t = s.trim();
        if (
          (t.startsWith('"') && t.endsWith('"')) ||
          (t.startsWith("'") && t.endsWith("'"))
        ) {
          return t.slice(1, -1);
        }
        return t;
      });
    }
  }

  return trimmed;
}

// Parse a YAML block sequence into an array of strings or objects.
// Input: lines already known to be indented block content.
// Each "- " line starts a new item; subsequent deeper lines are object fields.
function parseYamlBlockSequence(
  blockLines: string[],
  filePath: string,
  _key: string
): unknown[] {
  const items: unknown[] = [];
  let currentObj: Record<string, string> | null = null;

  for (const line of blockLines) {
    const stripped = line.trimStart();
    if (!stripped) continue;

    if (stripped.startsWith("- ") || stripped === "-") {
      if (currentObj !== null) items.push(currentObj);

      const content = stripped === "-" ? "" : stripped.slice(2).trim();
      if (!content) {
        currentObj = {};
        continue;
      }

      const colonIdx = content.indexOf(":");
      if (colonIdx > 0) {
        // Object item: `- key: value`
        const k = content.slice(0, colonIdx).trim();
        const v = content.slice(colonIdx + 1).trim();
        currentObj = { [k]: v };
      } else {
        // Scalar item: `- some string`
        items.push(content);
        currentObj = null;
      }
    } else if (currentObj !== null) {
      // Continuation of current object: `    key: value`
      const colonIdx = stripped.indexOf(":");
      if (colonIdx > 0) {
        const k = stripped.slice(0, colonIdx).trim();
        const v = stripped.slice(colonIdx + 1).trim();
        currentObj[k] = v;
      }
    }
  }

  if (currentObj !== null) items.push(currentObj);
  return items;
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
  const lines = frontmatterBlock.split(/\r?\n/);
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      i++;
      continue;
    }

    // Root-level key must not be indented
    if (line[0] === " " || line[0] === "\t") {
      throw new Error(
        `[content] ${filePath} unexpected indented line outside block: "${line}"`
      );
    }

    const colonIdx = trimmed.indexOf(":");
    if (colonIdx < 1) {
      throw new Error(
        `[content] ${filePath} has invalid frontmatter line: "${line}"`
      );
    }

    const key = trimmed.slice(0, colonIdx).trim();
    const rawValue = trimmed.slice(colonIdx + 1).trim();

    if (rawValue) {
      // Inline value
      frontmatter[key] = parseValue(rawValue, filePath, key);
      i++;
    } else {
      // No inline value — collect indented block lines below
      i++;
      const blockLines: string[] = [];

      while (i < lines.length) {
        const next = lines[i];
        const nextTrimmed = next.trim();
        // Stop when we hit a non-empty root-level line
        if (nextTrimmed && next[0] !== " " && next[0] !== "\t") break;
        blockLines.push(next);
        i++;
      }

      const nonEmpty = blockLines.filter((l) => l.trim());
      if (nonEmpty.length === 0) {
        frontmatter[key] = "";
      } else {
        const first = nonEmpty[0].trimStart();
        if (first.startsWith("- ") || first === "-") {
          frontmatter[key] = parseYamlBlockSequence(blockLines, filePath, key);
        } else {
          throw new Error(
            `[content] ${filePath} unsupported block value type for "${key}" — only sequence blocks (- item) are supported`
          );
        }
      }
    }
  }

  return { frontmatter, body };
}

export function requireString(
  meta: Record<string, unknown>,
  key: string,
  filePath: string
): string {
  const value = meta[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`[content] ${filePath} is missing required string field "${key}"`);
  }
  return value;
}

export function optionalString(
  meta: Record<string, unknown>,
  key: string
): string | undefined {
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
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((item) => typeof item !== "string")
  ) {
    throw new Error(
      `[content] ${filePath} is missing required string[] field "${key}"`
    );
  }
  return value;
}

export function optionalStringArray(
  meta: Record<string, unknown>,
  key: string
): string[] {
  const value = meta[key];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    return [];
  }
  return value;
}

// Returns an array of plain objects, filtering out any non-object items.
// Used for frontmatter fields that are YAML block sequences of mappings.
export function optionalObjectArray(
  meta: Record<string, unknown>,
  key: string
): Record<string, unknown>[] {
  const value = meta[key];
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Record<string, unknown> =>
      item !== null && typeof item === "object" && !Array.isArray(item)
  );
}

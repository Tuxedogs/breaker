import type { ComponentType } from "react";
import { optionalString, optionalStringArray, parseMdxFile, requireString } from "./contentLoader";

export type RefStatus = "draft" | "review" | "validated";
export type RefType = "keybind" | "map" | "diagram";

export type DoctrineRef = {
  id: string;
  title: string;
  type: "reference";
  status: RefStatus;
  refType: RefType;
  summary?: string;
  lastUpdated: string;
  tags: string[];
  Content: ComponentType;
};

type MdxRef = {
  default: ComponentType;
};

const refRawByPath = import.meta.glob("/content/refs/**/*.mdx", {
  query: "?raw",
  import: "default",
}) as Record<string, () => Promise<unknown>>;

const refComponentByPath = import.meta.glob("/content/refs/**/*.mdx", {
  eager: true,
}) as Record<string, MdxRef>;

function normalizePathKey(path: string) {
  return path.replace(/\?.*$/, "");
}

async function resolveRawValue(value: unknown): Promise<unknown> {
  let current = value;
  let depth = 0;

  while (depth < 6) {
    if (typeof current === "function") {
      current = await (current as () => Promise<unknown> | unknown)();
      depth += 1;
      continue;
    }

    if (current && typeof current === "object" && "default" in current) {
      current = (current as { default: unknown }).default;
      depth += 1;
      continue;
    }

    return current;
  }

  return current;
}

function toRefStatus(value: string, filePath: string): RefStatus {
  if (value === "draft" || value === "review" || value === "validated") {
    return value;
  }
  throw new Error(`[content] ${filePath} has invalid "status": "${value}"`);
}

function toRefType(value: string, filePath: string): RefType {
  if (value === "keybind" || value === "map" || value === "diagram") {
    return value;
  }
  throw new Error(`[content] ${filePath} has invalid "refType": "${value}"`);
}

async function loadRefsUnsafe(): Promise<DoctrineRef[]> {
  const rawByNormalizedPath = new Map(
    Object.entries(refRawByPath).map(([path, value]) => [normalizePathKey(path), value] as const)
  );
  const paths = Object.keys(refComponentByPath).sort();
  const refs = await Promise.all(paths.map(async (path) => {
    const rawLoader = rawByNormalizedPath.get(normalizePathKey(path));
    if (!rawLoader) {
      throw new Error(`[content] ${path} is missing raw MDX source import`);
    }
    const raw = await resolveRawValue(await rawLoader());
    const componentModule = refComponentByPath[path];
    if (!componentModule?.default) {
      throw new Error(`[content] ${path} failed to load MDX component export`);
    }

    const { frontmatter } = parseMdxFile(raw, path);
    const type = requireString(frontmatter, "type", path);
    if (type !== "reference") {
      throw new Error(`[content] ${path} must have type: "reference"`);
    }

    return {
      id: requireString(frontmatter, "id", path),
      title: requireString(frontmatter, "title", path),
      type: "reference" as const,
      status: toRefStatus(requireString(frontmatter, "status", path), path),
      refType: toRefType(requireString(frontmatter, "refType", path), path),
      summary: optionalString(frontmatter, "summary"),
      lastUpdated: requireString(frontmatter, "lastUpdated", path),
      tags: optionalStringArray(frontmatter, "tags"),
      Content: componentModule.default,
    };
  }));

  const seen = new Set<string>();
  for (const ref of refs) {
    const key = `${ref.refType}/${ref.id}`;
    if (seen.has(key)) {
      throw new Error(`[content] duplicate reference key "${key}"`);
    }
    seen.add(key);
  }

  return refs;
}

export let refLoadError: Error | null = null;
export const refs: DoctrineRef[] = await (async () => {
  try {
    return await loadRefsUnsafe();
  } catch (error) {
    const loadError = error instanceof Error ? error : new Error(String(error));
    refLoadError = loadError;
    if (import.meta.env.PROD) {
      throw loadError;
    }
    console.error(loadError);
    return [];
  }
})();
export const refByKey = new Map(refs.map((ref) => [`${ref.refType}/${ref.id}`, ref]));

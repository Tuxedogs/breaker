import type { ComponentType } from "react";
import {
  optionalStringArray,
  parseMdxFile,
  requireString,
  requireStringArray,
} from "./contentLoader";

export type ModuleStatus = "draft" | "review" | "validated";
export type ModuleType = "flying" | "manning" | "facing" | "recovery";

export type DoctrineModule = {
  id: string;
  title: string;
  type: "module";
  status: ModuleStatus;
  moduleType: ModuleType;
  owner: string;
  intent: string;
  summary?: string;
  lastValidated: string;
  tags: string[];
  ships: string[];
  roles: string[];
  enemies: string[];
  maps: string[];
  powerProjection: string[];
  useWhen: string[];
  steps: string[];
  failureModes: string[];
  validation: string[];
  prerequisites: string[];
  relatedModuleIds: string[];
  Content: ComponentType;
};

type MdxModule = {
  default: ComponentType;
};

const moduleRawByPath = import.meta.glob("/content/modules/**/*.mdx", {
  query: "?raw",
  import: "default",
}) as Record<string, () => Promise<unknown>>;

const moduleComponentByPath = import.meta.glob("/content/modules/**/*.mdx", {
  eager: true,
}) as Record<string, MdxModule>;

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

function toModuleStatus(value: string, filePath: string): ModuleStatus {
  if (value === "draft" || value === "review" || value === "validated") {
    return value;
  }
  throw new Error(`[content] ${filePath} has invalid "status": "${value}"`);
}

function toModuleType(value: string, filePath: string): ModuleType {
  if (value === "flying" || value === "manning" || value === "facing" || value === "recovery") {
    return value;
  }
  throw new Error(`[content] ${filePath} has invalid "moduleType": "${value}"`);
}

async function loadModulesUnsafe(): Promise<DoctrineModule[]> {
  const rawByNormalizedPath = new Map(
    Object.entries(moduleRawByPath).map(([path, value]) => [normalizePathKey(path), value] as const)
  );
  const paths = Object.keys(moduleComponentByPath).sort();
  const modules = await Promise.all(paths.map(async (path) => {
    const rawLoader = rawByNormalizedPath.get(normalizePathKey(path));
    if (!rawLoader) {
      throw new Error(`[content] ${path} is missing raw MDX source import`);
    }

    const raw = await resolveRawValue(await rawLoader());
    const componentModule = moduleComponentByPath[path];
    if (!componentModule?.default) {
      throw new Error(`[content] ${path} failed to load MDX component export`);
    }

    const { frontmatter } = parseMdxFile(raw, path);

    const type = requireString(frontmatter, "type", path);
    if (type !== "module") {
      throw new Error(`[content] ${path} must have type: "module"`);
    }

    return {
      id: requireString(frontmatter, "id", path),
      title: requireString(frontmatter, "title", path),
      type: "module" as const,
      status: toModuleStatus(requireString(frontmatter, "status", path), path),
      moduleType: toModuleType(requireString(frontmatter, "moduleType", path), path),
      owner: requireString(frontmatter, "owner", path),
      intent: requireString(frontmatter, "intent", path),
      summary: typeof frontmatter.summary === "string" ? frontmatter.summary : undefined,
      lastValidated: requireString(frontmatter, "lastValidated", path),
      tags: requireStringArray(frontmatter, "tags", path),
      ships: optionalStringArray(frontmatter, "ships"),
      roles: optionalStringArray(frontmatter, "roles"),
      enemies: optionalStringArray(frontmatter, "enemies"),
      maps: optionalStringArray(frontmatter, "maps"),
      powerProjection: optionalStringArray(frontmatter, "powerProjection"),
      useWhen: requireStringArray(frontmatter, "useWhen", path),
      steps: requireStringArray(frontmatter, "steps", path),
      failureModes: requireStringArray(frontmatter, "failureModes", path),
      validation: requireStringArray(frontmatter, "validation", path),
      prerequisites: optionalStringArray(frontmatter, "prerequisites"),
      relatedModuleIds: optionalStringArray(frontmatter, "relatedModuleIds"),
      Content: componentModule.default,
    };
  }));

  const seen = new Set<string>();
  for (const module of modules) {
    if (seen.has(module.id)) {
      throw new Error(`[content] duplicate module id "${module.id}"`);
    }
    seen.add(module.id);
  }

  for (const module of modules) {
    for (const relatedId of module.relatedModuleIds) {
      if (!seen.has(relatedId)) {
        throw new Error(
          `[content] module "${module.id}" references unknown related module "${relatedId}"`
        );
      }
    }
  }

  return modules;
}

export let moduleLoadError: Error | null = null;
export const modules: DoctrineModule[] = await (async () => {
  try {
    return await loadModulesUnsafe();
  } catch (error) {
    const loadError = error instanceof Error ? error : new Error(String(error));
    moduleLoadError = loadError;
    if (import.meta.env.PROD) {
      throw loadError;
    }
    console.error(loadError);
    return [];
  }
})();
export const moduleById = new Map(modules.map((module) => [module.id, module]));

export const moduleFilterOptions = {
  ships: [...new Set(modules.flatMap((module) => module.ships))].sort(),
  roles: [...new Set(modules.flatMap((module) => module.roles))].sort(),
  enemies: [...new Set(modules.flatMap((module) => module.enemies))].sort(),
  maps: [...new Set(modules.flatMap((module) => module.maps))].sort(),
  statuses: [...new Set(modules.map((module) => module.status))].sort(),
  types: [...new Set(modules.map((module) => module.moduleType))].sort(),
};

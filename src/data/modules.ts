import type { ComponentType } from "react";
import {
  optionalObjectArray,
  optionalString,
  optionalStringArray,
  parseMdxFile,
  requireString,
} from "./contentLoader";

// ── Status ────────────────────────────────────────────────────────────────────

export type ModuleStatus = "draft" | "review" | "validated" | "deprecated";

// ── Layout types ──────────────────────────────────────────────────────────────

export type LegacyModuleType = "flying" | "manning" | "facing" | "recovery";
export type NewModuleType =
  | "procedure"
  | "framework"
  | "reference"
  | "concept"
  | "diagram"
  | "checklist";
export type ModuleType = NewModuleType | LegacyModuleType;

// ── Layout-specific sub-types ─────────────────────────────────────────────────

export type ProcedureStep = { label: string; detail: string };
export type ValidationItem = { label: string; detail: string };
export type CriteriaItem = {
  label: string;
  weight?: "high" | "med" | "low";
  description: string;
};
export type MatrixRow = { condition: string; action: string };
export type OutputItem = { label: string; description: string };
export type TableRow = { label: string; value: string; note?: string };
export type DoctrineTable = { heading: string; rows: TableRow[] };
export type LegendItem = { color: string; label: string };
export type DiagramImage = { src: string; caption?: string };
export type Phase = { label: string; items: string[] };

// ── Module shape ──────────────────────────────────────────────────────────────

export type DoctrineModule = {
  // Universal required
  id: string;
  moduleType: ModuleType;
  title: string;
  summary: string;
  status: ModuleStatus;
  owner: string;
  Content: ComponentType;

  // Universal optional — always arrays (empty if absent)
  tags: string[];
  ships: string[];
  roles: string[];
  enemies: string[];
  relatedModuleIds: string[];
  prerequisites: string[];
  excludeShips: string[];
  excludeRoles: string[];

  // Universal optional scalars
  validatedDate?: string;
  context?: string;
  accent?: string;

  // Legacy compatibility fields (used by LegacyLayout, kept for migration)
  intent?: string;
  lastValidated?: string;
  videoSrc?: string;
  videoLabel?: string;
  powerProjection?: string[];
  maps?: string[];

  // procedure
  steps?: ProcedureStep[];
  useWhen?: string[];
  validation?: ValidationItem[];
  failureModes?: string[];

  // framework
  question?: string;
  criteria?: CriteriaItem[];
  matrix?: MatrixRow[];
  output?: OutputItem[];

  // reference
  tables?: DoctrineTable[];
  notes?: string[];

  // diagram
  assetPath?: string;
  caption?: string;
  legend?: LegendItem[];
  images?: DiagramImage[];

  // checklist
  phases?: Phase[];
  resetable?: boolean;
};

// ── Type helpers ──────────────────────────────────────────────────────────────

const LEGACY_TYPES = new Set<string>(["flying", "manning", "facing", "recovery"]);
const ALL_TYPES = new Set<string>([
  "procedure",
  "framework",
  "reference",
  "concept",
  "diagram",
  "checklist",
  "flying",
  "manning",
  "facing",
  "recovery",
]);

const MODULE_TYPE_ACCENTS: Record<ModuleType, string> = {
  procedure: "rgb(96 165 250)",
  framework: "rgb(251 191 36)",
  reference: "rgb(45 212 191)",
  concept: "rgb(167 139 250)",
  diagram: "rgb(148 163 184)",
  checklist: "rgb(74 222 128)",
  flying: "rgb(71 85 105)",
  manning: "rgb(71 85 105)",
  facing: "rgb(71 85 105)",
  recovery: "rgb(71 85 105)",
};

function toModuleStatus(value: string, filePath: string): ModuleStatus {
  if (
    value === "draft" ||
    value === "review" ||
    value === "validated" ||
    value === "deprecated"
  ) {
    return value;
  }
  throw new Error(`[content] ${filePath} has invalid "status": "${value}"`);
}

function toModuleType(value: string, filePath: string): ModuleType {
  if (ALL_TYPES.has(value)) return value as ModuleType;
  throw new Error(`[content] ${filePath} has invalid "moduleType": "${value}"`);
}

function resolveModuleAccent(
  moduleType: ModuleType,
  frontmatter: Record<string, unknown>
) {
  return optionalString(frontmatter, "accent") ?? MODULE_TYPE_ACCENTS[moduleType];
}

// ── Object array mappers ──────────────────────────────────────────────────────

function toProcedureSteps(
  arr: Record<string, unknown>[]
): ProcedureStep[] {
  return arr.map((item) => ({
    label: typeof item.label === "string" ? item.label : "",
    detail: typeof item.detail === "string" ? item.detail : "",
  }));
}

function toValidationItems(
  arr: Record<string, unknown>[]
): ValidationItem[] {
  return arr.map((item) => ({
    label: typeof item.label === "string" ? item.label : "",
    detail: typeof item.detail === "string" ? item.detail : "",
  }));
}

function isWeight(v: unknown): v is "high" | "med" | "low" {
  return v === "high" || v === "med" || v === "low";
}

function toCriteriaItems(
  arr: Record<string, unknown>[]
): CriteriaItem[] {
  return arr.map((item) => ({
    label: typeof item.label === "string" ? item.label : "",
    weight: isWeight(item.weight) ? item.weight : undefined,
    description: typeof item.description === "string" ? item.description : "",
  }));
}

function toMatrixRows(arr: Record<string, unknown>[]): MatrixRow[] {
  return arr.map((item) => ({
    condition: typeof item.condition === "string" ? item.condition : "",
    action: typeof item.action === "string" ? item.action : "",
  }));
}

function toOutputItems(arr: Record<string, unknown>[]): OutputItem[] {
  return arr.map((item) => ({
    label: typeof item.label === "string" ? item.label : "",
    description: typeof item.description === "string" ? item.description : "",
  }));
}

function toLegendItems(arr: Record<string, unknown>[]): LegendItem[] {
  return arr.map((item) => {
    let color = typeof item.color === "string" ? item.color : "";
    if (
      (color.startsWith('"') && color.endsWith('"')) ||
      (color.startsWith("'") && color.endsWith("'"))
    ) {
      color = color.slice(1, -1);
    }
    return { color, label: typeof item.label === "string" ? item.label : "" };
  });
}

function parseBracketList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((s): s is string => typeof s === "string");
  if (typeof raw !== "string") return [];
  const t = raw.trim();
  if (!t.startsWith("[") || !t.endsWith("]")) return [];
  try {
    const parsed = JSON.parse(t);
    if (Array.isArray(parsed)) return parsed.filter((s): s is string => typeof s === "string");
  } catch {
    // fall through to comma split
  }
  return t.slice(1, -1).split(",").map((s) => s.trim()).filter(Boolean);
}

function toDiagramImages(arr: Record<string, unknown>[]): DiagramImage[] {
  return arr
    .map((item) => ({
      src: typeof item.src === "string" ? item.src : "",
      caption: typeof item.caption === "string" ? item.caption : undefined,
    }))
    .filter((item) => item.src);
}

function toPhases(arr: Record<string, unknown>[]): Phase[] {
  return arr.map((item) => ({
    label: typeof item.label === "string" ? item.label : "",
    items: parseBracketList(item.items),
  }));
}

// ── Loader ────────────────────────────────────────────────────────────────────

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

async function loadModulesUnsafe(): Promise<DoctrineModule[]> {
  const rawByNormalizedPath = new Map(
    Object.entries(moduleRawByPath).map(
      ([path, value]) => [normalizePathKey(path), value] as const
    )
  );
  const paths = Object.keys(moduleComponentByPath).sort();

  const modules = await Promise.all(
    paths.map(async (path) => {
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

      // type field is optional in new format
      const typeField = frontmatter.type;
      if (typeField !== undefined && typeField !== "module") {
        throw new Error(`[content] ${path} must have type: "module" or omit type field`);
      }

      const moduleType = toModuleType(
        requireString(frontmatter, "moduleType", path),
        path
      );
      const isLegacy = LEGACY_TYPES.has(moduleType);

      // summary: required for new types; falls back to intent for legacy
      const summaryRaw =
        optionalString(frontmatter, "summary") ??
        optionalString(frontmatter, "intent") ??
        "";
      if (!isLegacy && !summaryRaw) {
        throw new Error(
          `[content] ${path} is missing required string field "summary"`
        );
      }

      const base = {
        id: requireString(frontmatter, "id", path),
        moduleType,
        title: requireString(frontmatter, "title", path),
        summary: summaryRaw,
        status: toModuleStatus(requireString(frontmatter, "status", path), path),
        owner: requireString(frontmatter, "owner", path),
        Content: componentModule.default,
        tags: optionalStringArray(frontmatter, "tags"),
        ships: optionalStringArray(frontmatter, "ships"),
        roles: optionalStringArray(frontmatter, "roles"),
        enemies: optionalStringArray(frontmatter, "enemies"),
        relatedModuleIds: optionalStringArray(frontmatter, "relatedModuleIds"),
        prerequisites: optionalStringArray(frontmatter, "prerequisites"),
        excludeShips: optionalStringArray(frontmatter, "excludeShips"),
        excludeRoles: optionalStringArray(frontmatter, "excludeRoles"),
        validatedDate: optionalString(frontmatter, "validatedDate"),
        context: optionalString(frontmatter, "context"),
        accent: resolveModuleAccent(moduleType, frontmatter),
      };

      if (isLegacy) {
        return {
          ...base,
          intent: optionalString(frontmatter, "intent"),
          lastValidated: optionalString(frontmatter, "lastValidated"),
          videoSrc: optionalString(frontmatter, "videoSrc"),
          videoLabel: optionalString(frontmatter, "videoLabel"),
          powerProjection: optionalStringArray(frontmatter, "powerProjection"),
          maps: optionalStringArray(frontmatter, "maps"),
        };
      }

      if (moduleType === "procedure") {
        return {
          ...base,
          steps: toProcedureSteps(optionalObjectArray(frontmatter, "steps")),
          useWhen: optionalStringArray(frontmatter, "useWhen"),
          validation: toValidationItems(
            optionalObjectArray(frontmatter, "validation")
          ),
          failureModes: optionalStringArray(frontmatter, "failureModes"),
        };
      }

      if (moduleType === "framework") {
        return {
          ...base,
          question: optionalString(frontmatter, "question"),
          criteria: toCriteriaItems(
            optionalObjectArray(frontmatter, "criteria")
          ),
          matrix: toMatrixRows(optionalObjectArray(frontmatter, "matrix")),
          output: toOutputItems(optionalObjectArray(frontmatter, "output")),
          failureModes: optionalStringArray(frontmatter, "failureModes"),
        };
      }

      if (moduleType === "reference") {
        return {
          ...base,
          notes: optionalStringArray(frontmatter, "notes"),
        };
      }

      if (moduleType === "checklist") {
        return {
          ...base,
          phases: toPhases(optionalObjectArray(frontmatter, "phases")),
          resetable: frontmatter.resetable === true || frontmatter.resetable === "true",
        };
      }

      if (moduleType === "diagram") {
        return {
          ...base,
          assetPath: optionalString(frontmatter, "assetPath"),
          caption: optionalString(frontmatter, "caption"),
          legend: toLegendItems(optionalObjectArray(frontmatter, "legend")),
          images: toDiagramImages(optionalObjectArray(frontmatter, "images")),
        };
      }

      // concept — base only
      return base;
    })
  );

  const seen = new Set<string>();
  for (const module of modules) {
    if (seen.has(module.id)) {
      throw new Error(`[content] duplicate module id "${module.id}"`);
    }
    seen.add(module.id);

    for (const ship of module.excludeShips) {
      if (module.ships.includes(ship)) {
        throw new Error(
          `[content] module "${module.id}" cannot include and exclude ship "${ship}"`
        );
      }
    }

    for (const role of module.excludeRoles) {
      if (module.roles.includes(role)) {
        throw new Error(
          `[content] module "${module.id}" cannot include and exclude role "${role}"`
        );
      }
    }
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
    const loadError =
      error instanceof Error ? error : new Error(String(error));
    moduleLoadError = loadError;
    if (import.meta.env.PROD) {
      throw loadError;
    }
    console.error(loadError);
    return [];
  }
})();
export const moduleById = new Map(
  modules.map((module) => [module.id, module])
);

export function moduleMatchesShipRole(
  module: DoctrineModule,
  context: { ship?: string; role?: string }
): boolean {
  const ship = context.ship?.trim();
  const role = context.role?.trim();

  if (ship) {
    if (module.ships.length > 0 && !module.ships.includes(ship)) return false;
    if (module.excludeShips.includes(ship)) return false;
  }

  if (role) {
    if (module.roles.length > 0 && !module.roles.includes(role)) return false;
    if (module.excludeRoles.includes(role)) return false;
  }

  return true;
}

export const moduleFilterOptions = {
  ships: [...new Set(modules.flatMap((module) => module.ships))].sort(),
  roles: [
    ...new Set([...modules.flatMap((module) => module.roles), "crew"]),
  ].sort(),
  enemies: [...new Set(modules.flatMap((module) => module.enemies))].sort(),
  domains: [...new Set(modules.flatMap((module) => module.tags))].sort(),
  statuses: [...new Set(modules.map((module) => module.status))].sort(),
};

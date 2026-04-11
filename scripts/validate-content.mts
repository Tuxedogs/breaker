import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  optionalObjectArray,
  optionalString,
  optionalStringArray,
  parseMdxFile,
  requireString,
} from "../src/data/contentLoader.ts";

const ROOT = process.cwd();
const CONTENT_ROOT = path.join(ROOT, "content");
const MODULES_DIR = path.join(CONTENT_ROOT, "modules");
const REFS_DIR = path.join(CONTENT_ROOT, "refs");

const MODULE_STATUSES = new Set(["draft", "review", "validated", "deprecated"]);
const MODULE_TYPES = new Set([
  "concept",
  "procedure",
  "reference",
  "diagram",
  "framework",
  "checklist",
  "flying",
  "manning",
  "facing",
  "recovery",
]);
const LEGACY_TYPES = new Set(["flying", "manning", "facing", "recovery"]);
const REF_STATUSES = new Set(["draft", "review", "validated"]);
const REF_TYPES = new Set(["keybind", "map", "diagram"]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

async function getMdxFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const resolved = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return getMdxFiles(resolved);
      }
      return entry.name.endsWith(".mdx") ? [resolved] : [];
    })
  );
  return files.flat();
}

function ensureEnum(value: string, allowed: Set<string>, key: string, filePath: string) {
  if (!allowed.has(value)) {
    throw new Error(`[content] ${filePath} has invalid "${key}": "${value}"`);
  }
}

function ensureDate(value: string | undefined, key: string, filePath: string) {
  if (!value) return;
  if (!ISO_DATE.test(value)) {
    throw new Error(`[content] ${filePath} has invalid "${key}" date "${value}" (expected YYYY-MM-DD)`);
  }
}

function ensureFilenameMatchesId(filePath: string, id: string) {
  const base = path.basename(filePath, ".mdx");
  if (base !== id) {
    throw new Error(`[content] ${filePath} id "${id}" must match filename "${base}"`);
  }
}

function ensureStringArray(value: unknown, key: string, filePath: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`[content] ${filePath} has invalid string[] "${key}"`);
  }
  return value;
}

function ensureOptionalStringArray(meta: Record<string, unknown>, key: string, filePath: string) {
  return ensureStringArray(optionalStringArray(meta, key), key, filePath);
}

function ensureObjectArray(meta: Record<string, unknown>, key: string, filePath: string) {
  const arr = optionalObjectArray(meta, key);
  const raw = meta[key];
  if (raw !== undefined && !Array.isArray(raw)) {
    throw new Error(`[content] ${filePath} has invalid object[] "${key}"`);
  }
  return arr;
}

function ensureBooleanLike(value: unknown, key: string, filePath: string) {
  if (value === undefined) return;
  if (value !== true && value !== false && value !== "true" && value !== "false") {
    throw new Error(`[content] ${filePath} has invalid boolean "${key}"`);
  }
}

function validateBaseModule(frontmatter: Record<string, unknown>, filePath: string) {
  const id = requireString(frontmatter, "id", filePath);
  ensureFilenameMatchesId(filePath, id);

  const typeField = optionalString(frontmatter, "type");
  if (typeField !== undefined && typeField !== "module") {
    throw new Error(`[content] ${filePath} must have type: "module" or omit the type field`);
  }

  const status = requireString(frontmatter, "status", filePath);
  ensureEnum(status, MODULE_STATUSES, "status", filePath);

  const moduleType = requireString(frontmatter, "moduleType", filePath);
  ensureEnum(moduleType, MODULE_TYPES, "moduleType", filePath);

  requireString(frontmatter, "title", filePath);
  requireString(frontmatter, "owner", filePath);

  const summary = optionalString(frontmatter, "summary");
  const intent = optionalString(frontmatter, "intent");
  if (!summary && !intent) {
    throw new Error(`[content] ${filePath} must define "summary" or legacy "intent"`);
  }

  ensureDate(optionalString(frontmatter, "validatedDate"), "validatedDate", filePath);
  ensureDate(optionalString(frontmatter, "lastValidated"), "lastValidated", filePath);

  const ships = ensureOptionalStringArray(frontmatter, "ships", filePath);
  const roles = ensureOptionalStringArray(frontmatter, "roles", filePath);
  const excludeShips = ensureOptionalStringArray(frontmatter, "excludeShips", filePath);
  const excludeRoles = ensureOptionalStringArray(frontmatter, "excludeRoles", filePath);

  ensureOptionalStringArray(frontmatter, "tags", filePath);
  ensureOptionalStringArray(frontmatter, "enemies", filePath);
  ensureOptionalStringArray(frontmatter, "relatedModuleIds", filePath);
  ensureOptionalStringArray(frontmatter, "prerequisites", filePath);

  for (const ship of excludeShips) {
    if (ships.includes(ship)) {
      throw new Error(`[content] ${filePath} cannot include and exclude ship "${ship}"`);
    }
  }

  for (const role of excludeRoles) {
    if (roles.includes(role)) {
      throw new Error(`[content] ${filePath} cannot include and exclude role "${role}"`);
    }
  }

  return { id, moduleType };
}

function validateLegacyFields(frontmatter: Record<string, unknown>, filePath: string) {
  ensureOptionalStringArray(frontmatter, "powerProjection", filePath);
  ensureOptionalStringArray(frontmatter, "maps", filePath);
  optionalString(frontmatter, "videoSrc");
  optionalString(frontmatter, "videoLabel");
}

function validateProcedureFields(frontmatter: Record<string, unknown>, filePath: string) {
  const steps = ensureObjectArray(frontmatter, "steps", filePath);
  steps.forEach((step, index) => {
    if (typeof step.label !== "string" || typeof step.detail !== "string") {
      throw new Error(`[content] ${filePath} has invalid procedure step at index ${index}`);
    }
  });
  ensureOptionalStringArray(frontmatter, "useWhen", filePath);
  ensureOptionalStringArray(frontmatter, "failureModes", filePath);
  const validation = ensureObjectArray(frontmatter, "validation", filePath);
  validation.forEach((item, index) => {
    if (typeof item.label !== "string" || typeof item.detail !== "string") {
      throw new Error(`[content] ${filePath} has invalid validation item at index ${index}`);
    }
  });
}

function validateFrameworkFields(frontmatter: Record<string, unknown>, filePath: string) {
  optionalString(frontmatter, "question");
  const criteria = ensureObjectArray(frontmatter, "criteria", filePath);
  criteria.forEach((item, index) => {
    if (typeof item.label !== "string" || typeof item.description !== "string") {
      throw new Error(`[content] ${filePath} has invalid criteria item at index ${index}`);
    }
    if (item.weight !== undefined && !["high", "med", "low"].includes(String(item.weight))) {
      throw new Error(`[content] ${filePath} has invalid criteria weight at index ${index}`);
    }
  });

  const matrix = ensureObjectArray(frontmatter, "matrix", filePath);
  matrix.forEach((item, index) => {
    if (typeof item.condition !== "string" || typeof item.action !== "string") {
      throw new Error(`[content] ${filePath} has invalid matrix row at index ${index}`);
    }
  });

  const output = ensureObjectArray(frontmatter, "output", filePath);
  output.forEach((item, index) => {
    if (typeof item.label !== "string" || typeof item.description !== "string") {
      throw new Error(`[content] ${filePath} has invalid output item at index ${index}`);
    }
  });

  ensureOptionalStringArray(frontmatter, "failureModes", filePath);
}

function validateReferenceFields(frontmatter: Record<string, unknown>, filePath: string) {
  ensureOptionalStringArray(frontmatter, "notes", filePath);
}

function validateDiagramFields(frontmatter: Record<string, unknown>, filePath: string) {
  optionalString(frontmatter, "assetPath");
  optionalString(frontmatter, "caption");

  const legend = ensureObjectArray(frontmatter, "legend", filePath);
  legend.forEach((item, index) => {
    if (typeof item.color !== "string" || typeof item.label !== "string") {
      throw new Error(`[content] ${filePath} has invalid legend item at index ${index}`);
    }
  });

  const images = ensureObjectArray(frontmatter, "images", filePath);
  images.forEach((item, index) => {
    if (typeof item.src !== "string") {
      throw new Error(`[content] ${filePath} has invalid image item at index ${index}`);
    }
    if (item.caption !== undefined && typeof item.caption !== "string") {
      throw new Error(`[content] ${filePath} has invalid image caption at index ${index}`);
    }
  });
}

function validateChecklistFields(frontmatter: Record<string, unknown>, filePath: string) {
  const phases = ensureObjectArray(frontmatter, "phases", filePath);
  phases.forEach((item, index) => {
    if (typeof item.label !== "string") {
      throw new Error(`[content] ${filePath} has invalid phase at index ${index}`);
    }

    const phaseItems = item.items;
    if (typeof phaseItems === "string") {
      // Matches the app loader, which accepts bracket-list strings in block objects.
      return;
    }

    if (!Array.isArray(phaseItems)) {
      throw new Error(`[content] ${filePath} has invalid phase at index ${index}`);
    }

    if (phaseItems.some((phaseItem) => typeof phaseItem !== "string")) {
      throw new Error(`[content] ${filePath} has invalid phase items at index ${index}`);
    }
  });
  ensureBooleanLike(frontmatter.resetable, "resetable", filePath);
}

async function loadModuleRecords() {
  const files = await getMdxFiles(MODULES_DIR);
  return Promise.all(
    files.map(async (filePath) => {
      const raw = await readFile(filePath, "utf8");
      const { frontmatter } = parseMdxFile(raw, filePath);
      const { id, moduleType } = validateBaseModule(frontmatter, filePath);

      if (LEGACY_TYPES.has(moduleType)) {
        validateLegacyFields(frontmatter, filePath);
      } else if (moduleType === "procedure") {
        validateProcedureFields(frontmatter, filePath);
      } else if (moduleType === "framework") {
        validateFrameworkFields(frontmatter, filePath);
      } else if (moduleType === "reference") {
        validateReferenceFields(frontmatter, filePath);
      } else if (moduleType === "diagram") {
        validateDiagramFields(frontmatter, filePath);
      } else if (moduleType === "checklist") {
        validateChecklistFields(frontmatter, filePath);
      }

      return {
        filePath,
        id,
        relatedModuleIds: ensureOptionalStringArray(frontmatter, "relatedModuleIds", filePath),
        prerequisites: ensureOptionalStringArray(frontmatter, "prerequisites", filePath),
        maps: ensureOptionalStringArray(frontmatter, "maps", filePath),
      };
    })
  );
}

async function loadRefRecords() {
  const files = await getMdxFiles(REFS_DIR);
  return Promise.all(
    files.map(async (filePath) => {
      const raw = await readFile(filePath, "utf8");
      const { frontmatter } = parseMdxFile(raw, filePath);
      const id = requireString(frontmatter, "id", filePath);
      const type = requireString(frontmatter, "type", filePath);
      const status = requireString(frontmatter, "status", filePath);
      const refType = requireString(frontmatter, "refType", filePath);
      const lastUpdated = requireString(frontmatter, "lastUpdated", filePath);

      ensureFilenameMatchesId(filePath, id);

      if (type !== "reference") {
        throw new Error(`[content] ${filePath} must have type "reference"`);
      }

      ensureEnum(status, REF_STATUSES, "status", filePath);
      ensureEnum(refType, REF_TYPES, "refType", filePath);
      ensureDate(lastUpdated, "lastUpdated", filePath);

      return { filePath, id, refType };
    })
  );
}

function ensureUnique<T>(records: T[], toKey: (record: T) => string, label: string) {
  const seen = new Map<string, T>();
  for (const record of records) {
    const key = toKey(record);
    if (seen.has(key)) {
      const other = seen.get(key) as { filePath?: string };
      const current = record as { filePath?: string };
      throw new Error(`[content] duplicate ${label} "${key}" in ${current.filePath} and ${other.filePath}`);
    }
    seen.set(key, record);
  }
}

function validateCrossReferences(
  modules: Array<{
    filePath: string;
    id: string;
    relatedModuleIds: string[];
    prerequisites: string[];
    maps: string[];
  }>,
  refs: Array<{ id: string; refType: string }>
) {
  const moduleIds = new Set(modules.map((module) => module.id));
  const refKeys = new Set(refs.map((ref) => `${ref.refType}/${ref.id}`));
  const mapRefIds = new Set(
    refs.filter((ref) => ref.refType === "map").map((ref) => ref.id)
  );

  for (const module of modules) {
    for (const relatedId of module.relatedModuleIds) {
      if (!moduleIds.has(relatedId)) {
        throw new Error(`[content] ${module.filePath} references unknown related module "${relatedId}"`);
      }
    }

    for (const prerequisite of module.prerequisites) {
      if (prerequisite.includes("/") && !refKeys.has(prerequisite)) {
        throw new Error(`[content] ${module.filePath} references unknown prerequisite "${prerequisite}"`);
      }
    }

    for (const mapId of module.maps) {
      if (!mapRefIds.has(mapId)) {
        throw new Error(`[content] ${module.filePath} references unknown map "${mapId}"`);
      }
    }
  }
}

async function main() {
  try {
    const [modules, refs] = await Promise.all([loadModuleRecords(), loadRefRecords()]);
    ensureUnique(modules, (module) => module.id, "module id");
    ensureUnique(refs, (ref) => `${ref.refType}/${ref.id}`, "reference key");
    validateCrossReferences(modules, refs);
    console.log(`[content] OK: validated ${modules.length} modules and ${refs.length} references`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

await main();

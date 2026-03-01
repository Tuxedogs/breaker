import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const CONTENT_ROOT = path.join(ROOT, "content");
const MODULES_DIR = path.join(CONTENT_ROOT, "modules");
const REFS_DIR = path.join(CONTENT_ROOT, "refs");

const MODULE_STATUSES = new Set(["draft", "review", "validated"]);
const MODULE_TYPES = new Set(["flying", "manning", "facing", "recovery"]);
const REF_STATUSES = new Set(["draft", "review", "validated"]);
const REF_TYPES = new Set(["keybind", "map", "diagram"]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

async function getMdxFiles(dir) {
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

function parseValue(rawValue, filePath, key) {
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
      throw new Error(`[content] ${filePath} has invalid JSON-like value for "${key}": ${String(error)}`);
    }
  }

  return trimmed;
}

function parseMdxFile(raw, filePath) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    throw new Error(`[content] ${filePath} is missing frontmatter.`);
  }

  const [, frontmatterBlock, body = ""] = match;
  const frontmatter = {};

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

function requireString(meta, key, filePath) {
  const value = meta[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`[content] ${filePath} is missing required string "${key}"`);
  }
  return value;
}

function requireStringArray(meta, key, filePath) {
  const value = meta[key];
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`[content] ${filePath} must define non-empty string[] "${key}"`);
  }
  return value;
}

function optionalStringArray(meta, key, filePath) {
  const value = meta[key];
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`[content] ${filePath} has invalid string[] "${key}"`);
  }
  return value;
}

function ensureEnum(value, allowed, key, filePath) {
  if (!allowed.has(value)) {
    throw new Error(`[content] ${filePath} has invalid "${key}": "${value}"`);
  }
}

function ensureDate(value, key, filePath) {
  if (!ISO_DATE.test(value)) {
    throw new Error(`[content] ${filePath} has invalid "${key}" date "${value}" (expected YYYY-MM-DD)`);
  }
}

function ensureFilenameMatchesId(filePath, id) {
  const base = path.basename(filePath, ".mdx");
  if (base !== id) {
    throw new Error(`[content] ${filePath} id "${id}" must match filename "${base}"`);
  }
}

async function loadModuleRecords() {
  const files = await getMdxFiles(MODULES_DIR);
  return Promise.all(
    files.map(async (filePath) => {
      const raw = await readFile(filePath, "utf8");
      const { frontmatter } = parseMdxFile(raw, filePath);
      const record = {
        filePath,
        id: requireString(frontmatter, "id", filePath),
        title: requireString(frontmatter, "title", filePath),
        type: requireString(frontmatter, "type", filePath),
        status: requireString(frontmatter, "status", filePath),
        moduleType: requireString(frontmatter, "moduleType", filePath),
        owner: requireString(frontmatter, "owner", filePath),
        intent: requireString(frontmatter, "intent", filePath),
        lastValidated: requireString(frontmatter, "lastValidated", filePath),
        tags: requireStringArray(frontmatter, "tags", filePath),
        useWhen: requireStringArray(frontmatter, "useWhen", filePath),
        steps: requireStringArray(frontmatter, "steps", filePath),
        failureModes: requireStringArray(frontmatter, "failureModes", filePath),
        validation: requireStringArray(frontmatter, "validation", filePath),
        ships: optionalStringArray(frontmatter, "ships", filePath),
        roles: optionalStringArray(frontmatter, "roles", filePath),
        excludeShips: optionalStringArray(frontmatter, "excludeShips", filePath),
        excludeRoles: optionalStringArray(frontmatter, "excludeRoles", filePath),
        relatedModuleIds: optionalStringArray(frontmatter, "relatedModuleIds", filePath),
        maps: optionalStringArray(frontmatter, "maps", filePath),
      };

      if (record.type !== "module") {
        throw new Error(`[content] ${filePath} must have type "module"`);
      }
      ensureEnum(record.status, MODULE_STATUSES, "status", filePath);
      ensureEnum(record.moduleType, MODULE_TYPES, "moduleType", filePath);
      ensureDate(record.lastValidated, "lastValidated", filePath);
      ensureFilenameMatchesId(filePath, record.id);
      for (const ship of record.excludeShips) {
        if (record.ships.includes(ship)) {
          throw new Error(`[content] ${filePath} cannot include and exclude ship "${ship}"`);
        }
      }
      for (const role of record.excludeRoles) {
        if (record.roles.includes(role)) {
          throw new Error(`[content] ${filePath} cannot include and exclude role "${role}"`);
        }
      }
      return record;
    })
  );
}

async function loadRefRecords() {
  const files = await getMdxFiles(REFS_DIR);
  return Promise.all(
    files.map(async (filePath) => {
      const raw = await readFile(filePath, "utf8");
      const { frontmatter } = parseMdxFile(raw, filePath);
      const record = {
        filePath,
        id: requireString(frontmatter, "id", filePath),
        title: requireString(frontmatter, "title", filePath),
        type: requireString(frontmatter, "type", filePath),
        status: requireString(frontmatter, "status", filePath),
        refType: requireString(frontmatter, "refType", filePath),
        lastUpdated: requireString(frontmatter, "lastUpdated", filePath),
      };

      if (record.type !== "reference") {
        throw new Error(`[content] ${filePath} must have type "reference"`);
      }
      ensureEnum(record.status, REF_STATUSES, "status", filePath);
      ensureEnum(record.refType, REF_TYPES, "refType", filePath);
      ensureDate(record.lastUpdated, "lastUpdated", filePath);
      ensureFilenameMatchesId(filePath, record.id);
      return record;
    })
  );
}

function ensureUnique(records, toKey, label) {
  const seen = new Map();
  for (const record of records) {
    const key = toKey(record);
    if (seen.has(key)) {
      throw new Error(`[content] duplicate ${label} "${key}" in ${record.filePath} and ${seen.get(key)}`);
    }
    seen.set(key, record.filePath);
  }
}

function validateCrossReferences(modules, refs) {
  const moduleIds = new Set(modules.map((module) => module.id));
  const mapRefIds = new Set(refs.filter((ref) => ref.refType === "map").map((ref) => ref.id));

  for (const module of modules) {
    for (const relatedId of module.relatedModuleIds) {
      if (!moduleIds.has(relatedId)) {
        throw new Error(
          `[content] ${module.filePath} references unknown related module "${relatedId}"`
        );
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
    console.log(
      `[content] OK: validated ${modules.length} modules and ${refs.length} references`
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

await main();

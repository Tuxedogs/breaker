import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { BASE_REFINERY_YIELD, getRefinedOutput } from "../src/lib/refineryCalculations";
import type {
  RefineryDataset,
  RefineryMaterialDefinition,
  RefineryMaterialId,
  RefineryRecord,
} from "../src/types/refinery";

const SOURCE_PATH = "D:/scintel/data/refinery/UEX - Refineries Yields Bonuses and Workloads.csv";
const OUTPUT_PATH = "public/api/refinery/refinery_yields.json";
const AUDIT_PATH = "scripts/reports/refinery/refinery_yields_audit.json";

const materialMappings = [
  ["AGRI", "agricium", "Agricium"],
  ["ALUM", "aluminum", "Aluminium"],
  ["BERY", "beryl", "Beryl"],
  ["BEXA", "bexalite", "Bexalite"],
  ["BORA", "borase", "Borase"],
  ["COPP", "copper", "Copper"],
  ["CORU", "corundum", "Corundum"],
  ["GOLD", "gold", "Gold"],
  ["HEPH", "hephaestanite", "Hephaestanite"],
  ["IRON", "iron", "Iron"],
  ["LARA", "laranite", "Laranite"],
  ["LIND", "lindinium", "Lindinium"],
  ["QUAN", "quantanium", "Quantanium"],
  ["QUAR", "quartz", "Quartz"],
  ["SAVR", "savrilium", "Savrilium"],
  ["TARA", "taranite", "Taranite"],
  ["TITA", "titanium", "Titanium"],
  ["TORI", "torite", "Torite"],
  ["TUNG", "tungsten", "Tungsten"],
] as const satisfies ReadonlyArray<readonly [string, RefineryMaterialId, string]>;

const keptColumns = ["Refinery", "Unnamed: 1", ...materialMappings.map(([code]) => code)];
const ignoredColumns = ["Unnamed: 2", "Unnamed: 22"];
const expectedColumns = ["Refinery", "Unnamed: 1", "Unnamed: 2", ...materialMappings.map(([code]) => code), "Unnamed: 22"];

function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error("CSV ended inside a quoted field.");
  if (field !== "" || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}

function normalizeHeaders(headers: string[]): string[] {
  return headers.map((header, index) => {
    if (header !== "") return header;
    if (index === 1) return "Unnamed: 1";
    if (index === 2) return "Unnamed: 2";
    if (index === 22) return "Unnamed: 22";
    return `Unexpected unnamed column at index ${index}`;
  });
}

function slug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function compareArrays(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function parseBonus(value: string, rowNumber: number, code: string): number {
  if (value.trim() === "") throw new Error(`Blank ${code} bonus at CSV row ${rowNumber}.`);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${code} bonus "${value}" at CSV row ${rowNumber}.`);
  return parsed;
}

async function main(): Promise<void> {
  const sourcePath = path.resolve(SOURCE_PATH);
  const outputPath = path.resolve(OUTPUT_PATH);
  const auditPath = path.resolve(AUDIT_PATH);
  const rows = parseCsv(await readFile(sourcePath, "utf8"));
  const rawHeaders = rows.shift();
  if (!rawHeaders) throw new Error("CSV contains no header row.");

  const headers = normalizeHeaders(rawHeaders);
  const unexpectedColumns = headers.filter((header) => !expectedColumns.includes(header));
  if (!compareArrays(headers, expectedColumns) || unexpectedColumns.length > 0) {
    throw new Error(`Unexpected CSV columns: ${JSON.stringify({ expectedColumns, headers, unexpectedColumns })}`);
  }

  const columnIndexes = new Map(headers.map((header, index) => [header, index]));
  const refineries: RefineryRecord[] = [];
  const ids = new Set<string>();

  for (const [rowIndex, row] of rows.entries()) {
    const rowNumber = rowIndex + 2;
    if (row.length !== headers.length) {
      throw new Error(`CSV row ${rowNumber} has ${row.length} columns; expected ${headers.length}.`);
    }
    const read = (column: string): string => row[columnIndexes.get(column) ?? -1] ?? "";
    const name = read("Refinery").trim();
    const systemCode = read("Unnamed: 1").trim();
    if (!name || !systemCode) throw new Error(`Blank refinery name or system code at CSV row ${rowNumber}.`);

    const id = slug(`${name}-${systemCode}`);
    if (!id) throw new Error(`Unable to generate refinery ID at CSV row ${rowNumber}.`);
    if (ids.has(id)) throw new Error(`Duplicate refinery ID "${id}" at CSV row ${rowNumber}.`);
    ids.add(id);

    const materialBonuses = Object.fromEntries(
      materialMappings.map(([code, materialId]) => [materialId, parseBonus(read(code), rowNumber, code)]),
    ) as Record<RefineryMaterialId, number>;
    refineries.push({ id, name, systemCode, materialBonuses });
  }

  refineries.sort((left, right) =>
    left.name.localeCompare(right.name) ||
    left.systemCode.localeCompare(right.systemCode) ||
    left.id.localeCompare(right.id),
  );

  const materials: RefineryMaterialDefinition[] = materialMappings.map(([code, id, displayName]) => ({
    id,
    code,
    displayName,
  }));
  const generatedAt = new Date().toISOString();
  const dataset: RefineryDataset = {
    schemaVersion: 1,
    generatedAt,
    sourceName: path.basename(sourcePath),
    baseRefineryYield: BASE_REFINERY_YIELD,
    materials,
    refineries,
  };
  const audit = {
    sourceFilePath: sourcePath,
    keptColumns,
    ignoredColumns,
    refineryCount: refineries.length,
    materialMappings: materials,
    unexpectedColumns,
    outputJsonPath: outputPath,
    generatedAt,
    formulaExamples: [
      { rawInputScu: 100, bonusPercent: 0, refinedOutputScu: getRefinedOutput(100, 0) },
      { rawInputScu: 100, bonusPercent: 20, refinedOutputScu: getRefinedOutput(100, 20) },
    ],
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await mkdir(path.dirname(auditPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(dataset, null, 2)}\n`, "utf8");
  await writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");
  console.log(`Imported ${refineries.length} refineries to ${OUTPUT_PATH}.`);
}

await main();

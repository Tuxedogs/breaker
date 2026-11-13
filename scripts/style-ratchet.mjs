#!/usr/bin/env node
// Style ratchet: counts off-token styling per stylesheet and fails if any file gets worse.
//   node scripts/style-ratchet.mjs --update   write/refresh style-ratchet.baseline.json
//   node scripts/style-ratchet.mjs            check against baseline (CI / pre-commit)
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const BASELINE = join(ROOT, 'style-ratchet.baseline.json');
const TOKEN_FILES = new Set(['src/styles/tokens.css']);
const SKIP = /(^|\/)(_?archive|node_modules|design-preview)(\/|$)/;

const RULES = {
  colorLiteral: /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|hsl)a?\(\s*\d/g,
  rawFont: /font-family\s*:(?!\s*(?:var\(--|inherit))[^;]+;/g,
  rawRadius: /border-radius\s*:(?!\s*(?:var\(--|0;|inherit|50%))[^;]+;/g,
  important: /!important/g,
  localToken: /^\s*--[\w-]+\s*:/gm,
  mbTokenDefinition: /^\s*--mb-[\w-]+\s*:/gm, // --mb-* is defined only in tokens.css
};

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const rel = relative(ROOT, p).replaceAll('\\', '/');
    if (SKIP.test(rel)) continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.css')) out.push(rel);
  }
  return out;
}

function measure(file) {
  const text = readFileSync(join(ROOT, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const counts = {};
  for (const [k, re] of Object.entries(RULES)) counts[k] = (text.match(re) || []).length;
  return counts;
}

const current = {};
for (const f of walk(join(ROOT, 'src'))) if (!TOKEN_FILES.has(f)) current[f] = measure(f);

const totals = Object.values(current).reduce((t, c) => {
  for (const k in c) t[k] = (t[k] || 0) + c[k];
  return t;
}, {});

if (process.argv.includes('--update') || !existsSync(BASELINE)) {
  writeFileSync(BASELINE, JSON.stringify({ totals, files: current }, null, 2) + '\n');
  console.log('style-ratchet: baseline written', totals);
  process.exit(0);
}

const base = JSON.parse(readFileSync(BASELINE, 'utf8')).files;
const failures = [];
const improved = [];
for (const [f, c] of Object.entries(current)) {
  const b = base[f] || Object.fromEntries(Object.keys(RULES).map((k) => [k, 0]));
  for (const k of Object.keys(RULES)) {
    if (k === 'localToken' && !base[f]) continue; // new files may alias tokens
    if (c[k] > b[k]) failures.push(`${f}: ${k} ${b[k]} -> ${c[k]}`);
    if (c[k] < b[k]) improved.push(`${f}: ${k} ${b[k]} -> ${c[k]}`);
  }
}
if (improved.length) console.log(`style-ratchet: ${improved.length} improvement(s). Run with --update to lock them in.`);
if (failures.length) {
  console.error('style-ratchet FAILED. These files added off-token styling:\n  ' + failures.join('\n  '));
  console.error('Use tokens from src/styles/tokens.css (var(--mb-*)) instead of literals.');
  process.exit(1);
}
console.log('style-ratchet: OK', totals);

import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { getLocationTopography } from "./topographyAssets.js";

const sourceBodies: Array<[string, string]> = [
  ["Stanton", "Hurston"], ["Stanton", "Arial"], ["Stanton", "Aberdeen"],
  ["Stanton", "Magda"], ["Stanton", "Ita"], ["Stanton", "Crusader"],
  ["Stanton", "Cellin"], ["Stanton", "Daymar"], ["Stanton", "Yela"],
  ["Stanton", "ArcCorp"], ["Stanton", "Lyria"], ["Stanton", "Wala"],
  ["Stanton", "microTech"], ["Stanton", "Calliope"], ["Stanton", "Clio"],
  ["Stanton", "Euterpe"], ["Pyro", "Terminus"], ["Nyx", "Nyx I"],
  ["Nyx", "Nyx II"], ["Nyx", "Nyx III"],
];

test("all 20 finished, enhanced topography assets are mapped and available", () => {
  const paths = sourceBodies.map(([system, body]) => getLocationTopography(system, body));
  assert.equal(paths.filter(Boolean).length, 20);
  assert.equal(new Set(paths).size, 20);
  for (const asset of paths) {
    assert.ok(asset?.startsWith("/assets/planetsandmoons/topography-hero/"));
    const file = path.join("public", asset!.slice(1));
    assert.ok(existsSync(file), file);
    assert.ok(statSync(file).size > 1000 && statSync(file).size < 450000, file);
  }
});

test("assembled Pyro I-IV and six Pyro V moon textures resolve to their actual body", () => {
  const pyroBodies = [
    "Pyro I", "Monox", "Bloom", "Pyro IV",
    "Pyro V-a (Ignis)", "Pyro V-b (Vatra)", "Pyro V-c (Adir)",
    "Pyro V-d (Fairo)", "Pyro V-e (Fuego)", "Pyro V-f (Vuur)",
  ];
  const assets = pyroBodies.map((name) => getLocationTopography("Pyro", name));
  assert.equal(assets.filter(Boolean).length, pyroBodies.length);
  assert.equal(new Set(assets).size, pyroBodies.length);
  for (const asset of assets) {
    const file = path.join("public", asset!.slice(1));
    assert.ok(existsSync(file), file);
    assert.ok(statSync(file).size > 1000 && statSync(file).size < 450000, file);
  }
  assert.equal(getLocationTopography("Pyro", "Pyro II"), getLocationTopography("Pyro", "Monox"));
  assert.equal(getLocationTopography("Pyro", "Pyro III"), getLocationTopography("Pyro", "Bloom"));
  assert.equal(getLocationTopography("Pyro", "Adir"), getLocationTopography("Pyro", "Pyro V-c (Adir)"));
});

test("location aliases resolve the right body and unsupported locations have no fabricated texture", () => {
  assert.equal(getLocationTopography("pyro", "Pyro VI (Terminus)"), getLocationTopography("Pyro", "Terminus"));
  assert.equal(getLocationTopography("Pyro", "Pyro6"), getLocationTopography("Pyro", "Terminus"));
  assert.equal(getLocationTopography("Stanton", "ARIAL"), getLocationTopography("Stanton", "Arial"));
  assert.equal(getLocationTopography("Stanton", "Aaronhalo"), null);
  assert.equal(getLocationTopography("Pyro", "Daymar"), null);
});

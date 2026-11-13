import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";

import {
  FALLBACK_MATERIAL_COLOR,
  canonicalMaterialPresentations,
  resolveMaterialPresentation,
} from "./materialPresentation";

const expectedIcons = new Map([
  ["Pressurized Ice", "pressurized-ice.webp"], ["Borase", "borase.webp"], ["Gold", "gold.webp"],
  ["Taranite", "taranite.webp"], ["Stileron", "stileron.webp"], ["Iron", "iron.webp"],
  ["Titanium", "titanium.webp"], ["Riccite", "riccite.webp"], ["Savrilium", "savrilium.webp"],
  ["Copper", "copper.webp"], ["Ouratite", "ouratite.webp"], ["Hadanite", "hadanite.webp"],
  ["Dolivine", "dolivine.webp"], ["Sadaryx", "sadaryx.webp"], ["Feynmaline", "feynmaline.webp"],
  ["Saldynium", "saldynium.webp"], ["Carinite", "carinite.webp"], ["Janalite", "janalite.webp"],
  ["Jaclium", "jaclium.webp"], ["Aluminum", "aluminum.webp"], ["Hephaestanite", "hephaestanite.webp"],
  ["Aphorite", "aphorite.webp"], ["Corundum", "corundum.webp"], ["Tungsten", "tungsten.webp"],
  ["Laranite", "laranite.webp"], ["Aslarite", "aslarite.webp"],
]);

const expectedColors = new Map([
  ["Pressurized Ice", "#DDF4FF"], ["Borase", "#E8DDD1"], ["Gold", "#CFA22E"],
  ["Taranite", "#9C412F"], ["Stileron", "#49525D"], ["Iron", "#A89A8D"],
  ["Titanium", "#5B5A58"], ["Riccite", "#767C80"], ["Savrilium", "#4FA89C"],
  ["Copper", "#A56A49"], ["Ouratite", "#8D7A56"], ["Hadanite", "#D68AB8"],
  ["Dolivine", "#1EDB68"], ["Sadaryx", "#E7E7E2"], ["Feynmaline", "#3C7CE6"],
  ["Saldynium", "#B8BDC3"], ["Carinite", "#C45A7A"], ["Pure Carinite", "#7A1626"],
  ["Janalite", "#CDB24E"], ["Jaclium", "#556457"], ["Aluminum", "#8A5A44"],
  ["Hephaestanite", "#B66A32"], ["Aphorite", "#2A62FF"], ["Corundum", "#A54857"],
  ["Tungsten", "#5D564C"], ["Laranite", "#E7F0C7"], ["Aslarite", "#9C755F"],
]);

test("resolves all 26 supplied materials to their exact WebP assets", () => {
  assert.equal(expectedIcons.size, 26);
  for (const [material, filename] of expectedIcons) {
    assert.equal(resolveMaterialPresentation(material).iconSrc, `/assets/materials/${filename}`, material);
  }
});

test("resolves all 27 canonical material colors exactly", () => {
  assert.equal(canonicalMaterialPresentations.length, 27);
  for (const [material, color] of expectedColors) {
    assert.equal(resolveMaterialPresentation(material).color, color, material);
  }
});

test("keeps Pure Carinite separate from Carinite and without substituted artwork", () => {
  const carinite = resolveMaterialPresentation("Carinite");
  const pure = resolveMaterialPresentation("Pure Carinite");
  const sourceOrderAlias = resolveMaterialPresentation("Carinite Pure");
  assert.equal(carinite.canonicalKey, "carinite");
  assert.equal(carinite.color, "#C45A7A");
  assert.equal(carinite.iconSrc, "/assets/materials/carinite.webp");
  assert.equal(pure.canonicalKey, "carinite-pure");
  assert.equal(pure.color, "#7A1626");
  assert.equal(pure.iconSrc, null);
  assert.deepEqual(sourceOrderAlias, pure);
});

test("maps Corundum to the second red-rock asset and safely falls back for unknown materials", () => {
  assert.equal(resolveMaterialPresentation("Corundum").iconSrc, "/assets/materials/corundum.webp");
  assert.equal(resolveMaterialPresentation("Corundum").color, "#A54857");
  assert.deepEqual(resolveMaterialPresentation("Bexalite"), {
    canonicalKey: "bexalite",
    displayName: "Bexalite",
    color: FALLBACK_MATERIAL_COLOR,
    iconSrc: null,
    isCanonical: false,
  });
});

test("keeps every supplied icon as one centered transparent 256px WebP asset", async () => {
  const assetDirectory = path.resolve("public/assets/materials");
  const assets = (await readdir(assetDirectory)).filter((asset) => asset.endsWith(".webp")).sort();
  assert.deepEqual(assets, [...expectedIcons.values()].sort());

  for (const asset of assets) {
    const { data, info } = await sharp(path.join(assetDirectory, asset)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const metadata = await sharp(path.join(assetDirectory, asset)).metadata();
    assert.equal(metadata.format, "webp", asset);
    assert.equal(metadata.hasAlpha, true, asset);
    assert.equal(info.width, 256, asset);
    assert.equal(info.height, 256, asset);

    let transparentPixels = 0;
    let opaquePixels = 0;
    let minX = info.width;
    let minY = info.height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < info.height; y += 1) {
      for (let x = 0; x < info.width; x += 1) {
        const alpha = data[(y * info.width + x) * info.channels + 3];
        if (alpha === 0) {
          transparentPixels += 1;
          continue;
        }
        opaquePixels += 1;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    assert.ok(transparentPixels > 0, `${asset} must retain transparency`);
    assert.ok(opaquePixels > 0, `${asset} must retain one material`);
    assert.ok(minX > 0 && minY > 0 && maxX < info.width - 1 && maxY < info.height - 1, `${asset} must retain transparent breathing room`);
  }
});

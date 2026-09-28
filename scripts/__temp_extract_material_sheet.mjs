import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const sourcePath = "C:/Users/shane/Desktop/ChatGPT Image Sep 28, 2026, 09_55_30 AM.png";
const destination = "public/assets/materials";
const names = [
  "pressurized-ice.webp", "borase.webp", "gold.webp", "taranite.webp", "stileron.webp", "iron.webp",
  "titanium.webp", "riccite.webp", "savrilium.webp", "copper.webp", "ouratite.webp", "hadanite.webp",
  "dolivine.webp", "sadaryx.webp", "feynmaline.webp", "saldynium.webp", "carinite.webp", "janalite.webp",
  "jaclium.webp", "aluminum.webp", "hephaestanite.webp", "aphorite.webp", "corundum.webp", "tungsten.webp",
  "laranite.webp", "aslarite.webp",
];
const alphaThreshold = 16;
const sourceMargin = 7;

const { data, info } = await sharp(sourcePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;
const visited = new Uint8Array(width * height);
const queue = new Int32Array(width * height);
const components = [];
const alphaAt = (index) => data[index * channels + 3];

for (let seed = 0; seed < visited.length; seed += 1) {
  if (visited[seed] || alphaAt(seed) < alphaThreshold) continue;
  let head = 0;
  let tail = 0;
  queue[tail++] = seed;
  visited[seed] = 1;
  let count = 0;
  let minX = width;
  let maxX = 0;
  let minY = height;
  let maxY = 0;

  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    const y = Math.floor(index / width);
    count += 1;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    const neighbors = [index - 1, index + 1, index - width, index + width];
    for (const next of neighbors) {
      if (next < 0 || next >= visited.length || visited[next] || alphaAt(next) < alphaThreshold) continue;
      const nextX = next % width;
      const nextY = Math.floor(next / width);
      if (Math.abs(nextX - x) + Math.abs(nextY - y) !== 1) continue;
      visited[next] = 1;
      queue[tail++] = next;
    }
  }

  if (count >= 1000) {
    components.push({ count, minX, maxX, minY, maxY, centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2 });
  }
}

if (components.length !== names.length) {
  throw new Error(`Expected ${names.length} substantial components; detected ${components.length}.`);
}

const rows = [];
for (const component of components.sort((left, right) => left.centerY - right.centerY)) {
  const row = rows.find((candidate) => Math.abs(candidate.centerY - component.centerY) < 70);
  if (row) {
    row.components.push(component);
    row.centerY = row.components.reduce((sum, item) => sum + item.centerY, 0) / row.components.length;
  } else {
    rows.push({ centerY: component.centerY, components: [component] });
  }
}

const ordered = rows
  .sort((left, right) => left.centerY - right.centerY)
  .flatMap((row) => row.components.sort((left, right) => left.centerX - right.centerX));

if (rows.length !== 5 || rows.map((row) => row.components.length).join(",") !== "6,6,6,6,2") {
  throw new Error(`Unexpected row shape: ${rows.map((row) => row.components.length).join(",")}`);
}

await mkdir(destination, { recursive: true });
for (let index = 0; index < ordered.length; index += 1) {
  const component = ordered[index];
  const left = Math.max(0, component.minX - sourceMargin);
  const top = Math.max(0, component.minY - sourceMargin);
  const right = Math.min(width - 1, component.maxX + sourceMargin);
  const bottom = Math.min(height - 1, component.maxY + sourceMargin);
  await sharp(sourcePath)
    .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
    .resize(224, 224, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({ top: 16, bottom: 16, left: 16, right: 16, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ lossless: true, effort: 6 })
    .toFile(path.join(destination, names[index]));
  console.log(`${index + 1}. ${names[index]} <- (${component.minX},${component.minY})-(${component.maxX},${component.maxY})`);
}

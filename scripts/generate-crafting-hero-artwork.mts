import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const publicRoot = path.resolve("public");
const outputRoot = path.join(publicRoot, "images", "crafting", "hero-artwork");
const sources = [
  { input: path.join(publicRoot, "images", "component-thumbnails"), output: "component-thumbnails" },
  { input: path.join(publicRoot, "assets", "fitting", "components", "representative"), output: "representative" },
] as const;
const imageExtension = /\.(?:png|webp)$/i;

async function filesIn(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return filesIn(entryPath);
    return imageExtension.test(entry.name) ? [entryPath] : [];
  }));
  return files.flat();
}

async function trimToAlphaBounds(input: string, output: string) {
  const image = sharp(input, { animated: false }).ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  let left = info.width;
  let top = info.height;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * info.channels + (info.channels - 1)] === 0) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }

  if (right < left || bottom < top) {
    throw new Error(`No visible alpha bounds found: ${input}`);
  }

  await mkdir(path.dirname(output), { recursive: true });
  await sharp(input)
    .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
    .toFile(output);
}

for (const source of sources) {
  for (const input of await filesIn(source.input)) {
    const relativePath = path.relative(source.input, input);
    await trimToAlphaBounds(input, path.join(outputRoot, source.output, relativePath));
  }
}

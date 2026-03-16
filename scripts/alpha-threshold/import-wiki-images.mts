import { promises as fs } from 'node:fs'
import path from 'node:path'

import { getShipThresholdsForSource } from '../../src/tools/alpha-threshold/data/ships/ships'
import type { Ship } from '../../src/tools/alpha-threshold/types'

type WikiImageManifestEntry = {
  wikiUrl: string
  imageSrc: string
  imageAlt: string
}

type SearchResult = {
  title: string
}

type PageImagesResponse = {
  query?: {
    pages?: Record<
      string,
      {
        title?: string
        original?: {
          source?: string
        }
      }
    >
  }
}

type CliArgs = {
  outDir: string
  manifestPath: string
  reportPath?: string
}

const WIKI_ORIGIN = 'https://starcitizen.tools'
const WIKI_TITLE_OVERRIDES: Record<string, string> = {
  'aegs::avenger_titan_rngd.': 'Avenger Titan Renegade',
  'anvl::c8x_pisces_exp.': 'C8X Pisces Expedition',
  'anvl::f7c-m_hrtskr._mk_i': 'F7C-M Heartseeker Mk I',
  'anvl::f7c-m_hrtskr._mk_ii': 'F7C-M Heartseeker Mk II',
  'drak::dragonfly_yellowjckt': 'Dragonfly Yellowjacket',
  'rsi::constellation_andr.': 'Constellation Andromeda',
  'rsi::constellation_aqlla.': 'Constellation Aquila',
  'rsi::constellation_phnx.': 'Constellation Phoenix',
  'rsi::constellatn._phnxemr.': 'Constellation Phoenix Emerald',
}

function parseArgs(argv: string[]): CliArgs {
  const values: CliArgs = {
    outDir: 'public/ships/wiki',
    manifestPath: 'src/tools/alpha-threshold/data/ships/wikiImages.ts',
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = argv[index + 1]

    if (!arg.startsWith('--')) continue
    if (!next || next.startsWith('--')) {
      throw new Error(`Missing value for ${arg}`)
    }

    switch (arg) {
      case '--out-dir':
        values.outDir = next
        break
      case '--manifest':
        values.manifestPath = next
        break
      case '--report':
        values.reportPath = next
        break
      default:
        throw new Error(`Unknown argument: ${arg}`)
    }

    index += 1
  }

  return values
}

function decodeShipTitle(name: string): string {
  return name.replaceAll('_', ' ').trim()
}

function toLookupKey(ship: Pick<Ship, 'manufacturer' | 'name'>): string {
  return `${ship.manufacturer}::${ship.name}`.toLowerCase()
}

function toPublicImageSrc(fileName: string): string {
  return `/ships/wiki/${fileName}`
}

function toSafeFileName(title: string, imageUrl: URL): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  const extension = path.extname(imageUrl.pathname) || '.png'
  return `${base}${extension.toLowerCase()}`
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      accept: 'application/json,text/plain,*/*',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed request ${url}: HTTP ${response.status}`)
  }

  return response.json() as Promise<T>
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      accept: 'text/html,application/xhtml+xml',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed request ${url}: HTTP ${response.status}`)
  }

  return response.text()
}

async function downloadBinary(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed image request ${url}: HTTP ${response.status}`)
  }

  return response.arrayBuffer()
}

function pickSearchResult(results: SearchResult[], ship: Pick<Ship, 'name'>): SearchResult | null {
  const normalizedName = decodeShipTitle(ship.name).toLowerCase()
  const exact = results.find((result) => result.title.toLowerCase() === normalizedName)
  if (exact) return exact

  const startsWith = results.find((result) => result.title.toLowerCase().startsWith(normalizedName))
  if (startsWith) return startsWith

  return results[0] ?? null
}

async function resolveWikiTitle(ship: Pick<Ship, 'manufacturer' | 'name'>): Promise<string> {
  const overrideTitle = WIKI_TITLE_OVERRIDES[toLookupKey(ship)]
  if (overrideTitle) {
    return overrideTitle
  }

  const query = encodeURIComponent(decodeShipTitle(ship.name))
  const url = `${WIKI_ORIGIN}/api.php?action=query&list=search&srsearch=${query}&format=json&origin=*`
  const payload = await fetchJson<{ query?: { search?: SearchResult[] } }>(url)
  const result = pickSearchResult(payload.query?.search ?? [], ship)

  if (!result) {
    throw new Error(`No wiki page match for ${ship.name}`)
  }

  return result.title
}

async function resolvePageImage(title: string): Promise<string | null> {
  const queryTitle = encodeURIComponent(title)
  const url =
    `${WIKI_ORIGIN}/api.php?action=query&prop=pageimages&piprop=original&titles=${queryTitle}&format=json&origin=*`
  const payload = await fetchJson<PageImagesResponse>(url)
  const pages = payload.query?.pages ? Object.values(payload.query.pages) : []
  return pages[0]?.original?.source ?? null
}

function extractAttribute(fragment: string, attribute: string): string | null {
  const match = fragment.match(new RegExp(`${attribute}="([^"]+)"`, 'i'))
  return match?.[1] ?? null
}

function extractWikiImage(html: string): { src: string; alt: string } | null {
  const imgMatch = html.match(/<img[^>]*class="[^"]*\bmw-file-element\b[^"]*"[^>]*>/i)
  if (!imgMatch) return null

  const src = extractAttribute(imgMatch[0], 'src')
  if (!src) return null

  return {
    src: src.startsWith('//') ? `https:${src}` : new URL(src, WIKI_ORIGIN).toString(),
    alt: extractAttribute(imgMatch[0], 'alt') ?? '',
  }
}

async function writeManifest(filePath: string, manifest: Record<string, WikiImageManifestEntry>) {
  const content = `export const shipWikiImages = ${JSON.stringify(manifest, null, 2)} as const\n`
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, content, 'utf8')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const mergedShips = getShipThresholdsForSource('merged')
  const ships = [...new Map(mergedShips.map((ship) => [toLookupKey(ship), ship])).values()]
  const manifest: Record<string, WikiImageManifestEntry> = {}
  const failures: Array<{ ship: string; reason: string }> = []

  await fs.mkdir(args.outDir, { recursive: true })

  for (const ship of ships) {
    try {
      const title = await resolveWikiTitle(ship)
      const wikiUrl = `${WIKI_ORIGIN}/${encodeURIComponent(title.replaceAll(' ', '_'))}`
      const apiImageSrc = await resolvePageImage(title)
      const html = apiImageSrc ? null : await fetchText(wikiUrl)
      const image = apiImageSrc
        ? {
            src: apiImageSrc,
            alt: `${decodeShipTitle(ship.name)} ship image`,
          }
        : extractWikiImage(html ?? '')

      if (!image) {
        throw new Error('No .mw-file-element image found')
      }

      const imageUrl = new URL(image.src)
      const fileName = toSafeFileName(title, imageUrl)
      const outputPath = path.join(args.outDir, fileName)
      const binary = await downloadBinary(imageUrl.toString())

      await fs.writeFile(outputPath, Buffer.from(binary))

      manifest[toLookupKey(ship)] = {
        wikiUrl,
        imageSrc: toPublicImageSrc(fileName),
        imageAlt: image.alt || `${decodeShipTitle(ship.name)} ship image`,
      }
    } catch (error) {
      failures.push({
        ship: `${ship.manufacturer} ${ship.name}`,
        reason: error instanceof Error ? error.message : String(error),
      })
    }
  }

  await writeManifest(args.manifestPath, manifest)

  const report = {
    importedAt: new Date().toISOString(),
    totalShips: ships.length,
    downloaded: Object.keys(manifest).length,
    failed: failures,
  }

  if (args.reportPath) {
    await fs.mkdir(path.dirname(args.reportPath), { recursive: true })
    await fs.writeFile(args.reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  }

  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})

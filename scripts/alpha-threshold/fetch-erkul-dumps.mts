import { promises as fs } from 'node:fs'
import path from 'node:path'

type DatasetKey =
  | 'erkul-live-ships'
  | 'erkul-ptu-ships'
  | 'erkul-live-weapons'
  | 'erkul-ptu-weapons'

type SourceConfig = Partial<Record<DatasetKey, string>>

const DEFAULT_OUTPUTS: Record<DatasetKey, string> = {
  'erkul-live-ships': 'tmp/erkul-live-ships.json',
  'erkul-ptu-ships': 'tmp/erkul-ptu-ships.json',
  'erkul-live-weapons': 'tmp/erkul-live-weapons.json',
  'erkul-ptu-weapons': 'tmp/erkul-ptu-weapons.json',
}

type FetchArgs = {
  configPath: string
}

function parseArgs(argv: string[]): FetchArgs {
  const values: FetchArgs = {
    configPath: 'tmp/erkul-sources.json',
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = argv[index + 1]

    if (!arg.startsWith('--')) continue

    if (!next || next.startsWith('--')) {
      throw new Error(`Missing value for ${arg}`)
    }

    switch (arg) {
      case '--config':
        values.configPath = next
        break
      default:
        throw new Error(`Unknown argument: ${arg}`)
    }

    index += 1
  }

  return values
}

async function readConfig(configPath: string): Promise<SourceConfig> {
  const raw = await fs.readFile(configPath, 'utf8')
  const parsed = JSON.parse(raw) as unknown

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Invalid config file: ${configPath}`)
  }

  return parsed as SourceConfig
}

async function fetchJson(url: string) {
  const response = await fetch(url, {
    headers: {
      accept: 'application/json,text/plain,*/*',
      origin: 'https://www.erkul.games',
      referer: 'https://www.erkul.games/',
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed request ${url}: HTTP ${response.status}`)
  }

  return response.json()
}

async function writeDump(filePath: string, payload: unknown) {
  const targetPath = path.resolve(filePath)
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  await fs.writeFile(targetPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  return targetPath
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const config = await readConfig(args.configPath)
  const entries = Object.entries(DEFAULT_OUTPUTS) as Array<[DatasetKey, string]>

  const missingKeys = entries
    .filter(([key]) => !config[key]?.trim())
    .map(([key]) => key)

  if (missingKeys.length > 0) {
    throw new Error(
      `Missing source URLs in ${args.configPath}: ${missingKeys.join(', ')}`
    )
  }

  const results = await Promise.all(
    entries.map(async ([key, outPath]) => {
      const url = config[key]
      if (!url) {
        throw new Error(`Missing source URL for ${key}`)
      }

      const payload = await fetchJson(url)
      const savedPath = await writeDump(outPath, payload)

      return {
        key,
        url,
        outPath: savedPath,
      }
    })
  )

  console.log(JSON.stringify({ fetchedAt: new Date().toISOString(), results }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})

import { promises as fs } from 'node:fs'
import path from 'node:path'

type FetchArgs = {
  url?: string
  outPath: string
}

function parseArgs(argv: string[]): FetchArgs {
  const values: FetchArgs = {
    outPath: 'tmp/erkul-ptu-ships.json',
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = argv[index + 1]

    if (!arg.startsWith('--')) continue

    if (!next || next.startsWith('--')) {
      throw new Error(`Missing value for ${arg}`)
    }

    switch (arg) {
      case '--url':
        values.url = next
        break
      case '--out':
        values.outPath = next
        break
      default:
        throw new Error(`Unknown argument: ${arg}`)
    }

    index += 1
  }

  return values
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (!args.url) {
    throw new Error('Missing required --url argument')
  }

  const response = await fetch(args.url, {
    headers: {
      accept: 'application/json,text/plain,*/*',
      origin: 'https://www.erkul.games',
      referer: 'https://www.erkul.games/',
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed request ${args.url}: HTTP ${response.status}`)
  }

  const payload = await response.json()
  const output = `${JSON.stringify(payload, null, 2)}\n`
  const targetPath = path.resolve(args.outPath)

  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  await fs.writeFile(targetPath, output, 'utf8')

  console.log(`Saved PTU ship dump to ${targetPath}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})

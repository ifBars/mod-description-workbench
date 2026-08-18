import { copyFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildMcpUi } from './ui/build'

await buildMcpUi()

const mcpRoot = dirname(fileURLToPath(import.meta.url))
const root = resolve(mcpRoot, '..')
const outputRoot = resolve(root, 'dist-mcp')

export async function buildMcpServer() {
  await buildMcpUi()

  const build = await Bun.build({
    entrypoints: [resolve(mcpRoot, 'portable.ts')],
    target: 'node',
    outdir: outputRoot,
    naming: 'server.js',
  })

  if (!build.success) {
    throw new AggregateError(build.logs, 'Could not build the MCP server')
  }

  const previewOutput = resolve(outputRoot, 'ui', 'dist', 'nexus-preview.html')
  await mkdir(dirname(previewOutput), { recursive: true })
  await copyFile(resolve(mcpRoot, 'ui', 'dist', 'nexus-preview.html'), previewOutput)
  return resolve(outputRoot, 'server.js')
}

if (import.meta.main) console.log(await buildMcpServer())

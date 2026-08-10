import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { strToU8, zipSync } from 'fflate'
import packageJson from '../package.json'
import { buildMcpServer } from './build'

const mcpRoot = dirname(fileURLToPath(import.meta.url))
const root = resolve(mcpRoot, '..')
const outputRoot = resolve(root, '.artifacts', 'release')
const windowsName = `Nexus.Description.MCP_${packageJson.version}_windows-x64.zip`
const portableName = `Nexus.Description.MCP_${packageJson.version}_portable.zip`
const executablePath = resolve(outputRoot, 'staging', 'nexus-description-mcp.exe')
const windowsPath = resolve(outputRoot, windowsName)
const portablePath = resolve(outputRoot, portableName)
const installerPath = resolve(outputRoot, 'install-mcp.ps1')

await mkdir(dirname(executablePath), { recursive: true })
const serverPath = await buildMcpServer()

const compiled = await Bun.build({
  entrypoints: [resolve(mcpRoot, 'standalone.mjs')],
  compile: {
    target: 'bun-windows-x64-baseline',
    outfile: executablePath,
    windows: {
      title: 'Nexus Description MCP',
      publisher: 'ifBars',
      version: packageJson.version,
      description: 'Local Nexus Mods description authoring and preview MCP server',
    },
  },
})

if (!compiled.success) {
  throw new AggregateError(compiled.logs, 'Could not compile the standalone MCP executable')
}

const previewPath = resolve(root, 'dist-mcp', 'ui', 'dist', 'nexus-preview.html')
const [executable, server, preview, license] = await Promise.all([
  readFile(executablePath),
  readFile(serverPath),
  readFile(previewPath),
  readFile(resolve(root, 'LICENSE')),
])
const windowsReadme = `Nexus Description MCP ${packageJson.version}\n\nThis Windows x64 executable is self-contained. Configure your MCP client to run nexus-description-mcp.exe as a local STDIO server with no arguments.\n`
const windowsArchive = zipSync({
  'nexus-description-mcp.exe': new Uint8Array(executable),
  'README.txt': strToU8(windowsReadme),
  LICENSE: new Uint8Array(license),
}, { level: 9 })
await writeFile(windowsPath, windowsArchive)

const portableReadme = `Nexus Description MCP ${packageJson.version}\n\nRequires Node.js 20 or newer. Configure your MCP client to run:\n  node /absolute/path/to/server.js\n\nKeep ui/dist/nexus-preview.html beside server.js so compatible clients can render the embedded preview.\n`
const archive = zipSync({
  'nexus-description-mcp/server.js': new Uint8Array(server),
  'nexus-description-mcp/ui/dist/nexus-preview.html': new Uint8Array(preview),
  'nexus-description-mcp/README.txt': strToU8(portableReadme),
  'nexus-description-mcp/LICENSE': new Uint8Array(license),
}, { level: 9 })
await writeFile(portablePath, archive)
await copyFile(resolve(root, 'scripts', 'install-mcp.ps1'), installerPath)

const releaseFiles = [windowsPath, portablePath, installerPath]
const checksums = await Promise.all(releaseFiles.map(async (path) => {
  const digest = createHash('sha256').update(await readFile(path)).digest('hex')
  return `${digest}  ${path.split(/[\\/]/).at(-1)}`
}))
await writeFile(resolve(outputRoot, 'SHA256SUMS.txt'), `${checksums.join('\n')}\n`, 'utf8')

for (const path of [...releaseFiles, resolve(outputRoot, 'SHA256SUMS.txt')]) console.log(path)

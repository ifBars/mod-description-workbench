import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { strToU8, zipSync } from 'fflate'
import { rcedit } from 'rcedit'
import packageJson from '../package.json'
import { buildMcpServer } from './build'

const mcpRoot = dirname(fileURLToPath(import.meta.url))
const NODE_SEA_VERSION = (await readFile(resolve(mcpRoot, 'node-sea-version.txt'), 'utf8')).trim()
const NODE_SEA_FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2'
const root = resolve(mcpRoot, '..')
const outputRoot = resolve(root, '.artifacts', 'release')
const stagingRoot = resolve(outputRoot, 'staging')
const windowsName = `Nexus.Description.MCP_${packageJson.version}_windows-x64.zip`
const portableName = `Nexus.Description.MCP_${packageJson.version}_portable.zip`
const executablePath = resolve(stagingRoot, 'nexus-description-mcp.exe')
const bunFallbackPath = resolve(stagingRoot, 'nexus-description-mcp-bun-fallback.exe')
const windowsPath = resolve(outputRoot, windowsName)
const portablePath = resolve(outputRoot, portableName)
const installerPath = resolve(outputRoot, 'install-mcp.ps1')

async function run(command: string[]) {
  const child = Bun.spawn(command, { cwd: root, stdout: 'inherit', stderr: 'inherit' })
  const exitCode = await child.exited
  if (exitCode !== 0) throw new Error(`Command failed (${exitCode}): ${command.join(' ')}`)
}

function resolvePinnedNode() {
  if (process.platform !== 'win32') throw new Error('mcp:package must run on Windows to build the Node SEA executable.')
  const nodePath = Bun.which('node')
  if (!nodePath) throw new Error(`Node.js ${NODE_SEA_VERSION} is required to build the Windows MCP executable.`)
  const version = Bun.spawnSync([nodePath, '--version']).stdout.toString().trim().replace(/^v/, '')
  if (version !== NODE_SEA_VERSION) {
    throw new Error(`Node.js ${NODE_SEA_VERSION} is required for a reproducible SEA build; found ${version || 'an unreadable version'}.`)
  }
  return nodePath
}

async function buildNodeSea(nodePath: string, previewPath: string) {
  const bundlePath = resolve(stagingRoot, 'node-sea-bundle.cjs')
  const configPath = resolve(stagingRoot, 'node-sea-config.json')
  const blobPath = resolve(stagingRoot, 'node-sea-prep.blob')
  const build = await Bun.build({
    entrypoints: [resolve(mcpRoot, 'sea.ts')],
    target: 'node',
    format: 'cjs',
    minify: true,
    outdir: stagingRoot,
    naming: 'node-sea-bundle.cjs',
  })
  if (!build.success) throw new AggregateError(build.logs, 'Could not bundle the Node SEA entry point')

  await writeFile(configPath, JSON.stringify({
    main: bundlePath,
    output: blobPath,
    disableExperimentalSEAWarning: true,
    useSnapshot: false,
    useCodeCache: false,
    assets: { 'nexus-preview.html': previewPath },
  }, null, 2))

  await run([nodePath, '--experimental-sea-config', configPath])
  await copyFile(nodePath, executablePath)
  const versionStrings = {
    CompanyName: 'ifBars',
    FileDescription: 'Local Nexus Mods description authoring and preview MCP server',
    InternalName: 'nexus-description-mcp',
    OriginalFilename: 'nexus-description-mcp.exe',
    ProductName: 'Nexus Description MCP',
  }
  await rcedit(executablePath, {
    'version-string': versionStrings,
    'file-version': packageJson.version,
    'product-version': packageJson.version,
    icon: resolve(root, 'src-tauri', 'icons', 'icon.ico'),
    'requested-execution-level': 'asInvoker',
  })
  await run([
    nodePath,
    resolve(root, 'node_modules', 'postject', 'dist', 'cli.js'),
    executablePath,
    'NODE_SEA_BLOB',
    blobPath,
    '--sentinel-fuse',
    NODE_SEA_FUSE,
  ])
  await Promise.all([bundlePath, configPath, blobPath].map((path) => rm(path, { force: true })))
}

async function buildBunFallback() {
  const build = await Bun.build({
    entrypoints: [resolve(mcpRoot, 'standalone.mjs')],
    compile: {
      outfile: bunFallbackPath,
      windows: {
        title: 'Nexus Description MCP',
        publisher: 'ifBars',
        version: packageJson.version,
        description: 'Local Nexus Mods description authoring and preview MCP server',
      },
    },
  })
  if (!build.success) throw new AggregateError(build.logs, 'Could not compile the Bun fallback MCP executable')
}

await mkdir(stagingRoot, { recursive: true })
const nodePath = resolvePinnedNode()
const serverPath = await buildMcpServer()
const previewPath = resolve(root, 'dist-mcp', 'ui', 'dist', 'nexus-preview.html')
await Promise.all([buildNodeSea(nodePath, previewPath), buildBunFallback()])

const [executable, server, preview, license, nodeLicense] = await Promise.all([
  readFile(executablePath),
  readFile(serverPath),
  readFile(previewPath),
  readFile(resolve(root, 'LICENSE')),
  readFile(resolve(mcpRoot, 'licenses', 'NODE_LICENSE.txt')),
])
const windowsReadme = `Nexus Description MCP ${packageJson.version}\n\nThis Windows x64 executable is a self-contained Node.js ${NODE_SEA_VERSION} Single Executable Application. Configure your MCP client to run nexus-description-mcp.exe as a local STDIO server with no arguments.\n`
const windowsArchive = zipSync({
  'nexus-description-mcp.exe': new Uint8Array(executable),
  'README.txt': strToU8(windowsReadme),
  LICENSE: new Uint8Array(license),
  'LICENSE-NODE.txt': new Uint8Array(nodeLicense),
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

for (const path of [...releaseFiles, resolve(outputRoot, 'SHA256SUMS.txt'), bunFallbackPath]) console.log(path)

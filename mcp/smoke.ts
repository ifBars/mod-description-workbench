import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { NEXUS_PREVIEW_RESOURCE_URI } from './ui/constants'

const standaloneIndex = process.argv.indexOf('--standalone')
const standalonePath = standaloneIndex >= 0 ? process.argv[standaloneIndex + 1] : undefined
const portableIndex = process.argv.indexOf('--portable')
const portablePath = portableIndex >= 0 ? process.argv[portableIndex + 1] : undefined
const entrypoint = resolve(standalonePath ?? portablePath ?? resolve(process.cwd(), 'dist-mcp', 'server.js'))

if (!existsSync(entrypoint)) throw new Error(`${entrypoint} is missing. Build the MCP package first.`)

const client = new Client({ name: 'nexus-description-built-smoke', version: '1.0.0' })

try {
  await client.connect(new StdioClientTransport({
    command: standalonePath ? entrypoint : 'node',
    args: standalonePath ? [] : [entrypoint],
    cwd: process.cwd(),
    stderr: 'pipe',
  }))

  const tools = await client.listTools()
  const buildTool = tools.tools.find((tool) => tool.name === 'build_nexus_description')
  const buildUi = buildTool?._meta?.ui as { resourceUri?: string } | undefined
  if (buildUi?.resourceUri !== NEXUS_PREVIEW_RESOURCE_URI) {
    throw new Error('The built description tool is not attached to the preview resource.')
  }

  const result = await client.callTool({
    name: 'build_nexus_description',
    arguments: {
      name: 'Signal Relay',
      tagline: 'Clear radio status at a glance.',
      overview: 'A focused quality-of-life mod that makes radio state easier to understand.',
      features: ['Shows the active channel clearly', 'Coalesces repeated status notices'],
      installation: ['Install the supported mod loader', 'Place SignalRelay.dll in the Mods folder'],
      presentation: 'editorial',
    },
  })
  const output = result.structuredContent as { bbcode?: string; issues?: string[] } | undefined
  if (!output?.bbcode?.includes('[b]Signal Relay[/b]') || output.issues?.length !== 0) {
    throw new Error('The built server did not return clean structured preview data.')
  }

  const resource = await client.readResource({ uri: NEXUS_PREVIEW_RESOURCE_URI })
  const preview = resource.contents[0]
  const html = preview && 'text' in preview ? preview.text : ''
  if (preview?.mimeType !== 'text/html;profile=mcp-app' || !html.includes('ui/notifications/tool-result')) {
    throw new Error('The built server did not serve a valid MCP App resource.')
  }

  const distribution = standalonePath ? 'Standalone' : portablePath ? 'Portable' : 'Built'
  console.log(`${distribution} MCP smoke passed: ${tools.tools.length} tools, interactive preview, clean description result.`)
} finally {
  await client.close()
}

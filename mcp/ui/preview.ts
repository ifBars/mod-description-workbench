import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const port = Number(process.env.NEXUS_MCP_PREVIEW_PORT ?? 4175)
const htmlPath = resolve(dirname(fileURLToPath(import.meta.url)), 'dist', 'nexus-preview.html')
const server = Bun.serve({
  hostname: '127.0.0.1',
  port,
  async fetch() {
    return new Response(await readFile(htmlPath), { headers: { 'content-type': 'text/html; charset=utf-8' } })
  },
})

console.log(`Nexus MCP preview: ${server.url}?preview=1`)

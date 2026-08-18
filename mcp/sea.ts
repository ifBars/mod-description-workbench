import { getAsset } from 'node:sea'
import { startMcpServer } from './server'

void startMcpServer(() => getAsset('nexus-preview.html', 'utf8')).catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})

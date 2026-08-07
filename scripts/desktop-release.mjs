/* global Bun, process */

import { existsSync, unlinkSync } from 'node:fs'

const generatedConfig = 'src-tauri/.tauri-updater.generated.conf.json'
const generatedCapability = 'src-tauri/capabilities/.updater.generated.json'
const publicKey = process.env.TAURI_UPDATER_PUBLIC_KEY?.trim()
const privateKey = process.env.TAURI_SIGNING_PRIVATE_KEY?.trim()

if (!publicKey || !privateKey) {
  throw new Error('A signed release requires TAURI_UPDATER_PUBLIC_KEY and TAURI_SIGNING_PRIVATE_KEY. See docs/DESKTOP_RELEASES.md.')
}
if (existsSync(generatedConfig) || existsSync(generatedCapability)) {
  throw new Error('A generated updater configuration already exists. Remove only the generated local updater files before retrying.')
}

const configuration = {
  bundle: { createUpdaterArtifacts: true },
  plugins: {
    updater: {
      pubkey: publicKey,
      endpoints: ['https://github.com/ifBars/mod-description-workbench/releases/latest/download/latest.json'],
      windows: { installMode: 'passive' },
    },
  },
}

await Bun.write(generatedConfig, `${JSON.stringify(configuration, null, 2)}\n`)
await Bun.write(generatedCapability, `${JSON.stringify({
  identifier: 'updater',
  description: 'Allows signed update checks, installation, and the final restart only for release builds.',
  windows: ['main'],
  permissions: ['process:allow-restart', 'updater:allow-check', 'updater:allow-download-and-install'],
}, null, 2)}\n`)
try {
  const child = Bun.spawn(['bun', 'scripts/desktop.mjs', 'build', '--features', 'updater', '--config', generatedConfig], {
    cwd: process.cwd(),
    env: { ...process.env, VITE_TAURI_UPDATER_CONFIGURED: 'true' },
    stdin: 'inherit', stdout: 'inherit', stderr: 'inherit',
  })
  process.exitCode = await child.exited
} finally {
  if (existsSync(generatedConfig)) unlinkSync(generatedConfig)
  if (existsSync(generatedCapability)) unlinkSync(generatedCapability)
}

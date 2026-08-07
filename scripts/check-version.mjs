import { readFileSync } from 'node:fs'

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function cargoVersion(source) {
  const match = source.match(/^version\s*=\s*"([^"]+)"$/m)
  if (!match) throw new Error('Could not read the Cargo package version.')
  return match[1]
}

const packageVersion = readJson('package.json').version
const tauriVersion = readJson('src-tauri/tauri.conf.json').version
const rustVersion = cargoVersion(readFileSync('src-tauri/Cargo.toml', 'utf8'))

if (![packageVersion, tauriVersion, rustVersion].every((version) => typeof version === 'string' && version === packageVersion)) {
  throw new Error(`Version drift: package.json=${packageVersion}, tauri.conf.json=${tauriVersion}, Cargo.toml=${rustVersion}`)
}

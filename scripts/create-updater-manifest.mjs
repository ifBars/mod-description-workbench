/* global process */

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

const version = JSON.parse(readFileSync('package.json', 'utf8')).version
const tag = process.env.RELEASE_TAG
const repository = process.env.GITHUB_REPOSITORY ?? 'ifBars/mod-description-workbench'
const output = process.env.UPDATER_MANIFEST_PATH ?? '.artifacts/latest.json'

if (tag !== `v${version}`) throw new Error(`RELEASE_TAG must be v${version}.`)
if (repository !== 'ifBars/mod-description-workbench') throw new Error('Updater manifest repository does not match the configured stable endpoint.')

const bundle = join('src-tauri', 'target', 'release', 'bundle', 'nsis')
const installer = join(bundle, `Mod Description Workbench_${version}_x64-setup.exe`)
const signature = `${installer}.sig`
if (!existsSync(installer) || statSync(installer).size === 0) throw new Error('Signed NSIS updater artifact is missing or empty.')
if (!existsSync(signature) || statSync(signature).size === 0) throw new Error('NSIS updater signature is missing or empty.')

const manifest = {
  version,
  notes: 'Initial signed desktop release with native file dialogs, lifecycle handling, and optional updates.',
  pub_date: new Date().toISOString(),
  platforms: {
    'windows-x86_64': {
      signature: readFileSync(signature, 'utf8').trim(),
      url: `https://github.com/${repository}/releases/download/${tag}/${encodeURIComponent(basename(installer))}`,
    },
  },
}

mkdirSync(dirname(output), { recursive: true })
writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`)

import { open, save } from '@tauri-apps/plugin-dialog'
import { readFile, writeFile } from '@tauri-apps/plugin-fs'
import type { FilePlatform } from './types'

function nameFromPath(path: string) {
  return path.split(/[\\/]/).at(-1) || 'imported-file'
}

export const tauriFiles: FilePlatform = {
  async chooseFile(request) {
    const path = await open({ directory: false, multiple: false, filters: request.filters })
    if (!path || Array.isArray(path)) return { cancelled: true }
    return { cancelled: false, file: { name: nameFromPath(path), bytes: await readFile(path) } }
  },
  async saveFile(request) {
    const path = await save({ defaultPath: request.filename, filters: request.filters })
    if (!path) return { cancelled: true }
    await writeFile(path, request.bytes)
    return { cancelled: false }
  },
}

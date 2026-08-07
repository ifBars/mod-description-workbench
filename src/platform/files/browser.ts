import type { ChooseFileRequest, FilePlatform, FileSelection, SaveFileRequest } from './types'

function acceptValue(request: ChooseFileRequest) {
  return request.filters.flatMap((filter) => filter.extensions.map((extension) => `.${extension.replace(/^\./, '')}`)).join(',')
}

async function selectedFile(file: File) {
  return { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) }
}

export const browserFiles: FilePlatform = {
  chooseFile(request) {
    return new Promise<FileSelection>((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = acceptValue(request)
      input.hidden = true
      let settled = false
      const finish = (result: FileSelection) => {
        if (settled) return
        settled = true
        input.remove()
        resolve(result)
      }
      input.addEventListener('change', () => {
        const file = input.files?.[0]
        if (!file) { finish({ cancelled: true }); return }
        void selectedFile(file).then((value) => finish({ cancelled: false, file: value }))
      }, { once: true })
      input.addEventListener('cancel', () => finish({ cancelled: true }), { once: true })
      document.body.append(input)
      input.click()
    })
  },
  async saveFile(request: SaveFileRequest) {
    const url = URL.createObjectURL(new Blob([new Uint8Array(request.bytes)], { type: request.mimeType }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = request.filename
    anchor.hidden = true
    document.body.append(anchor)
    try { anchor.click() } finally {
      anchor.remove()
      setTimeout(() => URL.revokeObjectURL(url), 0)
    }
    return { cancelled: false }
  },
}

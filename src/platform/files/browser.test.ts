import { afterEach, describe, expect, it, vi } from 'vitest'
import { browserFiles } from './browser'

describe('browser file platform', () => {
  afterEach(() => {
    document.body.replaceChildren()
    vi.restoreAllMocks()
  })

  it('downloads exact bytes and revokes its temporary object URL', async () => {
    const createObjectURL = vi.fn(() => 'blob:export')
    const revokeObjectURL = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)

    await browserFiles.saveFile({ filename: 'description.txt', mimeType: 'text/plain;charset=utf-8', bytes: new TextEncoder().encode('exact content'), filters: [{ name: 'Text', extensions: ['txt'] }] })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:export')
  })

  it('treats a cancelled file picker as a normal result', async () => {
    const originalCreate = document.createElement.bind(document)
    let input: HTMLInputElement | undefined
    vi.spyOn(document, 'createElement').mockImplementation(((name: string) => {
      const element = originalCreate(name)
      if (name === 'input') input = element as HTMLInputElement
      return element
    }) as typeof document.createElement)
    const picker = browserFiles.chooseFile({ filters: [{ name: 'Workspace', extensions: ['mdw'] }] })
    input?.dispatchEvent(new Event('cancel'))
    await expect(picker).resolves.toEqual({ cancelled: true })
  })
})

import { describe, expect, it } from 'vitest'
import { runtimeFromTauriFlag } from './runtime'
import { filePlatformForRuntime } from './files'
import { browserFiles } from './files/browser'

describe('platform runtime selection', () => {
  it('keeps browser and Tauri detection explicit', () => {
    expect(runtimeFromTauriFlag(false)).toBe('browser')
    expect(runtimeFromTauriFlag(true)).toBe('tauri')
  })

  it('selects the browser file driver without loading native APIs', async () => {
    expect(await filePlatformForRuntime('browser')).toBe(browserFiles)
  })
})

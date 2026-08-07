import { describe, expect, it } from 'vitest'
import { desktopWindowForRuntime } from './index'

describe('desktop window selection', () => {
  it('keeps the web build free of native window access', async () => {
    await expect(desktopWindowForRuntime('browser')).resolves.toBeNull()
  })
})

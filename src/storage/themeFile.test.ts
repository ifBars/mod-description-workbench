import { describe, expect, it } from 'vitest'
import type { CustomTheme } from '../domain/types'
import { createThemeExport, readThemeFile } from './themeFile'

const theme: CustomTheme = {
  id: 'theme-id', name: 'Portable theme', dark: true,
  tokens: { canvas: '#111111', surfaceLow: '#222222', surfaceRaised: '#333333', border: '#444444', text: '#eeeeee', muted: '#aaaaaa', accent: '#dd7733', accentHover: '#ee8844', focus: '#5599cc' },
}

describe('portable themes', () => {
  it('creates an exact UTF-8 save payload', () => {
    const payload = createThemeExport(theme)
    expect(payload).toMatchObject({ filename: 'portable-theme.mdw-theme.json', mimeType: 'application/json;charset=utf-8', filters: [{ name: 'Mod Description Theme', extensions: ['json'] }] })
    expect(new TextDecoder().decode(payload.bytes)).toBe(JSON.stringify(theme, null, 2))
  })

  it('rejects invalid input without producing an importable theme', async () => {
    await expect(readThemeFile({ name: 'invalid.json', bytes: new TextEncoder().encode('{"tokens":{}}') })).rejects.toThrow('Invalid theme file')
  })
})

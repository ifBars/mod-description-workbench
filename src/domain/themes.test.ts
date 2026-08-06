import { createCustomTheme, DARK_THEME_TOKENS, LIGHT_THEME_TOKENS, themeVariables } from './themes'

describe('theme model', () => {
  it('creates isolated dark theme tokens', () => {
    const theme = createCustomTheme(true)
    theme.tokens.accent = '#000000'
    expect(DARK_THEME_TOKENS.accent).toBe('#d97732')
  })

  it('creates the true-light theme direction', () => {
    const theme = createCustomTheme(false)
    expect(theme.dark).toBe(false)
    expect(theme.tokens).toEqual(LIGHT_THEME_TOKENS)
  })

  it('maps portable tokens onto app CSS variables', () => {
    const theme = createCustomTheme(true)
    expect(themeVariables(theme)).toMatchObject({ '--canvas': '#181818', '--accent': '#d97732', '--focus': '#5f91c7' })
  })

  it('does not emit overrides without a custom theme', () => expect(themeVariables()).toBeUndefined())
})

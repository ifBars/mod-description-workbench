import type { CustomTheme, ThemeTokens } from './types'
import type { CSSProperties } from 'react'

export const DARK_THEME_TOKENS: ThemeTokens = {
  canvas: '#181818', surfaceLow: '#202020', surfaceRaised: '#262626', border: '#343434',
  text: '#f2f2f2', muted: '#a4a4a4', accent: '#d97732', accentHover: '#e7863d', focus: '#5f91c7',
}

export const LIGHT_THEME_TOKENS: ThemeTokens = {
  canvas: '#ffffff', surfaceLow: '#f6f6f6', surfaceRaised: '#ffffff', border: '#e1e1e1',
  text: '#171717', muted: '#686868', accent: '#c96728', accentHover: '#b85b22', focus: '#0a6ccc',
}

export function createCustomTheme(dark = true): CustomTheme {
  return {
    id: crypto.randomUUID(),
    name: 'My theme',
    dark,
    tokens: { ...(dark ? DARK_THEME_TOKENS : LIGHT_THEME_TOKENS) },
  }
}

export function themeVariables(theme?: CustomTheme): CSSProperties | undefined {
  if (!theme) return undefined
  return {
    '--canvas': theme.tokens.canvas,
    '--surface-low': theme.tokens.surfaceLow,
    '--surface': theme.tokens.surfaceRaised,
    '--border': theme.tokens.border,
    '--text': theme.tokens.text,
    '--muted': theme.tokens.muted,
    '--accent': theme.tokens.accent,
    '--accent-hover': theme.tokens.accentHover,
    '--focus': theme.tokens.focus,
  } as CSSProperties
}

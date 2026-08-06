import type { KeyboardEvent as ReactKeyboardEvent } from 'react'

const focusableSelector = 'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'

export function trapFocus(event: ReactKeyboardEvent<HTMLElement>, onEscape: () => void) {
  if (event.key === 'Escape') { event.preventDefault(); onEscape(); return }
  if (event.key !== 'Tab') return
  const elements = [...event.currentTarget.querySelectorAll<HTMLElement>(focusableSelector)].filter((element) => element.offsetParent !== null)
  if (elements.length === 0) return
  const first = elements[0]!
  const last = elements.at(-1)!
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
}

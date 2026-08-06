import { useRef, type PointerEvent as ReactPointerEvent } from 'react'

interface SplitDividerProps {
  ratio: number
  onChange: (ratio: number) => void
}

const DEFAULT_RATIO = 54

function clampRatio(value: number, width: number) {
  const minimum = Math.min(48, (420 / width) * 100)
  const maximum = Math.max(52, 100 - (380 / width) * 100)
  return Math.round(Math.min(maximum, Math.max(minimum, value)))
}

function gridColumns(ratio: number) {
  return `minmax(420px, ${ratio}fr) 5px minmax(380px, ${100 - ratio}fr)`
}

export function SplitDivider({ ratio, onChange }: SplitDividerProps) {
  const drag = useRef<{ left: number; width: number; ratio: number } | null>(null)

  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    const active = drag.current
    const workspace = event.currentTarget.parentElement
    if (!active || !workspace) return
    active.ratio = clampRatio(((event.clientX - active.left) / active.width) * 100, active.width)
    workspace.style.gridTemplateColumns = gridColumns(active.ratio)
    event.currentTarget.setAttribute('aria-valuenow', String(active.ratio))
  }
  const finish = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    const next = drag.current.ratio
    drag.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
    onChange(next)
  }
  const cancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = null
    const workspace = event.currentTarget.parentElement
    if (workspace) workspace.style.gridTemplateColumns = gridColumns(ratio)
    event.currentTarget.setAttribute('aria-valuenow', String(ratio))
  }
  const setRatio = (next: number) => onChange(Math.min(70, Math.max(35, next)))

  return <div
    className="workspace-divider"
    role="separator"
    aria-label="Resize editor and preview"
    aria-orientation="vertical"
    aria-valuemin={35}
    aria-valuemax={70}
    aria-valuenow={ratio}
    tabIndex={0}
    title="Drag to resize · double-click to reset"
    onDoubleClick={() => setRatio(DEFAULT_RATIO)}
    onPointerDown={(event) => {
      const workspace = event.currentTarget.parentElement
      if (!workspace) return
      const bounds = workspace.getBoundingClientRect()
      drag.current = { left: bounds.left, width: bounds.width, ratio }
      event.currentTarget.setPointerCapture(event.pointerId)
    }}
    onPointerMove={move}
    onPointerUp={finish}
    onPointerCancel={cancel}
    onKeyDown={(event) => {
      if (event.key === 'ArrowLeft') { event.preventDefault(); setRatio(ratio - 2) }
      else if (event.key === 'ArrowRight') { event.preventDefault(); setRatio(ratio + 2) }
      else if (event.key === 'Home') { event.preventDefault(); setRatio(35) }
      else if (event.key === 'End') { event.preventDefault(); setRatio(70) }
    }}
  />
}

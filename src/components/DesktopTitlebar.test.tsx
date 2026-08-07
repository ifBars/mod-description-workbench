import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const window = { minimize: vi.fn(), toggleMaximize: vi.fn(), close: vi.fn(), startDragging: vi.fn() }
vi.mock('../platform/window', () => ({ desktopWindow: vi.fn(async () => window) }))

import { DesktopTitlebar } from './DesktopTitlebar'

describe('DesktopTitlebar', () => {
  it('exposes accessible window controls without making them draggable', async () => {
    const { container } = render(<DesktopTitlebar />)
    fireEvent.click(screen.getByRole('button', { name: 'Minimize window' }))
    fireEvent.click(screen.getByRole('button', { name: 'Maximize or restore window' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close window' }))
    await vi.waitFor(() => expect(window.minimize).toHaveBeenCalledOnce())
    expect(window.toggleMaximize).toHaveBeenCalledOnce()
    expect(window.close).toHaveBeenCalledOnce()
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Close window' }))
    expect(window.startDragging).not.toHaveBeenCalled()
    fireEvent.mouseDown(container.querySelector('.desktop-titlebar-spacer')!)
    await vi.waitFor(() => expect(window.startDragging).toHaveBeenCalledOnce())
  })
})

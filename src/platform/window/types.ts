export interface CloseRequestedEvent {
  preventDefault(): void
}

export interface DesktopWindow {
  close(): Promise<void>
  minimize(): Promise<void>
  toggleMaximize(): Promise<void>
  startDragging(): Promise<void>
  onCloseRequested(handler: (event: CloseRequestedEvent) => void | Promise<void>): Promise<() => void>
}

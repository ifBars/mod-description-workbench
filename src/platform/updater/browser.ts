import type { UpdaterPlatform } from './types'

export const browserUpdater: UpdaterPlatform = {
  configuration: { kind: 'missing' },
  currentVersion: async () => 'browser',
  check: async () => null,
  relaunch: async () => undefined,
}

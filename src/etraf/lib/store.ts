// Etrafimda ayarlari ve son tarama (yalnizca 'et-' onekli yerel anahtarlar).
import type { ScanResult, SortId } from './types'

const K_SETTINGS = 'et-settings'
const K_LAST = 'et-last-scan'

export interface Settings {
  googleKey: string
  radiusM: number
  sort: SortId
}

const DEFAULTS: Settings = { googleKey: '', radiusM: 1000, sort: 'mesafe' }

export const RADIUS_OPTIONS = [300, 500, 1000, 2000, 5000]

export function getSettings(): Settings {
  try {
    const raw = localStorage.getItem(K_SETTINGS)
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    /* yok say */
  }
  return { ...DEFAULTS }
}

export function saveSettings(patch: Partial<Settings>): Settings {
  const next = { ...getSettings(), ...patch }
  try {
    localStorage.setItem(K_SETTINGS, JSON.stringify(next))
  } catch {
    /* yok say */
  }
  return next
}

export function getLastScan(): ScanResult | null {
  try {
    const raw = localStorage.getItem(K_LAST)
    return raw ? (JSON.parse(raw) as ScanResult) : null
  } catch {
    return null
  }
}

export function saveLastScan(r: ScanResult): void {
  try {
    localStorage.setItem(K_LAST, JSON.stringify(r))
  } catch {
    /* kota dolu olabilir; kritik degil */
  }
}

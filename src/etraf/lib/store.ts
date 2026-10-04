// Etrafimda ayarlari ve son tarama (yalnizca 'et-' onekli yerel anahtarlar).
import { DEFAULT_AI_MODEL, type AiModel } from './ai'
import { sameish } from './scan'
import type { Place, ScanResult, SortId } from './types'

const K_SETTINGS = 'et-settings'
const K_LAST = 'et-last-scan'

export type ViewMode = 'liste' | 'harita'

export interface Settings {
  googleKey: string
  claudeKey: string // istege bagli: yapay zeka hype yorumu
  aiModel: AiModel
  radiusM: number
  sort: SortId
  view: ViewMode
}

const DEFAULTS: Settings = {
  googleKey: '',
  claudeKey: '',
  aiModel: DEFAULT_AI_MODEL,
  radiusM: 1000,
  sort: 'mesafe',
  view: 'liste'
}

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

// KAYDEDILENLER (favoriler): yerin TAM kopyasi saklanir; boylece yeni bir
// taramada (ya da baska semtte) listede olmasa da kaybolmaz.
const K_FAVS = 'et-favs'

export interface Favorite {
  place: Place
  savedAt: number
}

export function getFavorites(): Favorite[] {
  try {
    const raw = localStorage.getItem(K_FAVS)
    return raw ? (JSON.parse(raw) as Favorite[]) : []
  } catch {
    return []
  }
}

function writeFavorites(list: Favorite[]): void {
  try {
    localStorage.setItem(K_FAVS, JSON.stringify(list))
  } catch {
    /* kota dolu olabilir */
  }
}

// Ayni yer mi? Kimlik tek basina yetmez: Google'li taramada kaydedilen yer
// (g:...) Google'siz taramada OpenStreetMap kimligiyle (osm:...) gelir.
// Bu yuzden ad + konum (90 m) benzerligine de bakilir.
export function matchesFavorite(f: Favorite, p: Place): boolean {
  return f.place.id === p.id || sameish(f.place, p)
}

// Kaydet / kaydi kaldir; guncel listeyi doner.
export function toggleFavorite(p: Place): Favorite[] {
  const list = getFavorites()
  const next = list.some((f) => matchesFavorite(f, p))
    ? list.filter((f) => !matchesFavorite(f, p))
    : [{ place: p, savedAt: Date.now() }, ...list]
  writeFavorites(next)
  return next
}

// Yeni taramada ayni yer tekrar gelirse kayitli kopyayi tazele (puan, acik mi...).
// Google bilgisi olan kayit, Google'siz (daha yoksul) bir kopyayla ezilmez.
export function refreshFavorites(places: Place[]): Favorite[] {
  const list = getFavorites()
  let changed = false
  const next = list.map((f) => {
    const fresh = places.find((p) => matchesFavorite(f, p))
    if (!fresh) return f
    if (f.place.rating != null && fresh.rating == null) return f
    changed = true
    return { ...f, place: fresh }
  })
  if (changed) writeFavorites(next)
  return next
}

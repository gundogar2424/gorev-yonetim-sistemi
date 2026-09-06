// Tum kayit localStorage'da (kucuk veri; veritabani gerekmez). Anahtarlar
// 'zn-' onekiyle baslar; diger programlarin verisine dokunulmaz.
import { GAMES, gameById } from './games'
import { dayNumber, todayKey } from './random'

export interface Settings {
  sound: boolean
  vibrate: boolean
  name: string // selamlamada kullanilir (istege bagli)
}

export interface Result {
  g: string // oyun id
  t: string // ISO zaman
  d: string // gun anahtari YYYY-MM-DD
  lv: number // oynanan seviye
  sc: number // 0-100 basari
  ok: boolean // seviye gecildi mi
  ms: number // sure (ms)
}

const K_SET = 'zn-settings'
const K_RES = 'zn-results'
const K_LVL = 'zn-levels'
const MAX_RESULTS = 3000

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* depolama dolu ya da kapali — sessizce gec */
  }
}

// ---- Ayarlar ----
export function readSettings(): Settings {
  const s = read<Partial<Settings>>(K_SET, {})
  return { sound: s.sound ?? true, vibrate: s.vibrate ?? true, name: s.name ?? '' }
}

export function saveSettings(patch: Partial<Settings>): Settings {
  const next = { ...readSettings(), ...patch }
  write(K_SET, next)
  return next
}

// ---- Seviye ----
export function getLevel(gameId: string): number {
  const m = read<Record<string, number>>(K_LVL, {})
  const max = gameById(gameId)?.maxLevel ?? 8
  return Math.min(max, Math.max(1, m[gameId] ?? 1))
}

export function setLevel(gameId: string, level: number): void {
  const m = read<Record<string, number>>(K_LVL, {})
  const max = gameById(gameId)?.maxLevel ?? 8
  m[gameId] = Math.min(max, Math.max(1, level))
  write(K_LVL, m)
}

// ---- Sonuclar ----
export function readResults(): Result[] {
  return read<Result[]>(K_RES, [])
}

export function addResult(r: Omit<Result, 't' | 'd'>): Result {
  const now = new Date()
  const full: Result = { ...r, t: now.toISOString(), d: todayKey(now) }
  const all = readResults()
  all.push(full)
  if (all.length > MAX_RESULTS) all.splice(0, all.length - MAX_RESULTS)
  write(K_RES, all)
  return full
}

export function resultsFor(gameId: string): Result[] {
  return readResults().filter((r) => r.g === gameId)
}

export function playedToday(gameId: string): boolean {
  const d = todayKey()
  return readResults().some((r) => r.g === gameId && r.d === d)
}

// ---- Gunluk plan: her gun 3 oyun; 8 oyun uzerinden donerek hepsi gelir ----
export function dailyPlan(date = new Date()): string[] {
  const n = GAMES.length
  const start = (dayNumber(date) * 3) % n
  return [0, 1, 2].map((k) => GAMES[(start + k) % n].id)
}

// ---- Seri (ust uste gun) ----
export function streakDays(): number {
  const days = new Set(readResults().map((r) => r.d))
  if (days.size === 0) return 0
  let count = 0
  const cur = new Date()
  // Bugun oynanmadiysa seri dunden sayilir (gun icinde kirilmis gorunmesin)
  if (!days.has(todayKey(cur))) cur.setDate(cur.getDate() - 1)
  while (days.has(todayKey(cur))) {
    count++
    cur.setDate(cur.getDate() - 1)
  }
  return count
}

// Son N gunun her biri icin oynanan oturum sayisi (eski -> yeni)
export function lastDaysActivity(n: number): { key: string; count: number; label: string }[] {
  const all = readResults()
  const out: { key: string; count: number; label: string }[] = []
  const gunler = ['Pz', 'Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct']
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = todayKey(d)
    out.push({ key, count: all.filter((r) => r.d === key).length, label: gunler[d.getDay()] })
  }
  return out
}

export function totalMinutes(results = readResults()): number {
  return Math.round(results.reduce((s, r) => s + r.ms, 0) / 60000)
}

// ---- Yedek ----
export interface Backup {
  app: 'zihin-jimnastigi'
  v: 1
  at: string
  settings: Settings
  levels: Record<string, number>
  results: Result[]
  theme?: string | null
  big?: string | null
}

export function makeBackup(): Backup {
  let theme: string | null = null
  let big: string | null = null
  try {
    theme = localStorage.getItem('zn-theme')
    big = localStorage.getItem('zn-big')
  } catch {
    /* yok say */
  }
  return {
    app: 'zihin-jimnastigi',
    v: 1,
    at: new Date().toISOString(),
    settings: readSettings(),
    levels: read<Record<string, number>>(K_LVL, {}),
    results: readResults(),
    theme,
    big
  }
}

export function downloadBackup(): void {
  const b = makeBackup()
  const blob = new Blob([JSON.stringify(b)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `zihin-jimnastigi-yedek-${todayKey()}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function restoreBackup(file: File): Promise<number> {
  const text = await file.text()
  let b: Backup
  try {
    b = JSON.parse(text) as Backup
  } catch {
    throw new Error('Dosya okunamadı. Zihin Jimnastiği yedeği (.json) seçin.')
  }
  if (!b || b.app !== 'zihin-jimnastigi' || !Array.isArray(b.results)) {
    throw new Error('Bu dosya bir Zihin Jimnastiği yedeği değil.')
  }
  // Birlestir: ayni zaman damgali kayit iki kez eklenmez
  const mevcut = readResults()
  const var_ = new Set(mevcut.map((r) => r.t + r.g))
  let eklendi = 0
  for (const r of b.results) {
    if (!r || typeof r.t !== 'string' || typeof r.g !== 'string') continue
    if (var_.has(r.t + r.g)) continue
    mevcut.push(r)
    eklendi++
  }
  mevcut.sort((a, c) => a.t.localeCompare(c.t))
  write(K_RES, mevcut.slice(-MAX_RESULTS))
  // Seviyeler: yuksek olan kalir
  const lv = read<Record<string, number>>(K_LVL, {})
  for (const [k, v] of Object.entries(b.levels ?? {})) lv[k] = Math.max(lv[k] ?? 1, Number(v) || 1)
  write(K_LVL, lv)
  if (b.settings) write(K_SET, { ...readSettings(), ...b.settings })
  try {
    if (b.theme) localStorage.setItem('zn-theme', b.theme)
    if (b.big) localStorage.setItem('zn-big', b.big)
  } catch {
    /* yok say */
  }
  return eklendi
}

export function wipeAll(): void {
  try {
    for (const k of [K_SET, K_RES, K_LVL]) localStorage.removeItem(k)
  } catch {
    /* yok say */
  }
}

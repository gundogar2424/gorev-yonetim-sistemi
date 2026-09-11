// Tum kayit localStorage'da (kucuk veri; veritabani gerekmez). Anahtarlar
// 'eft-' onekiyle baslar; diger programlarin verisine dokunulmaz.
import { todayKey } from './date'

export type Tempo = 'yavas' | 'orta' | 'hizli'

export interface Settings {
  name: string // selamlamada kullanilir (istege bagli)
  sound: boolean // her vurusta hafif tik sesi
  vibrate: boolean // her vurusta hafif titresim
  tempo: Tempo // vurus hizi
  taps: number // nokta basina vurus sayisi
  auto: boolean // noktalar kendiliginden ilerlesin mi
  voice: boolean // sesli rehber: cumleleri ve nokta adlarini okur
  voiceRate: 'yavas' | 'normal' // konusma hizi
}

export const TEMPO_MS: Record<Tempo, number> = { yavas: 850, orta: 620, hizli: 460 }

export interface Session {
  id: string
  t: string // ISO baslangic zamani
  d: string // gun anahtari YYYY-MM-DD
  issueId: string // hazir konu id'si, 'ozel' ya da 'yemek'
  issue: string // konu adi (ozel konuda kullanicinin yazdigi)
  before: number // 0-10 baslangic yogunlugu
  after: number // 0-10 bitis yogunlugu
  rounds: number // yapilan tur sayisi
  ms: number // toplam sure
  note?: string
}

const K_SET = 'eft-settings'
const K_SES = 'eft-sessions'
const K_CUSTOM = 'eft-custom'
const K_FOOD = 'eft-foods'
const MAX_SESSIONS = 2000

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
  return {
    name: s.name ?? '',
    sound: s.sound ?? true,
    vibrate: s.vibrate ?? true,
    tempo: s.tempo === 'yavas' || s.tempo === 'hizli' ? s.tempo : 'orta',
    taps: [5, 7, 9].includes(Number(s.taps)) ? Number(s.taps) : 7,
    auto: s.auto ?? true,
    voice: s.voice ?? true,
    voiceRate: s.voiceRate === 'yavas' ? 'yavas' : 'normal'
  }
}

export function saveSettings(patch: Partial<Settings>): Settings {
  const next = { ...readSettings(), ...patch }
  write(K_SET, next)
  return next
}

// ---- Ozel konular (son yazilanlar, hizli secim icin) ----
export function readCustomIssues(): string[] {
  return read<string[]>(K_CUSTOM, []).filter((s) => typeof s === 'string' && s.trim())
}

export function rememberCustomIssue(text: string): void {
  const x = text.trim()
  if (!x) return
  const list = [x, ...readCustomIssues().filter((s) => s.toLocaleLowerCase('tr') !== x.toLocaleLowerCase('tr'))]
  write(K_CUSTOM, list.slice(0, 6))
}

// ---- Son yemekler (yemek istegi modu, hizli secim icin) ----
export function readRecentFoods(): string[] {
  return read<string[]>(K_FOOD, []).filter((s) => typeof s === 'string' && s.trim())
}

export function rememberFood(text: string): void {
  const x = text.trim()
  if (!x) return
  const list = [x, ...readRecentFoods().filter((s) => s.toLocaleLowerCase('tr') !== x.toLocaleLowerCase('tr'))]
  write(K_FOOD, list.slice(0, 8))
}

// ---- Seanslar ----
export function readSessions(): Session[] {
  return read<Session[]>(K_SES, [])
}

export function addSession(s: Omit<Session, 'id' | 't' | 'd'>, startedAt = new Date()): Session {
  const full: Session = {
    ...s,
    id: `${startedAt.getTime().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    t: startedAt.toISOString(),
    d: todayKey(startedAt)
  }
  const all = readSessions()
  all.push(full)
  if (all.length > MAX_SESSIONS) all.splice(0, all.length - MAX_SESSIONS)
  write(K_SES, all)
  return full
}

export function updateSession(id: string, patch: Partial<Session>): void {
  const all = readSessions()
  const i = all.findIndex((s) => s.id === id)
  if (i < 0) return
  all[i] = { ...all[i], ...patch }
  write(K_SES, all)
}

export function deleteSession(id: string): void {
  write(
    K_SES,
    readSessions().filter((s) => s.id !== id)
  )
}

export function sessionsToday(): number {
  const d = todayKey()
  return readSessions().filter((s) => s.d === d).length
}

// ---- Seri (ust uste gun) ----
export function streakDays(): number {
  const days = new Set(readSessions().map((s) => s.d))
  if (days.size === 0) return 0
  let count = 0
  const cur = new Date()
  // Bugun yapilmadiysa seri dunden sayilir (gun icinde kirilmis gorunmesin)
  if (!days.has(todayKey(cur))) cur.setDate(cur.getDate() - 1)
  while (days.has(todayKey(cur))) {
    count++
    cur.setDate(cur.getDate() - 1)
  }
  return count
}

// Son N gunun her biri icin seans sayisi (eski -> yeni)
export function lastDaysActivity(n: number): { key: string; count: number; label: string }[] {
  const all = readSessions()
  const out: { key: string; count: number; label: string }[] = []
  const gunler = ['Pz', 'Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct']
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = todayKey(d)
    out.push({ key, count: all.filter((s) => s.d === key).length, label: gunler[d.getDay()] })
  }
  return out
}

export interface Stats {
  count: number
  minutes: number
  avgDrop: number // ortalama puan dususu (before - after)
  avgDropPct: number // yuzde olarak (before>0 olanlar)
}

export function stats(list = readSessions()): Stats {
  if (list.length === 0) return { count: 0, minutes: 0, avgDrop: 0, avgDropPct: 0 }
  const minutes = Math.round(list.reduce((s, r) => s + r.ms, 0) / 60000)
  const drops = list.map((r) => r.before - r.after)
  const avgDrop = drops.reduce((a, b) => a + b, 0) / list.length
  const pctList = list.filter((r) => r.before > 0).map((r) => ((r.before - r.after) / r.before) * 100)
  const avgDropPct = pctList.length ? pctList.reduce((a, b) => a + b, 0) / pctList.length : 0
  return { count: list.length, minutes, avgDrop, avgDropPct }
}

// Konuya gore ozet (en cok calisilanlar)
export function byIssue(list = readSessions()): { issueId: string; issue: string; count: number; avgDrop: number }[] {
  const m = new Map<string, { issueId: string; issue: string; count: number; drop: number }>()
  for (const s of list) {
    const key = s.issueId === 'ozel' || s.issueId === 'yemek' ? `${s.issueId}:${s.issue.toLocaleLowerCase('tr')}` : s.issueId
    const cur = m.get(key) ?? { issueId: s.issueId, issue: s.issue, count: 0, drop: 0 }
    cur.count++
    cur.drop += s.before - s.after
    m.set(key, cur)
  }
  return [...m.values()]
    .map((v) => ({ issueId: v.issueId, issue: v.issue, count: v.count, avgDrop: v.drop / v.count }))
    .sort((a, b) => b.count - a.count)
}

// ---- Yedek ----
export interface Backup {
  app: 'eft-dokunma'
  v: 1
  at: string
  settings: Settings
  sessions: Session[]
  custom: string[]
  foods?: string[]
  theme?: string | null
  big?: string | null
}

export function makeBackup(): Backup {
  let theme: string | null = null
  let big: string | null = null
  try {
    theme = localStorage.getItem('eft-theme')
    big = localStorage.getItem('eft-big')
  } catch {
    /* yok say */
  }
  return {
    app: 'eft-dokunma',
    v: 1,
    at: new Date().toISOString(),
    settings: readSettings(),
    sessions: readSessions(),
    custom: readCustomIssues(),
    foods: readRecentFoods(),
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
  a.download = `eft-dokunma-yedek-${todayKey()}.json`
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
    throw new Error('Dosya okunamadı. EFT Dokunma yedeği (.json) seçin.')
  }
  if (!b || b.app !== 'eft-dokunma' || !Array.isArray(b.sessions)) {
    throw new Error('Bu dosya bir EFT Dokunma yedeği değil.')
  }
  // Birlestir: ayni id'li kayit iki kez eklenmez
  const mevcut = readSessions()
  const var_ = new Set(mevcut.map((s) => s.id))
  let eklendi = 0
  for (const s of b.sessions) {
    if (!s || typeof s.id !== 'string' || typeof s.t !== 'string') continue
    if (var_.has(s.id)) continue
    mevcut.push(s)
    eklendi++
  }
  mevcut.sort((a, c) => a.t.localeCompare(c.t))
  write(K_SES, mevcut.slice(-MAX_SESSIONS))
  if (b.settings) write(K_SET, { ...readSettings(), ...b.settings })
  if (Array.isArray(b.custom)) for (const c of [...b.custom].reverse()) rememberCustomIssue(String(c))
  if (Array.isArray(b.foods)) for (const f of [...b.foods].reverse()) rememberFood(String(f))
  try {
    if (b.theme) localStorage.setItem('eft-theme', b.theme)
    if (b.big) localStorage.setItem('eft-big', b.big)
  } catch {
    /* yok say */
  }
  return eklendi
}

export function wipeAll(): void {
  try {
    for (const k of [K_SET, K_SES, K_CUSTOM, K_FOOD]) localStorage.removeItem(k)
  } catch {
    /* yok say */
  }
}

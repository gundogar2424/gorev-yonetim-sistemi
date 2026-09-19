// Tum kayit localStorage'da (kucuk veri; veritabani gerekmez). Anahtarlar
// 'ses-' onekiyle baslar; diger programlarin verisine dokunulmaz.
import { todayKey } from './date'
import { EXERCISES } from './content'
import { DEFAULT_DISABLED_D, DEXERCISES, DTEMPO_MULT, type DTempo } from './diksiyon'

export type Level = 'hafif' | 'orta' | 'yogun'
export const LEVEL_MULT: Record<Level, number> = { hafif: 0.6, orta: 1, yogun: 1.4 }
export const LEVEL_LABEL: Record<Level, string> = { hafif: 'Hafif', orta: 'Orta', yogun: 'Yoğun' }

export interface Reminder {
  id: number // 1..3
  time: string // "HH:MM"
  enabled: boolean
}

export interface Settings {
  name: string
  sound: boolean
  vibrate: boolean
  level: Level // tekrar sayisi carpani
  countdown: boolean // her tekrardan once 3-2-1 geri sayim
  disabled: string[] // kapali egzersiz id'leri
  reminders: Reminder[]
  accepted: boolean // uyari metni onaylandi mi
  dDisabled: string[] // kapali DIKSIYON egzersizleri
  dTempo: DTempo // diksiyon okuma temposu
  score: boolean // diksiyonda konusma tanima ile puanlama acik mi
  apiKey: string // Claude API anahtari (yapay zeka geri bildirimi; yalnizca cihazda)
}

export type SessionKind = 'ses' | 'diksiyon'

export interface DoneExercise {
  id: string
  reps: number // yapilan tekrar/set
  mpt?: number // uzun-a egzersizinde en iyi sure (sn)
  rating?: number // oz degerlendirme 1-5 (ne kadar net/rahat oldu)
  acc?: number // konusma tanima dogrulugu % (diksiyon; satirlarin ortalamasi)
  wpm?: number // dakikadaki sozcuk (diksiyon; ortalama)
  lines?: LineScore[] // satir satir sonuc (yapay zeka geri bildirimi icin)
}

export interface LineScore {
  target: string
  heard: string
  acc: number
  wpm: number
  missed: string[] // yutulan/yanlis sozcukler
}

export interface Session {
  id: string
  t: string // ISO baslangic
  d: string // gun anahtari
  ms: number // toplam sure
  done: DoneExercise[]
  note?: string
  kind?: SessionKind // yok = 'ses' (adduksiyon)
  rating?: number // seans geneli oz degerlendirme 1-5
  feedback?: string // yapay zeka geri bildirimi (metin)
}

export function sessionKind(s: Session): SessionKind {
  return s.kind === 'diksiyon' ? 'diksiyon' : 'ses'
}

export interface MptRecord {
  id: string
  t: string
  d: string
  sec: number // saniye (en iyi deneme)
  db?: number // ortalama ses duzeyi (goreli dB)
  manual: boolean // elle kronometre mi (mikrofon degil)
}

const K_SET = 'ses-settings'
const K_SES = 'ses-sessions'
const K_MPT = 'ses-mpt'
const MAX = 2000

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

function newId(at = new Date()): string {
  return `${at.getTime().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

// ---- Ayarlar ----
export function defaultReminders(): Reminder[] {
  return [
    { id: 1, time: '09:00', enabled: false },
    { id: 2, time: '14:00', enabled: false },
    { id: 3, time: '20:00', enabled: false }
  ]
}

export function readSettings(): Settings {
  const s = read<Partial<Settings>>(K_SET, {})
  const rem = defaultReminders().map((d) => {
    const saved = Array.isArray(s.reminders) ? s.reminders.find((r) => r && r.id === d.id) : undefined
    return saved && /^\d{2}:\d{2}$/.test(String(saved.time)) ? { id: d.id, time: saved.time, enabled: !!saved.enabled } : d
  })
  return {
    name: s.name ?? '',
    sound: s.sound ?? true,
    vibrate: s.vibrate ?? true,
    level: s.level === 'hafif' || s.level === 'yogun' ? s.level : 'orta',
    countdown: s.countdown ?? true,
    disabled: Array.isArray(s.disabled) ? s.disabled.filter((x) => typeof x === 'string') : [],
    reminders: rem,
    accepted: s.accepted ?? false,
    dDisabled: Array.isArray(s.dDisabled) ? s.dDisabled.filter((x) => typeof x === 'string') : [...DEFAULT_DISABLED_D],
    dTempo: s.dTempo === 'yavas' || s.dTempo === 'hizli' ? s.dTempo : 'orta',
    score: s.score ?? true,
    apiKey: typeof s.apiKey === 'string' ? s.apiKey : ''
  }
}

// Seans icindeki puanlarin ozeti (ilerleme grafikleri icin)
export function sessionAccuracy(s: Session): number | null {
  const v = s.done.map((d) => d.acc).filter((x): x is number => typeof x === 'number')
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null
}

export function sessionRating(s: Session): number | null {
  if (typeof s.rating === 'number') return s.rating
  const v = s.done.map((d) => d.rating).filter((x): x is number => typeof x === 'number')
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null
}

export function saveSettings(patch: Partial<Settings>): Settings {
  const next = { ...readSettings(), ...patch }
  write(K_SET, next)
  return next
}

// Seansta yapilacak egzersizler (kapali olanlar disinda, icerik sirasiyla)
export function activeExercises(s = readSettings()) {
  return EXERCISES.filter((e) => !s.disabled.includes(e.id))
}

export function repsFor(base: number, s = readSettings()): number {
  return Math.max(1, Math.round(base * LEVEL_MULT[s.level]))
}

// Tahmini seans suresi (dakika)
export function estimateMinutes(s = readSettings()): number {
  let sec = 0
  for (const e of activeExercises(s)) {
    const n = repsFor(e.reps, s)
    if (e.mode === 'mpt') sec += n * (15 + e.rest) + 10
    else sec += n * (e.hold + e.rest) + 8
  }
  return Math.max(1, Math.round(sec / 60))
}

// Diksiyon seansinda yapilacak egzersizler
export function activeDExercises(s = readSettings()) {
  return DEXERCISES.filter((e) => !s.dDisabled.includes(e.id))
}

export function dSecFor(base: number, s = readSettings()): number {
  return Math.max(2, Math.round(base * DTEMPO_MULT[s.dTempo]))
}

// Tahmini diksiyon seansi suresi (dakika)
export function estimateDMinutes(s = readSettings()): number {
  let sec = 0
  for (const e of activeDExercises(s)) sec += e.reps * (dSecFor(e.sec, s) + 2) + 6
  return Math.max(1, Math.round(sec / 60))
}

// ---- Seanslar ----
export function readSessions(): Session[] {
  return read<Session[]>(K_SES, [])
}

export function addSession(s: Omit<Session, 'id' | 't' | 'd'>, startedAt = new Date()): Session {
  const full: Session = { ...s, id: newId(startedAt), t: startedAt.toISOString(), d: todayKey(startedAt) }
  const all = readSessions()
  all.push(full)
  if (all.length > MAX) all.splice(0, all.length - MAX)
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

export function sessionsToday(kind?: SessionKind): number {
  const d = todayKey()
  return readSessions().filter((s) => s.d === d && (!kind || sessionKind(s) === kind)).length
}

// ---- MPT olcumleri ----
export function readMpt(): MptRecord[] {
  return read<MptRecord[]>(K_MPT, [])
}

export function addMpt(r: Omit<MptRecord, 'id' | 't' | 'd'>, at = new Date()): MptRecord {
  const full: MptRecord = { ...r, id: newId(at), t: at.toISOString(), d: todayKey(at) }
  const all = readMpt()
  all.push(full)
  if (all.length > MAX) all.splice(0, all.length - MAX)
  write(K_MPT, all)
  return full
}

export function deleteMpt(id: string): void {
  write(
    K_MPT,
    readMpt().filter((s) => s.id !== id)
  )
}

export function bestMpt(): number {
  return readMpt().reduce((m, r) => Math.max(m, r.sec), 0)
}

// ---- Seri (ust uste gun) ----
export function streakDays(): number {
  const days = new Set(readSessions().map((s) => s.d))
  if (days.size === 0) return 0
  let count = 0
  const cur = new Date()
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
  days: number
}

export function stats(list = readSessions()): Stats {
  if (list.length === 0) return { count: 0, minutes: 0, days: 0 }
  return {
    count: list.length,
    minutes: Math.round(list.reduce((s, r) => s + r.ms, 0) / 60000),
    days: new Set(list.map((s) => s.d)).size
  }
}

// ---- Yedek ----
export interface Backup {
  app: 'ses-egzersizi'
  v: 1
  at: string
  settings: Settings
  sessions: Session[]
  mpt: MptRecord[]
  theme?: string | null
  big?: string | null
}

export function makeBackup(): Backup {
  let theme: string | null = null
  let big: string | null = null
  try {
    theme = localStorage.getItem('ses-theme')
    big = localStorage.getItem('ses-big')
  } catch {
    /* yok say */
  }
  // API anahtari yedege YAZILMAZ (dosya paylasilirsa sizmasin)
  return { app: 'ses-egzersizi', v: 1, at: new Date().toISOString(), settings: { ...readSettings(), apiKey: '' }, sessions: readSessions(), mpt: readMpt(), theme, big }
}

export function downloadBackup(): void {
  const b = makeBackup()
  const blob = new Blob([JSON.stringify(b)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ses-egzersizi-yedek-${todayKey()}.json`
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
    throw new Error('Dosya okunamadı. Ses Egzersizi yedeği (.json) seçin.')
  }
  if (!b || b.app !== 'ses-egzersizi' || !Array.isArray(b.sessions)) {
    throw new Error('Bu dosya bir Ses Egzersizi yedeği değil.')
  }
  let eklendi = 0
  const ses = readSessions()
  const varS = new Set(ses.map((s) => s.id))
  for (const s of b.sessions) {
    if (!s || typeof s.id !== 'string' || typeof s.t !== 'string' || varS.has(s.id)) continue
    ses.push(s)
    eklendi++
  }
  ses.sort((a, c) => a.t.localeCompare(c.t))
  write(K_SES, ses.slice(-MAX))

  if (Array.isArray(b.mpt)) {
    const m = readMpt()
    const varM = new Set(m.map((s) => s.id))
    for (const r of b.mpt) {
      if (!r || typeof r.id !== 'string' || typeof r.sec !== 'number' || varM.has(r.id)) continue
      m.push(r)
      eklendi++
    }
    m.sort((a, c) => a.t.localeCompare(c.t))
    write(K_MPT, m.slice(-MAX))
  }
  if (b.settings) write(K_SET, { ...readSettings(), ...b.settings, apiKey: readSettings().apiKey })
  try {
    if (b.theme) localStorage.setItem('ses-theme', b.theme)
    if (b.big) localStorage.setItem('ses-big', b.big)
  } catch {
    /* yok say */
  }
  return eklendi
}

export function wipeAll(): void {
  try {
    for (const k of [K_SET, K_SES, K_MPT]) localStorage.removeItem(k)
  } catch {
    /* yok say */
  }
}

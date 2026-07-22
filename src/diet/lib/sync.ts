// CIHAZLAR ARASI OTOMATIK SENKRON — sunucusuz, kullanicinin KENDI GitHub hesabi
// uzerinden. Veri, kullanicinin hesabindaki OZEL (gizli) bir gist'te tek JSON
// olarak tutulur. Akis: cek (pull) -> birlestir (merge) -> gonder (push).
// Boylece telefon ve web ayni veriyi gorur; iki taraf da birbirini gunceller.
//
// Birlestirme kurallari:
// - Kayit tablolari (ogun/olcum/tansiyon/ilac-kaydi...): createdAt anahtar —
//   karsida olup bende olmayan kayit EKLENIR (silme senkronlanmaz).
// - Gunluk sayaclar (su/adim/uyku): ayni gunde BUYUK olan kazanir (gun boyu artar).
// - Gun notu: ayni gunde YENI yazilan kazanir.
// - Ilac tanimlari + Ayarlar: updatedAt YENI olan kazanir.
// - FOTOGRAFLAR senkrona dahil DEGILDIR (boyut) — her cihazda yerel kalir.
import { dietDb } from '../db'
import type { DietSettings, MedDef } from '../types'

const GIST_DESC = 'diyet-kocu-sync'
const GIST_FILE = 'diyet-sync.json'
const API = 'https://api.github.com'

interface SyncSnapshot {
  app: 'diet-coach-sync'
  version: number
  savedAt: number
  tables: Record<string, Record<string, unknown>[]>
  settings: Partial<DietSettings> | null
}

// Union-by-createdAt tablolar (eksik olan eklenir)
const UNION_TABLES = ['entries', 'measurements', 'vitals', 'exercises', 'checkins', 'cravings', 'labs', 'medlogs', 'shopping', 'products'] as const
// Gunluk sayac tablolar: dateStr anahtar, "buyuk olan kazanir" alani
const DAY_TABLES: { name: string; field: string }[] = [
  { name: 'water', field: 'ml' },
  { name: 'steps', field: 'count' },
  { name: 'sleep', field: 'hours' }
]

function headers(token: string) {
  return {
    Authorization: `Bearer ${token.trim()}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json'
  }
}

// Kullanicinin gist'leri icinde senkron gist'ini bul; yoksa OZEL olarak olustur
async function resolveGistId(token: string, saved?: string): Promise<string> {
  if (saved) return saved
  const res = await fetch(`${API}/gists?per_page=100`, { headers: headers(token) })
  if (res.status === 401) throw new Error('GitHub anahtarı geçersiz. Ayarlardaki senkron anahtarını kontrol et.')
  if (!res.ok) throw new Error(`GitHub'a ulaşılamadı (${res.status}).`)
  const list = (await res.json()) as { id: string; description?: string }[]
  const found = list.find((g) => g.description === GIST_DESC)
  if (found) return found.id
  // Olustur (private gist)
  const create = await fetch(`${API}/gists`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({
      description: GIST_DESC,
      public: false,
      files: { [GIST_FILE]: { content: JSON.stringify({ app: 'diet-coach-sync', version: 1, savedAt: 0, tables: {}, settings: null }) } }
    })
  })
  if (!create.ok) throw new Error(`Senkron alanı oluşturulamadı (${create.status}). Anahtarda 'gist' yetkisi olmalı.`)
  const g = (await create.json()) as { id: string }
  return g.id
}

// Uzaktaki anlik goruntuyu indir (1 MB ustu kesilirse raw_url'den tam halini cek)
async function pullSnapshot(token: string, gistId: string): Promise<SyncSnapshot | null> {
  const res = await fetch(`${API}/gists/${gistId}`, { headers: headers(token) })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Senkron verisi okunamadı (${res.status}).`)
  const g = (await res.json()) as { files: Record<string, { content?: string; truncated?: boolean; raw_url?: string }> }
  const f = g.files?.[GIST_FILE]
  if (!f) return null
  let text = f.content ?? ''
  if (f.truncated && f.raw_url) {
    const raw = await fetch(f.raw_url)
    if (raw.ok) text = await raw.text()
  }
  try {
    const j = JSON.parse(text) as SyncSnapshot
    return j?.app === 'diet-coach-sync' ? j : null
  } catch {
    return null
  }
}

// Yerel veriden anlik goruntu olustur (fotograflar HARIC)
export async function buildSnapshot(): Promise<SyncSnapshot> {
  const tables: SyncSnapshot['tables'] = {}
  for (const t of UNION_TABLES) tables[t] = (await dietDb.table(t).toArray()) as Record<string, unknown>[]
  for (const d of DAY_TABLES) tables[d.name] = (await dietDb.table(d.name).toArray()) as Record<string, unknown>[]
  tables.daynotes = (await dietDb.daynotes.toArray()) as unknown as Record<string, unknown>[]
  tables.meds = (await dietDb.meds.toArray()) as unknown as Record<string, unknown>[]
  // Fotograflari cikar (boyut) — kayit kalir, foto alani bos gider
  tables.entries = tables.entries.map((e) => ({ ...e, photo: '' }))
  const settingsRow = await dietDb.settings.toCollection().first()
  const settings = settingsRow ? { ...settingsRow } : null
  if (settings) {
    delete (settings as { id?: number }).id
    // Senkron kimlikleri cihaza ozeldir; karsi tarafa dayatma
    delete settings.syncToken
    delete settings.syncGistId
    delete settings.lastSyncAt
  }
  return { app: 'diet-coach-sync', version: 1, savedAt: Date.now(), tables, settings }
}

// Uzak anlik goruntuyu YEREL veriye birlestir. Eklenen kayit sayisini dondurur.
export async function mergeSnapshot(remote: SyncSnapshot): Promise<number> {
  let added = 0
  const strip = (r: Record<string, unknown>) => {
    const { id: _id, ...rest } = r
    return rest
  }
  // 1) Union tablolar: createdAt bende yoksa ekle
  for (const t of UNION_TABLES) {
    const rem = remote.tables?.[t]
    if (!rem?.length) continue
    const loc = (await dietDb.table(t).toArray()) as { createdAt?: number }[]
    const have = new Set(loc.map((r) => r.createdAt))
    const fresh = rem.filter((r) => typeof r.createdAt === 'number' && !have.has(r.createdAt as number))
    if (fresh.length) {
      await dietDb.table(t).bulkAdd(fresh.map(strip))
      added += fresh.length
    }
  }
  // 2) Gunluk sayaclar: ayni gunde buyuk deger kazanir
  for (const d of DAY_TABLES) {
    const rem = remote.tables?.[d.name]
    if (!rem?.length) continue
    const loc = (await dietDb.table(d.name).toArray()) as ({ id?: number; dateStr?: string } & Record<string, unknown>)[]
    const byDay = new Map(loc.map((r) => [r.dateStr, r]))
    for (const r of rem) {
      const day = r.dateStr as string | undefined
      if (!day) continue
      const cur = byDay.get(day)
      if (!cur) {
        await dietDb.table(d.name).add(strip(r))
        added++
      } else {
        const rv = Number(r[d.field] ?? 0)
        const lv = Number(cur[d.field] ?? 0)
        if (rv > lv && cur.id != null) {
          await dietDb.table(d.name).update(cur.id, strip(r))
          added++
        }
      }
    }
  }
  // 3) Gun notlari: ayni gunde yeni yazilan kazanir
  {
    const rem = remote.tables?.daynotes
    if (rem?.length) {
      const loc = await dietDb.daynotes.toArray()
      const byDay = new Map(loc.map((r) => [r.dateStr, r]))
      for (const r of rem) {
        const day = r.dateStr as string | undefined
        if (!day) continue
        const cur = byDay.get(day)
        if (!cur) {
          await dietDb.daynotes.add(strip(r) as never)
          added++
        } else if (Number(r.createdAt ?? 0) > (cur.createdAt ?? 0) && cur.id != null) {
          await dietDb.daynotes.update(cur.id, strip(r) as never)
          added++
        }
      }
    }
  }
  // 4) Ilac tanimlari: createdAt esle; updatedAt yeni olan kazanir
  {
    const rem = remote.tables?.meds as unknown as MedDef[] | undefined
    if (rem?.length) {
      const loc = await dietDb.meds.toArray()
      const byCreated = new Map(loc.map((m) => [m.createdAt, m]))
      for (const r of rem) {
        const cur = byCreated.get(r.createdAt)
        if (!cur) {
          await dietDb.meds.add(strip(r as unknown as Record<string, unknown>) as unknown as MedDef)
          added++
        } else if ((r.updatedAt ?? r.createdAt) > (cur.updatedAt ?? cur.createdAt) && cur.id != null) {
          await dietDb.meds.update(cur.id, strip(r as unknown as Record<string, unknown>) as Partial<MedDef>)
          added++
        }
      }
    }
  }
  // 5) Ayarlar: updatedAt yeni olan kazanir (senkron kimliklerine dokunma)
  if (remote.settings) {
    const cur = await dietDb.settings.toCollection().first()
    if ((remote.settings.updatedAt ?? 0) > (cur?.updatedAt ?? 0)) {
      const patch = { ...remote.settings }
      delete patch.syncToken
      delete patch.syncGistId
      delete patch.lastSyncAt
      if (cur?.id != null) await dietDb.settings.update(cur.id, patch)
      else await dietDb.settings.add(patch as DietSettings)
      added++
    }
  }
  return added
}

// SENKRONU CALISTIR: cek -> birlestir -> gonder. Eklenen kayit sayisini dondurur.
export async function syncNow(): Promise<{ added: number }> {
  const settings = await dietDb.settings.toCollection().first()
  const token = settings?.syncToken?.trim()
  if (!token) throw new Error('Önce Ayarlar → Senkron bölümüne GitHub anahtarını gir.')
  const gistId = await resolveGistId(token, settings?.syncGistId)
  const remote = await pullSnapshot(token, gistId)
  const added = remote ? await mergeSnapshot(remote) : 0
  const snapshot = await buildSnapshot()
  const push = await fetch(`${API}/gists/${gistId}`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify({ files: { [GIST_FILE]: { content: JSON.stringify(snapshot) } } })
  })
  if (!push.ok) throw new Error(`Senkron gönderilemedi (${push.status}).`)
  // Senkron kimliklerini updatedAt'i BOZMADAN yaz (ayarlar ping-pong'u olmasin)
  const cur = await dietDb.settings.toCollection().first()
  if (cur?.id != null) await dietDb.settings.update(cur.id, { syncGistId: gistId, lastSyncAt: Date.now() })
  else await dietDb.settings.add({ model: 'claude-opus-4-8', syncGistId: gistId, lastSyncAt: Date.now() })
  return { added }
}


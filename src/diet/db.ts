// Diyet Kocu icin AYRI bir Dexie (IndexedDB) veritabani.
// CRM veritabanina hic dokunmaz; semasi ve surumu bagimsizdir.
import Dexie, { type Table } from 'dexie'
import type { DietEntry, DietSettings } from './types'

export class DietCoachDB extends Dexie {
  entries!: Table<DietEntry, number>
  settings!: Table<DietSettings, number>

  constructor() {
    super('diet-coach')
    this.version(1).stores({
      // Tarihe ve karara gore sorgulanabilir alanlar indexlenir
      entries: '++id, createdAt, dateStr, decision',
      settings: '++id'
    })
  }
}

export const dietDb = new DietCoachDB()

// Ayarlari OKU (SALT OKUNUR — hicbir yazma yapmaz).
// useLiveQuery icinde cagrildigi icin burada DB'ye yazmak yasak
// (Dexie "Readwrite transaction in liveQuery context" hatasi verir).
// Kayit yoksa, DB'ye dokunmadan bellekte varsayilan bir nesne dondurur.
export async function readDietSettings(): Promise<DietSettings> {
  const s = await dietDb.settings.toCollection().first()
  return s ?? { model: 'claude-opus-4-8' }
}

// Ayarlari guncelle (yazma baglami — kayit yoksa olusturur, varsa gunceller)
export async function saveDietSettings(patch: Partial<DietSettings>) {
  const s = await dietDb.settings.toCollection().first()
  if (s?.id != null) {
    await dietDb.settings.update(s.id, patch)
  } else {
    await dietDb.settings.add({ model: 'claude-opus-4-8', ...patch })
  }
}

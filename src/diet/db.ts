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

// Ayarlari getir (yoksa olustur)
export async function getDietSettings(): Promise<DietSettings> {
  const s = await dietDb.settings.toCollection().first()
  if (s) return s
  const id = await dietDb.settings.add({ model: 'claude-opus-4-8' })
  return { id, model: 'claude-opus-4-8' }
}

// Ayarlari guncelle
export async function saveDietSettings(patch: Partial<DietSettings>) {
  const s = await getDietSettings()
  await dietDb.settings.update(s.id!, patch)
}

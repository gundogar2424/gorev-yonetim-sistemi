// Diyet Kocu icin AYRI bir Dexie (IndexedDB) veritabani.
// CRM veritabanina hic dokunmaz; semasi ve surumu bagimsizdir.
import Dexie, { type Table } from 'dexie'
import type { DietEntry, DietSettings, Measurement, Vital, Lab, ShoppingItem } from './types'

export class DietCoachDB extends Dexie {
  entries!: Table<DietEntry, number>
  settings!: Table<DietSettings, number>
  measurements!: Table<Measurement, number>
  vitals!: Table<Vital, number>
  labs!: Table<Lab, number>
  shopping!: Table<ShoppingItem, number>

  constructor() {
    super('diet-coach')
    this.version(1).stores({
      // Tarihe ve karara gore sorgulanabilir alanlar indexlenir
      entries: '++id, createdAt, dateStr, decision',
      settings: '++id'
    })
    // Surum 2: olcu takibi + saglik (seker/tansiyon) tablolari
    this.version(2).stores({
      entries: '++id, createdAt, dateStr, decision',
      settings: '++id',
      measurements: '++id, dateStr, createdAt',
      vitals: '++id, dateStr, createdAt, kind'
    })
    // Surum 3: tahliller + alisveris listesi
    this.version(3).stores({
      entries: '++id, createdAt, dateStr, decision',
      settings: '++id',
      measurements: '++id, dateStr, createdAt',
      vitals: '++id, dateStr, createdAt, kind',
      labs: '++id, dateStr, createdAt',
      shopping: '++id, createdAt, done'
    })
  }
}

export const dietDb = new DietCoachDB()

// ---- Vucut olculeri (SALT OKUNUR sorgular; yazma ayri fonksiyonlarda) ----
export function listMeasurements(): Promise<Measurement[]> {
  return dietDb.measurements.orderBy('createdAt').toArray()
}
export async function addMeasurement(m: Omit<Measurement, 'id' | 'createdAt'>) {
  await dietDb.measurements.add({ ...m, createdAt: Date.now() })
}
export async function deleteMeasurement(id: number) {
  await dietDb.measurements.delete(id)
}

// ---- Seker / tansiyon olcumleri ----
export function listVitals(): Promise<Vital[]> {
  return dietDb.vitals.orderBy('createdAt').toArray()
}
export async function addVital(v: Omit<Vital, 'id' | 'createdAt'>) {
  await dietDb.vitals.add({ ...v, createdAt: Date.now() })
}
export async function deleteVital(id: number) {
  await dietDb.vitals.delete(id)
}

// ---- Tahliller ----
export function listLabs(): Promise<Lab[]> {
  return dietDb.labs.orderBy('createdAt').reverse().toArray()
}
export async function addLab(l: Omit<Lab, 'id' | 'createdAt'>): Promise<number> {
  return dietDb.labs.add({ ...l, createdAt: Date.now() })
}
export async function updateLab(id: number, patch: Partial<Lab>) {
  await dietDb.labs.update(id, patch)
}
export async function deleteLab(id: number) {
  await dietDb.labs.delete(id)
}

// ---- Alisveris listesi ----
export function listShopping(): Promise<ShoppingItem[]> {
  return dietDb.shopping.orderBy('createdAt').toArray()
}
export async function addShopping(text: string) {
  await dietDb.shopping.add({ text, done: false, createdAt: Date.now() })
}
export async function toggleShopping(id: number, done: boolean) {
  await dietDb.shopping.update(id, { done })
}
export async function deleteShopping(id: number) {
  await dietDb.shopping.delete(id)
}
export async function clearDoneShopping() {
  const done = await dietDb.shopping.filter((s) => s.done).toArray()
  await dietDb.shopping.bulkDelete(done.map((s) => s.id!))
}

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

// Diyet Kocu icin AYRI bir Dexie (IndexedDB) veritabani.
// CRM veritabanina hic dokunmaz; semasi ve surumu bagimsizdir.
import Dexie, { type Table } from 'dexie'
import type {
  DietEntry,
  DietSettings,
  Measurement,
  Vital,
  Lab,
  ShoppingItem,
  Exercise,
  Water,
  Steps,
  Sleep,
  ProgressPhoto,
  SavedProduct
} from './types'

export class DietCoachDB extends Dexie {
  entries!: Table<DietEntry, number>
  settings!: Table<DietSettings, number>
  measurements!: Table<Measurement, number>
  vitals!: Table<Vital, number>
  labs!: Table<Lab, number>
  shopping!: Table<ShoppingItem, number>
  exercises!: Table<Exercise, number>
  water!: Table<Water, number>
  steps!: Table<Steps, number>
  sleep!: Table<Sleep, number>
  progress!: Table<ProgressPhoto, number>
  products!: Table<SavedProduct, number>

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
    // Surum 4: egzersiz kayitlari (+puan)
    this.version(4).stores({
      entries: '++id, createdAt, dateStr, decision',
      settings: '++id',
      measurements: '++id, dateStr, createdAt',
      vitals: '++id, dateStr, createdAt, kind',
      labs: '++id, dateStr, createdAt',
      shopping: '++id, createdAt, done',
      exercises: '++id, dateStr, createdAt'
    })
    // Surum 5: gunluk su takibi
    this.version(5).stores({
      entries: '++id, createdAt, dateStr, decision',
      settings: '++id',
      measurements: '++id, dateStr, createdAt',
      vitals: '++id, dateStr, createdAt, kind',
      labs: '++id, dateStr, createdAt',
      shopping: '++id, createdAt, done',
      exercises: '++id, dateStr, createdAt',
      water: '++id, dateStr'
    })
    // Surum 6: gunluk adim takibi
    this.version(6).stores({
      entries: '++id, createdAt, dateStr, decision',
      settings: '++id',
      measurements: '++id, dateStr, createdAt',
      vitals: '++id, dateStr, createdAt, kind',
      labs: '++id, dateStr, createdAt',
      shopping: '++id, createdAt, done',
      exercises: '++id, dateStr, createdAt',
      water: '++id, dateStr',
      steps: '++id, dateStr'
    })
    // Surum 7: uyku takibi + ilerleme fotograflari
    this.version(7).stores({
      entries: '++id, createdAt, dateStr, decision',
      settings: '++id',
      measurements: '++id, dateStr, createdAt',
      vitals: '++id, dateStr, createdAt, kind',
      labs: '++id, dateStr, createdAt',
      shopping: '++id, createdAt, done',
      exercises: '++id, dateStr, createdAt',
      water: '++id, dateStr',
      steps: '++id, dateStr',
      sleep: '++id, dateStr',
      progress: '++id, dateStr, createdAt'
    })
    // Surum 8: elle girilen urun hafizasi (barkod -> besin)
    this.version(8).stores({
      entries: '++id, createdAt, dateStr, decision',
      settings: '++id',
      measurements: '++id, dateStr, createdAt',
      vitals: '++id, dateStr, createdAt, kind',
      labs: '++id, dateStr, createdAt',
      shopping: '++id, createdAt, done',
      exercises: '++id, dateStr, createdAt',
      water: '++id, dateStr',
      steps: '++id, dateStr',
      sleep: '++id, dateStr',
      progress: '++id, dateStr, createdAt',
      products: '++id, barcode'
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

// ---- Egzersiz kayitlari (SALT OKUNUR sorgu; +puan kazandirir) ----
export function listExercises(): Promise<Exercise[]> {
  return dietDb.exercises.orderBy('createdAt').reverse().toArray()
}
export async function addExercise(text: string, minutes?: number, kcal?: number) {
  await dietDb.exercises.add({
    text,
    minutes,
    kcal,
    createdAt: Date.now(),
    dateStr: new Date().toLocaleDateString('en-CA')
  })
}
export async function deleteExercise(id: number) {
  await dietDb.exercises.delete(id)
}

// ---- Gunluk su takibi ----
// Bir gunun bardak sayisini OKU (SALT OKUNUR; useLiveQuery icinde guvenli)
export async function getWaterDay(dateStr: string): Promise<number> {
  const row = await dietDb.water.where('dateStr').equals(dateStr).first()
  return row?.glasses ?? 0
}
export function listWater(): Promise<Water[]> {
  return dietDb.water.orderBy('dateStr').toArray()
}
// Bir gunun bardak sayisini ayarla (yazma baglami; 0'a duserse kaydi siler)
export async function setWaterDay(dateStr: string, glasses: number) {
  const g = Math.max(0, Math.round(glasses))
  const row = await dietDb.water.where('dateStr').equals(dateStr).first()
  if (row?.id != null) {
    if (g === 0) await dietDb.water.delete(row.id)
    else await dietDb.water.update(row.id, { glasses: g })
  } else if (g > 0) {
    await dietDb.water.add({ dateStr, glasses: g, createdAt: Date.now() })
  }
}

// ---- Su (ml esasli) ----
// Bir gunun toplam suyunu ml olarak dondurur (eski bardak kaydi 200 ml sayilir)
export async function getWaterMlDay(dateStr: string): Promise<number> {
  const row = await dietDb.water.where('dateStr').equals(dateStr).first()
  if (!row) return 0
  return row.ml != null ? row.ml : (row.glasses || 0) * 200
}
// Bir gune ml ekler/cikarir (negatif olabilir); 0'in altina inmez, 0'da kaydi siler
export async function addWaterMl(dateStr: string, deltaMl: number) {
  const row = await dietDb.water.where('dateStr').equals(dateStr).first()
  const current = row ? (row.ml != null ? row.ml : (row.glasses || 0) * 200) : 0
  const next = Math.max(0, Math.round(current + deltaMl))
  if (row?.id != null) {
    if (next === 0) await dietDb.water.delete(row.id)
    else await dietDb.water.update(row.id, { ml: next, glasses: Math.round(next / 200) })
  } else if (next > 0) {
    await dietDb.water.add({ dateStr, ml: next, glasses: Math.round(next / 200), createdAt: Date.now() })
  }
}

// ---- Gunluk adim takibi (elle girilir) ----
export async function getStepsDay(dateStr: string): Promise<number> {
  const row = await dietDb.steps.where('dateStr').equals(dateStr).first()
  return row?.count ?? 0
}
export function listSteps(): Promise<Steps[]> {
  return dietDb.steps.orderBy('dateStr').toArray()
}
// Bir gunun adim sayisini ayarla (0'a duserse kaydi siler)
export async function setStepsDay(dateStr: string, count: number) {
  const c = Math.max(0, Math.round(count))
  const row = await dietDb.steps.where('dateStr').equals(dateStr).first()
  if (row?.id != null) {
    if (c === 0) await dietDb.steps.delete(row.id)
    else await dietDb.steps.update(row.id, { count: c })
  } else if (c > 0) {
    await dietDb.steps.add({ dateStr, count: c, createdAt: Date.now() })
  }
}

// ---- Gunluk uyku takibi (elle, saat) ----
export async function getSleepDay(dateStr: string): Promise<number> {
  const row = await dietDb.sleep.where('dateStr').equals(dateStr).first()
  return row?.hours ?? 0
}
export function listSleep(): Promise<Sleep[]> {
  return dietDb.sleep.orderBy('dateStr').toArray()
}
export async function setSleepDay(dateStr: string, hours: number) {
  const h = Math.max(0, Math.min(24, Math.round(hours * 10) / 10))
  const row = await dietDb.sleep.where('dateStr').equals(dateStr).first()
  if (row?.id != null) {
    if (h === 0) await dietDb.sleep.delete(row.id)
    else await dietDb.sleep.update(row.id, { hours: h })
  } else if (h > 0) {
    await dietDb.sleep.add({ dateStr, hours: h, createdAt: Date.now() })
  }
}

// ---- Ilerleme fotograflari (once-sonra) ----
export function listProgress(): Promise<ProgressPhoto[]> {
  return dietDb.progress.orderBy('createdAt').reverse().toArray()
}
export async function addProgress(photo: string, note?: string): Promise<number> {
  return dietDb.progress.add({
    photo,
    note,
    createdAt: Date.now(),
    dateStr: new Date().toLocaleDateString('en-CA')
  })
}
export async function deleteProgress(id: number) {
  await dietDb.progress.delete(id)
}

// ---- Alisveris listesi ----
export function listShopping(): Promise<ShoppingItem[]> {
  return dietDb.shopping.orderBy('createdAt').toArray()
}
export async function addShopping(text: string, category?: string, meals?: string[]) {
  await dietDb.shopping.add({ text, done: false, createdAt: Date.now(), category, meals })
}
// Kategori ve ogun bilgisini koruyarak birden cok urunu tek seferde ekler
export async function addShoppingMany(items: { text: string; category?: string; meals?: string[] }[]) {
  const now = Date.now()
  await dietDb.shopping.bulkAdd(
    items.map((it, i) => ({ text: it.text, category: it.category, meals: it.meals, done: false, createdAt: now + i }))
  )
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

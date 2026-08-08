// Dexie (IndexedDB) tabanli yerel veritabani.
// Tum veriler cihazda saklanir; sunucu yoktur, offline calisir.
import Dexie, { type Table } from 'dexie'
import type { AppSettings, CityRecord, Customer } from './types'
import { seedCities } from './data/turkeyCities'

// Rehberden bir daha eklenmemesi icin engellenen telefon numaralari
export interface IgnoredPhone {
  phone: string
  name?: string // listede taninabilsin diye (indexlenmez)
}

export class SahaCrmDB extends Dexie {
  customers!: Table<Customer, number>
  settings!: Table<AppSettings, number>
  cities!: Table<CityRecord, number>
  ignoredPhones!: Table<IgnoredPhone, string>

  constructor() {
    super('saha-crm')
    this.version(1).stores({
      // Aranabilir/filtrelenebilir alanlar indexlenir
      customers: '++id, companyTitle, contactName, phone, city, district, birthDate, updatedAt',
      settings: '++id',
      cities: '++id, &name'
    })
    // v2: silinen/istenmeyen numaralari sakla; rehber tekrar aktarilinca gelmesinler
    this.version(2).stores({
      ignoredPhones: '&phone'
    })
  }
}

export const db = new SahaCrmDB()

// Ilk acilista il/ilce listesini ve varsayilan ayarlari yukle
export async function ensureSeeded() {
  const cityCount = await db.cities.count()
  if (cityCount === 0) {
    await db.cities.bulkAdd(seedCities.map((c) => ({ name: c.name, districts: c.districts })))
  }
  const settingsCount = await db.settings.count()
  if (settingsCount === 0) {
    await db.settings.add({ startName: 'Ofis' })
  }
}

export async function getSettings(): Promise<AppSettings> {
  const s = await db.settings.toCollection().first()
  if (s) return s
  const id = await db.settings.add({ startName: 'Ofis' })
  return { id, startName: 'Ofis' }
}

export async function saveSettings(patch: Partial<AppSettings>) {
  const s = await getSettings()
  await db.settings.update(s.id!, patch)
}

// --- Engellenen numaralar (rehberden tekrar eklenmesin) ---
export async function addIgnoredPhones(items: { phone: string; name?: string }[]) {
  const clean = items
    .filter((i) => i.phone && i.phone.trim())
    .map((i) => ({ phone: i.phone.trim(), name: i.name?.trim() || undefined }))
  if (clean.length === 0) return
  await db.ignoredPhones.bulkPut(clean)
}
export async function getIgnoredPhoneSet(): Promise<Set<string>> {
  return new Set((await db.ignoredPhones.toArray()).map((r) => r.phone))
}
export async function removeIgnoredPhone(phone: string) {
  await db.ignoredPhones.delete(phone)
}
export async function clearIgnoredPhones() {
  await db.ignoredPhones.clear()
}

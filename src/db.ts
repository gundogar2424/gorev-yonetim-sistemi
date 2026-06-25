// Dexie (IndexedDB) tabanli yerel veritabani.
// Tum veriler cihazda saklanir; sunucu yoktur, offline calisir.
import Dexie, { type Table } from 'dexie'
import type { AppSettings, CityRecord, Customer } from './types'
import { seedCities } from './data/turkeyCities'

export class SahaCrmDB extends Dexie {
  customers!: Table<Customer, number>
  settings!: Table<AppSettings, number>
  cities!: Table<CityRecord, number>

  constructor() {
    super('saha-crm')
    this.version(1).stores({
      // Aranabilir/filtrelenebilir alanlar indexlenir
      customers: '++id, companyTitle, contactName, phone, city, district, birthDate, updatedAt',
      settings: '++id',
      cities: '++id, &name'
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

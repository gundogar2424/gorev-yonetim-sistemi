// Uygulamadaki tum veri tipleri burada tanimlidir.

export type Ownership = 'mulk' | 'kira' | 'bilinmiyor'
export type PaymentType = 'nakit' | 'kredi-karti' | 'cek' | 'havale' | 'diger'

export interface GpsPoint {
  lat: number
  lng: number
}

export interface Customer {
  id?: number
  // Profil / firma fotografi (base64 data URL olarak saklanir)
  photo?: string
  // Kimlik
  companyTitle: string // Firma unvani
  contactName: string // Yetkili adi soyadi
  role: string // Gorevi
  phone: string // Telefon numarasi
  // Adres
  city: string // Il
  district: string // Ilce
  gps?: GpsPoint // Anlik GPS konumu
  // Ticari bilgiler
  sector: string // Sektor
  areaM2?: number // m2 alani
  employeeCount?: number // Calisan sayisi
  riskScore?: number // Risk puani (1-10)
  ownership: Ownership // Mulkiyet durumu
  paymentType: PaymentType // Odeme sekli
  term?: string // Vade
  // Diger
  notes?: string // Ozel notlar
  machinePark?: string // Makine parkuru
  birthDate?: string // Yetkili dogum tarihi (YYYY-MM-DD)
  // Sistem
  createdAt: number
  updatedAt: number
}

export interface AppSettings {
  id?: number
  // Baslangic konumu (ev veya ofis)
  startName: string
  startGps?: GpsPoint
  startAddress?: string
}

// Il/ilce listesi: il adi -> ilce adlari
export interface CityRecord {
  id?: number
  name: string // Il adi
  districts: string[] // Ilce adlari
}

export interface BackupFile {
  version: number
  exportedAt: number
  customers: Customer[]
  settings: AppSettings | null
  cities: CityRecord[]
}

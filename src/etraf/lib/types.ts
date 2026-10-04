// Etrafimda: ortak veri tipleri.

export interface LatLng {
  lat: number
  lng: number
}

export type CategoryId = 'yeme' | 'kafe' | 'bar' | 'kultur' | 'gezi' | 'eglence' | 'doga' | 'alisveris'

export type SortId = 'mesafe' | 'puan' | 'hype' | 'cesit' | 'ad'

export interface Place {
  id: string // 'osm:node/123' veya 'g:ChIJ...'
  name: string
  category: CategoryId
  subtype: string // Turkce tur etiketi: "Kebap", "Müze", "Kahveci"...
  lat: number
  lng: number
  distanceM: number
  address?: string
  // Google'dan (anahtar girildiyse)
  rating?: number // 1-5
  ratingCount?: number
  priceLevel?: number // 1-4
  openNow?: boolean
  googleUri?: string
  googlePlaceId?: string
  // OpenStreetMap etiketlerinden
  website?: string
  phone?: string
  instagram?: string // profil adi ya da adres
  facebook?: string
  wikipedia?: string
  openingHours?: string
  // Hesaplanan
  hype: number // 0-100 tahmini populerlik
  aiHype?: boolean // true: hype puani yapay zeka degerlendirmesinden geliyor
  sources: ('osm' | 'google')[]
}

export interface ScanResult {
  at: number // zaman damgasi (ms)
  center: LatLng
  radiusM: number
  places: Place[]
  googleUsed: boolean
  warnings: string[]
}

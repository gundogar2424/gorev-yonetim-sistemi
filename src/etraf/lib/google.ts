// Google Places API (New) - Nearby Search. ISTEGE BAGLI: kullanici kendi
// API anahtarini Ayarlar'a girerse Google puani, yorum sayisi, fiyat seviyesi
// ve "su an acik" bilgisi gelir. Her kategori icin tek istek (en cok 20 yer).
import { CATEGORY_BY_ID, googleCategory } from './categories'
import { distanceM } from './geo'
import { httpJson } from './http'
import type { CategoryId, LatLng, Place } from './types'

const URL = 'https://places.googleapis.com/v1/places:searchNearby'
const FIELDS = [
  'places.id',
  'places.displayName',
  'places.location',
  'places.rating',
  'places.userRatingCount',
  'places.priceLevel',
  'places.types',
  'places.primaryTypeDisplayName',
  'places.shortFormattedAddress',
  'places.googleMapsUri',
  'places.websiteUri',
  'places.nationalPhoneNumber',
  'places.currentOpeningHours.openNow'
].join(',')

const PRICE: Record<string, number> = {
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4
}

interface GPlace {
  id: string
  displayName?: { text: string }
  location?: { latitude: number; longitude: number }
  rating?: number
  userRatingCount?: number
  priceLevel?: string
  types?: string[]
  primaryTypeDisplayName?: { text: string }
  shortFormattedAddress?: string
  googleMapsUri?: string
  websiteUri?: string
  nationalPhoneNumber?: string
  currentOpeningHours?: { openNow?: boolean }
}

async function searchCategory(apiKey: string, center: LatLng, radiusM: number, cat: CategoryId): Promise<Place[]> {
  const res = await httpJson<{ places?: GPlace[] }>({
    url: URL,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELDS
    },
    body: JSON.stringify({
      includedTypes: CATEGORY_BY_ID[cat].google,
      maxResultCount: 20,
      // POPULARITY: en bilinen/en cok ilgi gorenler once gelir (20 sinir var)
      rankPreference: 'POPULARITY',
      languageCode: 'tr',
      regionCode: 'TR',
      locationRestriction: {
        circle: { center: { latitude: center.lat, longitude: center.lng }, radius: Math.min(radiusM, 50000) }
      }
    }),
    timeoutMs: 20000
  })
  return (res.places ?? [])
    .filter((g) => g.location && g.displayName?.text)
    .map((g) => {
      const lat = g.location!.latitude
      const lng = g.location!.longitude
      return {
        id: `g:${g.id}`,
        name: g.displayName!.text,
        category: googleCategory(g.types ?? [], cat),
        subtype: g.primaryTypeDisplayName?.text || CATEGORY_BY_ID[cat].label,
        lat,
        lng,
        distanceM: distanceM(center, { lat, lng }),
        address: g.shortFormattedAddress,
        rating: g.rating,
        ratingCount: g.userRatingCount,
        priceLevel: g.priceLevel ? PRICE[g.priceLevel] : undefined,
        openNow: g.currentOpeningHours?.openNow,
        googleUri: g.googleMapsUri,
        googlePlaceId: g.id,
        website: g.websiteUri,
        phone: g.nationalPhoneNumber,
        hype: 0,
        sources: ['google']
      } satisfies Place
    })
}

export async function fetchGoogle(
  apiKey: string,
  center: LatLng,
  radiusM: number,
  cats: CategoryId[]
): Promise<{ places: Place[]; errors: string[] }> {
  const settled = await Promise.allSettled(cats.map((c) => searchCategory(apiKey, center, radiusM, c)))
  const places: Place[] = []
  const errors = new Set<string>()
  for (const r of settled) {
    if (r.status === 'fulfilled') places.push(...r.value)
    else errors.add(r.reason instanceof Error ? r.reason.message : String(r.reason))
  }
  return { places, errors: [...errors] }
}

// Ayarlar'daki "Anahtarı dene" icin: tek, kucuk bir istek.
export async function testGoogleKey(apiKey: string): Promise<string> {
  try {
    const r = await searchCategory(apiKey, { lat: 41.0082, lng: 28.9784 }, 300, 'kafe')
    return `Çalışıyor ✓ (deneme aramasında ${r.length} yer bulundu)`
  } catch (e) {
    return 'Hata: ' + (e instanceof Error ? e.message : String(e))
  }
}

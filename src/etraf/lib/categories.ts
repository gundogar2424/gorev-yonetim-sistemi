// Kategoriler: her biri hem OpenStreetMap (Overpass) seciciyle hem de
// Google Places (New) tur listesiyle eslenir.
import type { CategoryId } from './types'

export interface Category {
  id: CategoryId
  label: string
  emoji: string
  // Overpass sorgu parcalari: ["anahtar", "deger1|deger2"]
  osm: [string, string][]
  // Google Places (New) "Table A" turleri
  google: string[]
}

export const CATEGORIES: Category[] = [
  {
    id: 'yeme',
    label: 'Yeme',
    emoji: '🍽️',
    osm: [['amenity', 'restaurant|fast_food|food_court']],
    google: ['restaurant']
  },
  {
    id: 'kafe',
    label: 'Kafe & Tatlı',
    emoji: '☕',
    osm: [
      ['amenity', 'cafe|ice_cream'],
      ['shop', 'bakery|pastry|confectionery|coffee']
    ],
    google: ['cafe', 'coffee_shop', 'bakery', 'ice_cream_shop']
  },
  {
    id: 'bar',
    label: 'Bar & Gece',
    emoji: '🍸',
    osm: [['amenity', 'bar|pub|nightclub|biergarten']],
    google: ['bar', 'night_club', 'pub']
  },
  {
    id: 'kultur',
    label: 'Kültür & Sanat',
    emoji: '🎭',
    osm: [
      ['amenity', 'theatre|cinema|arts_centre|library'],
      ['tourism', 'museum|gallery']
    ],
    google: ['museum', 'art_gallery', 'movie_theater', 'performing_arts_theater', 'library', 'cultural_center']
  },
  {
    id: 'gezi',
    label: 'Gezilecek',
    emoji: '🏛️',
    osm: [
      ['tourism', 'attraction|viewpoint'],
      ['historic', 'monument|castle|memorial|archaeological_site|ruins|fort|city_gate']
    ],
    google: ['tourist_attraction', 'historical_landmark']
  },
  {
    id: 'eglence',
    label: 'Eğlence',
    emoji: '🎳',
    osm: [
      ['leisure', 'bowling_alley|amusement_arcade|escape_game|water_park|miniature_golf'],
      ['tourism', 'zoo|aquarium|theme_park']
    ],
    google: ['amusement_park', 'bowling_alley', 'zoo', 'aquarium']
  },
  {
    id: 'doga',
    label: 'Park & Doğa',
    emoji: '🌳',
    osm: [
      ['leisure', 'park|garden|nature_reserve'],
      ['natural', 'beach']
    ],
    google: ['park', 'national_park']
  },
  {
    id: 'alisveris',
    label: 'AVM & Çarşı',
    emoji: '🛍️',
    osm: [
      ['shop', 'mall'],
      ['amenity', 'marketplace']
    ],
    google: ['shopping_mall']
  }
]

export const CATEGORY_BY_ID: Record<CategoryId, Category> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c])
) as Record<CategoryId, Category>

// OSM etiket degerlerinin Turkce karsiliklari (tur etiketi icin).
const OSM_TYPE_TR: Record<string, string> = {
  restaurant: 'Restoran',
  fast_food: 'Fast food',
  food_court: 'Yemek alanı',
  cafe: 'Kafe',
  ice_cream: 'Dondurmacı',
  bakery: 'Fırın',
  pastry: 'Pastane',
  confectionery: 'Şekerci',
  coffee: 'Kahve dükkânı',
  bar: 'Bar',
  pub: 'Pub',
  nightclub: 'Gece kulübü',
  biergarten: 'Bira bahçesi',
  theatre: 'Tiyatro',
  cinema: 'Sinema',
  arts_centre: 'Sanat merkezi',
  library: 'Kütüphane',
  museum: 'Müze',
  gallery: 'Galeri',
  attraction: 'Turistik yer',
  viewpoint: 'Seyir noktası',
  monument: 'Anıt',
  castle: 'Kale',
  memorial: 'Anıt / Hatıra',
  archaeological_site: 'Ören yeri',
  ruins: 'Harabe',
  fort: 'Tabya',
  city_gate: 'Kent kapısı',
  bowling_alley: 'Bowling',
  amusement_arcade: 'Oyun salonu',
  escape_game: 'Kaçış oyunu',
  water_park: 'Su parkı',
  miniature_golf: 'Mini golf',
  zoo: 'Hayvanat bahçesi',
  aquarium: 'Akvaryum',
  theme_park: 'Tema parkı',
  park: 'Park',
  garden: 'Bahçe',
  nature_reserve: 'Tabiat alanı',
  beach: 'Plaj',
  mall: 'AVM',
  marketplace: 'Pazar / Çarşı'
}

// Yaygin mutfak (cuisine) degerleri: "Restoran" yerine daha bilgilendirici.
const CUISINE_TR: Record<string, string> = {
  turkish: 'Türk mutfağı',
  kebab: 'Kebap',
  doner: 'Döner',
  pide: 'Pide',
  lahmacun: 'Lahmacun',
  kofte: 'Köfte',
  meatball: 'Köfte',
  balik: 'Balık',
  fish: 'Balık',
  seafood: 'Deniz ürünleri',
  pizza: 'Pizza',
  burger: 'Burger',
  chicken: 'Tavuk',
  sandwich: 'Sandviç',
  breakfast: 'Kahvaltı',
  coffee_shop: 'Kahveci',
  cake: 'Pasta',
  dessert: 'Tatlı',
  baklava: 'Baklava',
  ice_cream: 'Dondurma',
  steak_house: 'Et / Steak',
  steak: 'Et / Steak',
  italian: 'İtalyan',
  chinese: 'Çin',
  japanese: 'Japon',
  sushi: 'Suşi',
  asian: 'Asya',
  indian: 'Hint',
  mexican: 'Meksika',
  french: 'Fransız',
  greek: 'Yunan',
  mediterranean: 'Akdeniz',
  regional: 'Yöresel',
  international: 'Dünya mutfağı',
  vegan: 'Vegan',
  vegetarian: 'Vejetaryen',
  soup: 'Çorba',
  tea: 'Çay',
  bagel: 'Simit / Bagel',
  pasta: 'Makarna',
  noodle: 'Noodle',
  ramen: 'Ramen',
  wine: 'Şarap',
  beer: 'Bira'
}

export function osmSubtype(tags: Record<string, string>): string {
  const cuisine = (tags.cuisine || '').split(';')[0].trim().toLowerCase()
  if (cuisine && CUISINE_TR[cuisine]) return CUISINE_TR[cuisine]
  for (const key of ['amenity', 'tourism', 'historic', 'leisure', 'shop', 'natural']) {
    const v = tags[key]
    if (v && OSM_TYPE_TR[v]) return OSM_TYPE_TR[v]
  }
  if (cuisine) return capitalize(cuisine.replace(/_/g, ' '))
  return 'Diğer'
}

// Google birincil turu -> kategori (Google sonucunu dogru kategoriye koymak icin).
export function googleCategory(types: string[], fallback: CategoryId): CategoryId {
  for (const c of CATEGORIES) {
    if (types.some((t) => c.google.includes(t))) return c.id
  }
  if (types.some((t) => t.endsWith('_restaurant') || t === 'meal_takeaway' || t === 'food')) return 'yeme'
  return fallback
}

function capitalize(s: string): string {
  return s.charAt(0).toLocaleUpperCase('tr') + s.slice(1)
}

// OpenStreetMap (Overpass API): ucretsiz, anahtar gerektirmez.
// Puan bilgisi yoktur; ad, tur, mutfak, web/instagram, calisma saati verir.
import { CATEGORY_BY_ID, osmSubtype } from './categories'
import { distanceM } from './geo'
import { httpJson } from './http'
import type { CategoryId, LatLng, Place } from './types'

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
]

interface OsmElement {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

function buildQuery(center: LatLng, radiusM: number, cats: CategoryId[]): string {
  const around = `(around:${Math.round(radiusM)},${center.lat.toFixed(6)},${center.lng.toFixed(6)})`
  const parts: string[] = []
  for (const id of cats) {
    for (const [key, values] of CATEGORY_BY_ID[id].osm) {
      parts.push(`nwr["${key}"~"^(${values})$"]["name"]${around};`)
    }
  }
  return `[out:json][timeout:25];(${parts.join('')});out center tags 600;`
}

export async function fetchOsm(center: LatLng, radiusM: number, cats: CategoryId[]): Promise<Place[]> {
  const q = '?data=' + encodeURIComponent(buildQuery(center, radiusM, cats))
  let lastErr: unknown
  for (const url of ENDPOINTS) {
    try {
      const res = await httpJson<{ elements?: OsmElement[] }>({ url: url + q, timeoutMs: 30000 })
      return (res.elements ?? []).map((el) => toPlace(el, center, cats)).filter((p): p is Place => !!p)
    } catch (e) {
      lastErr = e // bu sunucu mesgul olabilir, sonrakini dene
    }
  }
  throw new Error('OpenStreetMap sunucularına ulaşılamadı. ' + (lastErr instanceof Error ? lastErr.message : ''))
}

function toPlace(el: OsmElement, center: LatLng, cats: CategoryId[]): Place | null {
  const tags = el.tags ?? {}
  const lat = el.lat ?? el.center?.lat
  const lng = el.lon ?? el.center?.lon
  const name = tags['name:tr'] || tags.name
  if (lat == null || lng == null || !name) return null
  const category = categoryOf(tags, cats)
  if (!category) return null
  const street = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ')
  const address = [street, tags['addr:district'] || tags['addr:suburb'], tags['addr:city']].filter(Boolean).join(', ')
  return {
    id: `osm:${el.type}/${el.id}`,
    name,
    category,
    subtype: osmSubtype(tags),
    lat,
    lng,
    distanceM: distanceM(center, { lat, lng }),
    address: address || undefined,
    website: tags['contact:website'] || tags.website || undefined,
    phone: tags['contact:phone'] || tags.phone || undefined,
    instagram: tags['contact:instagram'] || tags.instagram || undefined,
    facebook: tags['contact:facebook'] || tags.facebook || undefined,
    wikipedia: tags.wikipedia || (tags.wikidata ? `wikidata:${tags.wikidata}` : undefined),
    openingHours: tags.opening_hours || undefined,
    hype: 0,
    sources: ['osm']
  }
}

function categoryOf(tags: Record<string, string>, cats: CategoryId[]): CategoryId | null {
  for (const id of cats) {
    for (const [key, values] of CATEGORY_BY_ID[id].osm) {
      const v = tags[key]
      if (v && values.split('|').includes(v)) return id
    }
  }
  return null
}

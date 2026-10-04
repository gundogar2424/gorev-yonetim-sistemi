// Dis baglantilar (harita, yol tarifi, sosyal medya aramasi).
import type { Place } from './types'

const enc = encodeURIComponent

export function directionsUrl(p: Place): string {
  const pid = p.googlePlaceId ? `&destination_place_id=${enc(p.googlePlaceId)}` : ''
  return `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}${pid}&travelmode=walking`
}

export function mapsUrl(p: Place): string {
  if (p.googleUri) return p.googleUri
  // Adres varsa "ad, adres" ile ara (Google'daki kaydi ve yorumlari acilir);
  // yoksa tam koordinata igne birak (ayni adli baska bir subeye gitmesin).
  const q = p.address ? `${p.name}, ${p.address}` : `${p.lat},${p.lng}`
  return `https://www.google.com/maps/search/?api=1&query=${enc(q)}`
}

export function instagramUrl(p: Place): string {
  const ig = p.instagram?.trim()
  if (ig) {
    if (/^https?:\/\//i.test(ig)) return ig
    return `https://www.instagram.com/${enc(ig.replace(/^@/, ''))}/`
  }
  return `https://www.instagram.com/explore/search/keyword/?q=${enc(p.name)}`
}

export function tiktokUrl(p: Place): string {
  return `https://www.tiktok.com/search?q=${enc(p.name)}`
}

export function wikipediaUrl(p: Place): string | null {
  const w = p.wikipedia
  if (!w) return null
  if (w.startsWith('wikidata:')) return `https://www.wikidata.org/wiki/${enc(w.slice(9))}`
  const m = w.match(/^([a-z-]+):(.+)$/)
  if (m) return `https://${m[1]}.wikipedia.org/wiki/${enc(m[2].replace(/ /g, '_'))}`
  return `https://tr.wikipedia.org/wiki/${enc(w.replace(/ /g, '_'))}`
}

export function websiteUrl(p: Place): string | null {
  if (!p.website) return null
  return /^https?:\/\//i.test(p.website) ? p.website : `https://${p.website}`
}

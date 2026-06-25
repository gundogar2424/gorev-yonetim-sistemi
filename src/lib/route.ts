// Akilli rota planlama.
// En-yakin-komsu (nearest neighbor) sezgisel algoritmasi ile baslangic
// noktasindan baslayarak en kisa mantikli guzergahi siralar, sonra
// Google Haritalar navigasyon baglantisi uretir.
import type { Customer, GpsPoint } from '../types'
import { haversineKm } from './geo'

export interface RouteStop {
  customer: Customer
  legKm: number // bir onceki noktadan bu noktaya mesafe
}

export interface PlannedRoute {
  start: GpsPoint
  stops: RouteStop[]
  totalKm: number
}

// Baslangic noktasindan secili musterileri en-yakin-komsu ile sirala
export function planRoute(start: GpsPoint, customers: Customer[]): PlannedRoute {
  const withGps = customers.filter((c) => c.gps)
  const remaining = [...withGps]
  const stops: RouteStop[] = []
  let current = start
  let totalKm = 0

  while (remaining.length > 0) {
    let bestIdx = 0
    let bestDist = Infinity
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(current, remaining[i].gps!)
      if (d < bestDist) {
        bestDist = d
        bestIdx = i
      }
    }
    const next = remaining.splice(bestIdx, 1)[0]
    stops.push({ customer: next, legKm: bestDist })
    totalKm += bestDist
    current = next.gps!
  }

  return { start, stops, totalKm }
}

// Google Haritalar yol tarifi baglantisi (waypoint = ara durak)
export function googleMapsUrl(route: PlannedRoute): string {
  const origin = `${route.start.lat},${route.start.lng}`
  const points = route.stops.map((s) => `${s.customer.gps!.lat},${s.customer.gps!.lng}`)
  if (points.length === 0) return ''
  const destination = points[points.length - 1]
  const waypoints = points.slice(0, -1).join('|')
  const params = new URLSearchParams({
    api: '1',
    origin,
    destination,
    travelmode: 'driving'
  })
  if (waypoints) params.set('waypoints', waypoints)
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

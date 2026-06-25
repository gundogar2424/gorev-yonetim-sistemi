// Konum (GPS) yardimcilari
import type { GpsPoint } from '../types'

// Cihazdan anlik konum al
export function getCurrentPosition(): Promise<GpsPoint> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Bu cihaz konum servisini desteklemiyor.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(new Error(konumHatasi(err))),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  })
}

function konumHatasi(err: GeolocationPositionError): string {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return 'Konum izni verilmedi. Tarayici ayarlarindan izin verin.'
    case err.POSITION_UNAVAILABLE:
      return 'Konum su an alinamiyor.'
    case err.TIMEOUT:
      return 'Konum alma zaman asimina ugradi.'
    default:
      return 'Konum alinamadi.'
  }
}

// Iki nokta arasi yaklasik mesafe (km) - Haversine formulu
export function haversineKm(a: GpsPoint, b: GpsPoint): number {
  const R = 6371
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * R * Math.asin(Math.sqrt(h))
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

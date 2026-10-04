// Konum yardimcilari (Etrafimda'ya ozel; CRM'in dosyalarini kullanmaz).
import { Capacitor } from '@capacitor/core'
import type { LatLng } from './types'

// APK icinde Capacitor Geolocation eklentisi, tarayicida navigator.geolocation.
export async function getCurrentPosition(): Promise<LatLng> {
  if (Capacitor.isNativePlatform()) {
    const { Geolocation } = await import('@capacitor/geolocation')
    const perm = await Geolocation.requestPermissions({ permissions: ['location', 'coarseLocation'] })
    if (perm.location === 'denied' && perm.coarseLocation === 'denied') {
      throw new Error('Konum izni verilmedi. Telefon Ayarlar › Uygulamalar › Etrafımda › İzinler bölümünden izin verin.')
    }
    try {
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 })
      return { lat: pos.coords.latitude, lng: pos.coords.longitude }
    } catch (e) {
      throw new Error('Konum alınamadı. Konum (GPS) açık mı? ' + (e instanceof Error ? e.message : ''))
    }
  }

  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Bu cihaz konum servisini desteklemiyor.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) reject(new Error('Konum izni verilmedi. Tarayıcı ayarlarından izin verin.'))
        else if (err.code === err.TIMEOUT) reject(new Error('Konum alma zaman aşımına uğradı. Tekrar deneyin.'))
        else reject(new Error('Konum şu an alınamıyor.'))
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    )
  })
}

// Iki nokta arasi mesafe (metre) - Haversine
export function distanceM(a: LatLng, b: LatLng): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat))
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m / 10) * 10} m`
  return `${(m / 1000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} km`
}

// Yaklasik yuruyus suresi (dakika): ~80 m/dk, sokak dolambaci icin x1.25
export function walkMinutes(m: number): number {
  return Math.max(1, Math.round((m * 1.25) / 80))
}

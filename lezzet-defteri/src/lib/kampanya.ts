// MEKAN KAMPANYALARI: kullanici dugmeye basinca kayitli mekanlarin (oncelik
// favoriler) guncel kampanya/indirim/etkinlik duyurulari yapay zekayla (Google
// aramasi) kontrol edilir; bulununca telefona bildirim gider.
import { Capacitor, registerPlugin } from '@capacitor/core'
import { useSyncExternalStore } from 'react'
import { lzDb } from '../db'
import type { LzMekan } from '../types'
import { aiMekanKampanya, apiAnahtari } from './ai'

const KEY_SON = 'lz-kampanya-son'
const EN_FAZLA = 15 // bir kontrolde en fazla bu kadar mekana bakilir (maliyet)

type Yerel = {
  bildir(o: { baslik: string; metin: string; no?: number }): Promise<void>
  bildirimIzni(): Promise<void>
}
const yerel = registerPlugin<Yerel>('LzSira')

function oku(k: string): string {
  try {
    return localStorage.getItem(k) ?? ''
  } catch {
    return ''
  }
}
function yaz(k: string, v: string): void {
  try {
    localStorage.setItem(k, v)
  } catch {
    /* yok */
  }
}

export function sonKontrol(): number {
  return Number(oku(KEY_SON)) || 0
}

export async function bildirimIzniIste(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    await yerel.bildirimIzni()
  } catch {
    /* yok */
  }
}

async function bildir(baslik: string, metin: string, no: number): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await yerel.bildir({ baslik, metin, no })
    } catch {
      /* izin yok */
    }
    return
  }
  try {
    if ('Notification' in window && Notification.permission === 'granted') new Notification(baslik, { body: metin })
  } catch {
    /* yok */
  }
}

// Bugunden itibaren 7 gun (hafta sonu dahil)
function aralik(): { bas: string; son: string } {
  const g = new Date()
  const s = new Date(g.getFullYear(), g.getMonth(), g.getDate() + 7)
  const f = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { bas: f(g), son: f(s) }
}

type Durum = { calisiyor: boolean; mesaj: string }
let durum: Durum = { calisiyor: false, mesaj: '' }
const dinleyen = new Set<() => void>()
function durumYaz(d: Durum) {
  durum = d
  dinleyen.forEach((f) => f())
}
export function useKampanyaDurumu(): Durum {
  return useSyncExternalStore(
    (f) => {
      dinleyen.add(f)
      return () => dinleyen.delete(f)
    },
    () => durum
  )
}

// Kontrol edilecek mekanlar: favoriler (yoksa gidilmeyenler, yoksa hepsi)
async function hedefMekanlar(): Promise<LzMekan[]> {
  const hepsi = await lzDb.mekanlar.toArray()
  const fav = hepsi.filter((m) => m.favori)
  const liste = fav.length ? fav : hepsi.filter((m) => !m.gidildi).length ? hepsi.filter((m) => !m.gidildi) : hepsi
  return liste.sort((a, b) => (a.kampanyaBakildi ?? 0) - (b.kampanyaBakildi ?? 0)).slice(0, EN_FAZLA)
}

export async function kampanyaKontrolEt(): Promise<{ bakilan: number; bulunan: LzMekan[] }> {
  if (durum.calisiyor) return { bakilan: 0, bulunan: [] }
  if (!apiAnahtari()) throw new Error('Kampanya araştırması için Ayarlar’dan Gemini anahtarı gir.')
  const liste = await hedefMekanlar()
  const bulunan: LzMekan[] = []
  durumYaz({ calisiyor: true, mesaj: `${liste.length} mekanın kampanyalarına bakılıyor…` })
  try {
    for (let i = 0; i < liste.length; i++) {
      const m = liste[i]
      durumYaz({ calisiyor: true, mesaj: `Kampanyalar: ${m.ad} (${i + 1}/${liste.length})` })
      try {
        const k = await tekMekan(m)
        if (k.var) {
          bulunan.push(m)
          await bildir(`🎁 ${m.ad}`, `${k.ozet}${k.gecerlilik ? ` (${k.gecerlilik})` : ''}`, 5000 + (m.id ?? 0))
        }
      } catch {
        /* tek mekan hatasi digerlerini durdurmaz */
      }
    }
    yaz(KEY_SON, String(Date.now()))
  } finally {
    durumYaz({ calisiyor: false, mesaj: '' })
  }
  return { bakilan: liste.length, bulunan }
}

// Tek mekanin kampanyasi (mekan sayfasindaki dugme)
async function tekMekan(m: LzMekan) {
  const k = await aiMekanKampanya(m, aralik())
  await lzDb.mekanlar.update(m.id!, {
    kampanyaBakildi: Date.now(),
    kampanya: k.var ? { ozet: k.ozet, gecerlilik: k.gecerlilik, kaynak: k.kaynak, zaman: Date.now() } : undefined
  })
  return k
}

export async function mekanKampanyasi(m: LzMekan): Promise<boolean> {
  if (!apiAnahtari()) throw new Error('Kampanya araştırması için Ayarlar’dan Gemini anahtarı gir.')
  return (await tekMekan(m)).var
}

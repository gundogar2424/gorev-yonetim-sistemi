// KAYNAK LINKI DISARIDA AC: tarifin kaynak videosu uygulama ici webview'da degil,
// once ilgili uygulamada (YouTube varsa YouTube'da), yoksa telefonun tarayicisinda acilir.
// Acilamazsa link panoya kopyalanir; cagiran "YouTube açılamadı, link kopyalandı" der ve linki gosterir.
import { Capacitor, registerPlugin } from '@capacitor/core'
import type { LzRecipe } from '../types'
import { youtubeId } from './importer'

type Yerel = { disariAc(o: { url: string; uygulama: string }): Promise<void> }
const yerel = registerPlugin<Yerel>('LzSira')

// Acmak icin kullanilacak link: kayitli link oldugu gibi (? sonrasi, shorts/watch farki korunur).
// Eski kayitta link bozuk/eksikse YouTube kimligi cikarilip tam link yapilir.
export function kaynakLinki(r: Pick<LzRecipe, 'sourceUrl' | 'platform'>): string {
  const ham = (r.sourceUrl || '').trim()
  if (/^https?:\/\/\S+$/i.test(ham)) return ham
  const yt = youtubeId(ham) || (r.platform === 'youtube' && /^[\w-]{11}$/.test(ham) ? ham : '')
  if (yt) return `https://www.youtube.com/watch?v=${yt}`
  if (/^(www\.)?[\w-]+(\.[\w-]+)+\/\S*$/i.test(ham)) return `https://${ham}`
  return ham
}

// Link panoya (izin yoksa eski yontemle)
export async function panoyaKopyala(metin: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(metin)
    return true
  } catch {
    try {
      const t = document.createElement('textarea')
      t.value = metin
      t.style.position = 'fixed'
      t.style.opacity = '0'
      document.body.appendChild(t)
      t.select()
      const ok = document.execCommand('copy')
      t.remove()
      return ok
    } catch {
      return false
    }
  }
}

const UYGULAMA: Record<string, string> = { youtube: 'com.google.android.youtube', instagram: 'com.instagram.android', tiktok: 'com.zhiliaoapp.musically' }

// true: acildi. false: acilamadi (link panoya kopyalandi). Asla takilmaz: en fazla 4 sn beklenir.
export async function disariAc(url: string, platform = ''): Promise<boolean> {
  if (!/^https?:\/\//i.test(url)) {
    await panoyaKopyala(url)
    return false
  }
  let acildi = false
  try {
    if (Capacitor.isNativePlatform()) {
      const uygulama = UYGULAMA[platform] || (youtubeId(url) ? UYGULAMA.youtube : '')
      await Promise.race([yerel.disariAc({ url, uygulama }), new Promise((_, red) => setTimeout(() => red(new Error('zaman')), 4000))])
      acildi = true
    } else {
      const w = window.open(url, '_blank')
      if (w) {
        try {
          w.opener = null
        } catch {
          /* yok */
        }
        acildi = true
      }
    }
  } catch {
    acildi = false
  }
  if (!acildi) await panoyaKopyala(url)
  return acildi
}

// SESLE ILERLE: pisirme ekraninda "Sonraki", "Geri", "Tekrar" sozleri.
// Telefonda Android'in kendi konusma tanima servisi (cevrimdisi tercihli), tarayicida webkitSpeechRecognition.
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'

type Ses = {
  izinIste(): Promise<{ izin: boolean; var: boolean }>
  basla(): Promise<void>
  dur(): Promise<void>
  addListener(olay: 'duydu', f: (x: { metin: string }) => void): Promise<PluginListenerHandle>
}
const yerel = registerPlugin<Ses>('LzSes')

export type Komut = 'sonraki' | 'geri' | 'tekrar'

// Duyulan metinden komut: en son soylenen sozcuk gecerli
export function komutBul(metin: string): Komut | null {
  const t = metin.toLocaleLowerCase('tr')
  const bul: [Komut, RegExp][] = [
    ['sonraki', /\b(sonraki|ileri|devam|geç|gec)\b/g],
    ['geri', /\b(geri|önceki|onceki)\b/g],
    ['tekrar', /\b(tekrar|yeniden|bir daha)\b/g]
  ]
  let en: { k: Komut; yer: number } | null = null
  for (const [k, d] of bul) for (const m of t.matchAll(d)) if (!en || (m.index ?? 0) >= en.yer) en = { k, yer: m.index ?? 0 }
  return en?.k ?? null
}

// Ayarlar: "Sesle ilerle" dugmesi gosterilsin mi (varsayilan evet; pisirme ekraninda dugme her acilista kapali baslar)
const KEY = 'lz-sesle-ilerle'
export function sesleIlerleIzinli(): boolean {
  try {
    return localStorage.getItem(KEY) !== '0'
  } catch {
    return true
  }
}
export function sesleIlerleKaydet(v: boolean): void {
  try {
    localStorage.setItem(KEY, v ? '1' : '0')
  } catch {
    /* yok */
  }
}

// Dinlemeyi baslatir; donen islev durdurur. Ayni komut 1,5 sn icinde tekrar gelirse yok sayilir (kismi sonuclar).
export async function dinlemeyiBaslat(komutGeldi: (k: Komut) => void): Promise<() => void> {
  let son = { k: '' as string, t: 0 }
  const isle = (metin: string) => {
    const k = komutBul(metin.split(' | ')[0] ?? metin)
    if (!k) return
    const simdi = Date.now()
    if (son.k === k && simdi - son.t < 1500) return
    son = { k, t: simdi }
    komutGeldi(k)
  }
  if (Capacitor.isNativePlatform()) {
    const r = await yerel.izinIste()
    if (!r.var) throw new Error('Bu telefonda konuşma tanıma yok.')
    if (!r.izin) {
      // Izin penceresi acildi; kullanici izin verince tekrar basmasi gerekir
      await new Promise((x) => setTimeout(x, 1500))
      const r2 = await yerel.izinIste()
      if (!r2.izin) throw new Error('Mikrofon izni verilmedi.')
    }
    const h = await yerel.addListener('duydu', (x) => isle(x.metin))
    await yerel.basla()
    return () => {
      void yerel.dur()
      void h.remove()
    }
  }
  const W = window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike; SpeechRecognition?: new () => SpeechRecognitionLike }
  const Sinif = W.SpeechRecognition ?? W.webkitSpeechRecognition
  if (!Sinif) throw new Error('Bu tarayıcıda sesli komut yok.')
  let acik = true
  const r = new Sinif()
  r.lang = 'tr-TR'
  r.continuous = true
  r.interimResults = true
  r.onresult = (e) => {
    const s = e.results[e.results.length - 1]
    isle(s[0].transcript)
  }
  r.onend = () => acik && setTimeout(() => acik && r.start(), 300)
  r.start()
  return () => {
    acik = false
    r.stop()
  }
}
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: (e: { results: { length: number; [i: number]: { [j: number]: { transcript: string } } } }) => void
  onend: () => void
  start(): void
  stop(): void
}

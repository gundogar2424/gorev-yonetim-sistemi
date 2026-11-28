// PISIRME GUNLUGU: Pisirdim / Afiyet olsun! kaydi ve istenirse degisikligin tarife uygulanmasi.
import { lzDb, markCooked } from '../db'
import { aiTarifDegistir, apiAnahtari } from './ai'
import type { GunlukGirdi } from '../components/PisirmeNotu'

export const ISARET = ' ✎' // degisen malzeme/adimin SONUNA (bastaki miktar ve porsiyon hesabi bozulmaz)
export const isaretsiz = (x: string) => x.replace(/\s*✎\s*$/, '')

// Kayit hemen yapilir (sayi +1, tarih, gunluk satiri). Uygulama istendiyse ikinci sonuc arka planda gelir.
export async function pisirmeKaydet(id: number, g?: GunlukGirdi): Promise<{ uygulama?: Promise<string> }> {
  const zaman = await markCooked(id, g)
  if (!g?.uygula || !g.degisiklik) return {}
  return { uygulama: degisikligiUygula(id, zaman, g.degisiklik) }
}

// Degisikligi tarife uygular: yapay zeka tarifi yeniden yazar (Yapay zekayla degistir ile ayni), degisen satirlar ✎ ile isaretlenir.
// Anahtar yoksa ya da hata olursa tarif degismez, degisiklik yalnizca gunlukte kalir.
export async function degisikligiUygula(id: number, zaman: number, degisiklik: string): Promise<string> {
  if (!apiAnahtari()) return 'Yapay zeka anahtarı olmadığı için tarif değişmedi; değişiklik günlükte kaldı.'
  const r = await lzDb.recipes.get(id)
  if (!r) return ''
  try {
    const eski = { ...r, ingredients: r.ingredients.map(isaretsiz), steps: r.steps.map(isaretsiz) }
    const v = await aiTarifDegistir(eski, degisiklik, '')
    const isaretle = (yeni: string[] | undefined, onceki: string[]) => {
      if (!yeni?.length) return onceki
      const varolan = new Set(onceki)
      return yeni.map((x) => (varolan.has(isaretsiz(x)) ? isaretsiz(x) : isaretsiz(x) + ISARET))
    }
    const malzeme = isaretle(v.tarif.ingredients, eski.ingredients)
    const adim = isaretle(v.tarif.steps, eski.steps)
    const guncel = await lzDb.recipes.get(id)
    const pisirmeler = (guncel?.pisirmeler ?? []).map((p) => (p.zaman === zaman ? { ...p, uygulandi: true } : p))
    await lzDb.recipes.update(id, { ingredients: malzeme, steps: adim, pisirmeler, updatedAt: Date.now() })
    const n = [...malzeme, ...adim].filter((x) => x.endsWith('✎')).length
    return n ? `Tarif güncellendi; ${n} satır ✎ ile işaretlendi.` : 'Tarife uygulandı; değişen satır bulunmadı.'
  } catch (e) {
    return `Tarif değişmedi (${(e as Error).message}); değişiklik günlükte kaldı.`
  }
}

// PISIRME GUNLUGU: Pisirdim / Afiyet olsun! kaydi ve istenirse degisikligin tarife uygulanmasi.
import { lzDb, markCooked } from '../db'
import { aiTarifDegistir, apiAnahtari } from './ai'
import type { GunlukGirdi } from '../components/PisirmeNotu'

export const ISARET = ' ✎' // degisen malzeme/adimin SONUNA (bastaki miktar ve porsiyon hesabi bozulmaz)
export const isaretsiz = (x: string) => x.replace(/\s*✎\s*$/, '')

// Kayit hemen yapilir (sayi +1, tarih, gunluk satiri). Uygulama istendiyse ikinci sonuc arka planda gelir.
export async function pisirmeKaydet(id: number, g: GunlukGirdi | undefined, cihaz: 'normal' | 'tm' | 'pp' = 'normal'): Promise<{ uygulama?: Promise<string> }> {
  const zaman = await markCooked(id, g, cihaz)
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
    // Yalnizca Normal tarif degisir; TM7 / Pilav uyarlamalari silinmez, ustlerinde "yeniden uyarla" uyarisi cikar
    await lzDb.recipes.update(id, { ingredients: malzeme, steps: adim, pisirmeler, normalDegisti: Date.now(), updatedAt: Date.now() })
    const n = [...malzeme, ...adim].filter((x) => x.endsWith('✎')).length
    return n ? `Tarif güncellendi; ${n} satır ✎ ile işaretlendi.` : 'Tarife uygulandı; değişen satır bulunmadı.'
  } catch (e) {
    return `Tarif değişmedi (${(e as Error).message}); değişiklik günlükte kaldı.`
  }
}

// Kaydin numaralari tarihe gore yeniden verilir (gunlukten onceki, tarihsiz pisirmeler sayida kalir)
function numarala(liste: import('../types').PisirmeKaydi[], sayi: number) {
  const sirali = [...liste].sort((a, b) => a.zaman - b.zaman)
  const once = Math.max(0, sayi - sirali.length)
  return sirali.map((p, i) => ({ ...p, no: once + i + 1 }))
}

// Gunluk satirini sil: sayi 1 azalir, son pisirme tarihi kalan en yeni kayda gore guncellenir
export async function kaydiSil(id: number, zaman: number): Promise<void> {
  const r = await lzDb.recipes.get(id)
  if (!r?.pisirmeler?.some((p) => p.zaman === zaman)) return
  const kalan = r.pisirmeler.filter((p) => p.zaman !== zaman)
  const sayi = Math.max(0, (r.cookCount ?? 0) - 1)
  const enYeni = kalan.reduce((m, p) => Math.max(m, p.zaman), 0)
  // Kalan kayit yoksa tarih bilinmez (gunlukten onceki pisirmelerin tarihi yok): son tarih silinir, uydurulmaz
  const lastCookedAt = enYeni
  await lzDb.recipes.update(id, { cookCount: sayi, lastCookedAt, pisirmeler: numarala(kalan, sayi) })
}

// Gunluk satirini duzenle (sayi ve tarih degismez)
export async function kaydiDuzenle(id: number, zaman: number, g: GunlukGirdi): Promise<void> {
  const r = await lzDb.recipes.get(id)
  if (!r?.pisirmeler) return
  const pisirmeler = r.pisirmeler.map((p) => {
    if (p.zaman !== zaman) return p
    const y = { ...p, degisiklik: g.degisiklik, deneyim: g.deneyim, sonuc: g.sonuc }
    delete y.not // eski "not" artik "Nasil oldu" alaninda
    for (const k of ['degisiklik', 'deneyim', 'sonuc'] as const) if (!y[k]) delete y[k]
    return y
  })
  await lzDb.recipes.update(id, { pisirmeler })
}

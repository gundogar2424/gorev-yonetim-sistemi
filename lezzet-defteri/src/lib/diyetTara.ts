// DIYET OGUNLERI ↔ TARIFLER: her ogun icin defterdeki tariflerin uyumu
// yapay zekayla bulunur ve diyet kaydinda saklanir. Yeni eklenen tarifler
// sonradan yalnizca kendileri taranir; plan degisince sonuclar sifirlanir.
import { useSyncExternalStore } from 'react'
import { listRecipes, lzDb, updateRecipe } from '../db'
import type { LzOgunEslesme } from '../types'
import { aiOgunEslestir, apiAnahtari } from './ai'

const PARTI = 40

// OGUN TURU KONTROLU (yapay zekasiz): ara ogune ana yemek, kahvaltiya aksam yemegi, ana ogune tatli onerilmez.
// Kalorisi tutsa bile tur uymuyorsa "uygun degil" sayilir; hem yeni taramada hem kayitli sonuclarda uygulanir.
type OgunTuru = 'ara' | 'kahvalti' | 'ana' | ''
export function ogunTuru(o: { ad: string; icerik?: string }): OgunTuru {
  const t = o.ad.toLocaleLowerCase('tr')
  if (/ara\s*öğün|ara\s*ogun|atıştırma|ikindi|snack|gece/.test(t)) return 'ara'
  if (/kahvalt/.test(t)) return 'kahvalti'
  if (/öğle|akşam|ogle|aksam/.test(t)) return 'ana'
  return ''
}
const ANA_YEMEK =
  /tavuk|(^|\s)(et|etli)(\s|$)|kıyma|köfte|kebap|kebab|börek|makarna|spagetti|pilav|bulgur pilav|taco|pizza|lahmacun|pide|güveç|kavurma|dolma|sarma|mantı|burger|hamburger|lazanya|çorba|yahni|musakka|karnıyarık|tantuni|döner|şnitzel|şinitzel|biftek|pirzola|balık|somon|levrek|hamsi|fajita|wrap|dürüm|kumpir|tost|sandviç|güveç|fırında .*(tavuk|et|köfte|patates)|patlıcan|sebze yemeği|kuru fasulye|nohut yemeği|mercimek yemeği/
export function turUyumsuz(o: { ad: string; icerik?: string }, r: { title: string; tags?: string[] }): string {
  const tur = ogunTuru(o)
  const ad = r.title.toLocaleLowerCase('tr')
  const tag = new Set(r.tags ?? [])
  const anaYemek = tag.has('Ana Yemek') || tag.has('Akşam Yemeği') || tag.has('Çorba') || tag.has('Hamur İşi') || tag.has('Zeytinyağlı') || ANA_YEMEK.test(ad)
  const hafif = tag.has('Tatlı') || tag.has('Aperatif') || tag.has('İçecek') || /smoothie|kase|bowl|yoğurt|puding|bar\b|top\b|toplar|kurabiye|muffin|cheesecake|tiramisu|meyve|kuruyemiş|granola|chia|overnight|milkshake|shake/.test(ad)
  if (tur === 'ara' && anaYemek && !hafif) return 'Ana yemek; ara öğün için uygun değil.'
  if (tur === 'kahvalti' && (tag.has('Ana Yemek') || tag.has('Akşam Yemeği') || tag.has('Çorba')) && !tag.has('Kahvaltılık')) return 'Ana yemek; kahvaltılık değil.'
  if (tur === 'ana' && (tag.has('Tatlı') || tag.has('İçecek')) && !anaYemek) return 'Tatlı/içecek; ana öğün yerine geçmez.'
  return ''
}

type Durum = Record<number, { calisiyor: boolean; hata: string }>
let durum: Durum = {}
const dinleyiciler = new Set<() => void>()
function durumYaz(i: number, v: { calisiyor: boolean; hata: string }) {
  durum = { ...durum, [i]: v }
  dinleyiciler.forEach((f) => f())
}
export function useTaramaDurumu(): Durum {
  return useSyncExternalStore(
    (f) => {
      dinleyiciler.add(f)
      return () => dinleyiciler.delete(f)
    },
    () => durum
  )
}

const calisan = new Map<number, Promise<void>>()

// bastan: true ise onceki sonuc silinip tum tarifler yeniden degerlendirilir
export function ogunTara(i: number, bastan = false): Promise<void> {
  const var_ = calisan.get(i)
  if (var_) return var_
  const is = (async () => {
    durumYaz(i, { calisiyor: true, hata: '' })
    try {
      const plan = await lzDb.diyet.get(1)
      const ogun = plan?.ogunler[i]
      if (!plan || !ogun) return
      const planZamani = plan.guncelleme
      const onceki: LzOgunEslesme = (!bastan && plan.eslesme?.[i]) || { sonuc: [], bakilan: [], zaman: 0 }
      const bakilan = new Set(onceki.bakilan)
      const tarifler = (await listRecipes()).filter((r) => r.ingredients.length > 0)
      const aday = tarifler.filter((r) => !bakilan.has(r.id!))
      let sonuc = onceki.sonuc
      for (let p = 0; p < aday.length; p += PARTI) {
        const parti = aday.slice(p, p + PARTI)
        const s = (
          await aiOgunEslestir(
            ogun,
            plan.notlar,
            parti.map((r) => ({ id: r.id!, baslik: r.title, porsiyon: r.servings, malzemeler: r.ingredients, bilinen: r.besin, etiketler: r.tags }))
          )
        ).map((x) => {
          const r = parti.find((t) => t.id === x.tarifId)
          const neden = r ? turUyumsuz(ogun, r) : ''
          return neden ? { ...x, durum: 'uygun_degil' as const, aciklama: neden } : x
        })
        // 1 porsiyonun besin degeri tarife kaydedilir (sonraki taramalarda tekrar hesaplanmaz)
        for (const x of s) {
          const r = parti.find((t) => t.id === x.tarifId)
          if (r && !r.besin) await updateRecipe(r.id!, { besin: x.porsiyonBesin })
        }
        sonuc = [...sonuc.filter((x) => !s.some((y) => y.tarifId === x.tarifId)), ...s]
        parti.forEach((r) => bakilan.add(r.id!))
        // Her partiden sonra kaydet (plan bu arada degistiyse yazma)
        const guncel = await lzDb.diyet.get(1)
        if (!guncel || guncel.guncelleme !== planZamani) return
        await lzDb.diyet.update(1, { eslesme: { ...(guncel.eslesme ?? {}), [i]: { sonuc, bakilan: [...bakilan], zaman: Date.now() } } })
      }
      if (!aday.length && bastan) {
        await lzDb.diyet.update(1, { eslesme: { ...(plan.eslesme ?? {}), [i]: { sonuc: [], bakilan: [], zaman: Date.now() } } })
      }
      durumYaz(i, { calisiyor: false, hata: '' })
    } catch (e) {
      durumYaz(i, { calisiyor: false, hata: (e as Error).message })
    } finally {
      calisan.delete(i)
      if (durum[i]?.calisiyor) durumYaz(i, { calisiyor: false, hata: '' })
    }
  })()
  calisan.set(i, is)
  return is
}

// Plan yuklenince tum ogunler sirayla taranir
export async function tumOgunleriTara(): Promise<void> {
  if (!apiAnahtari()) return
  const plan = await lzDb.diyet.get(1)
  for (let i = 0; i < (plan?.ogunler.length ?? 0); i++) await ogunTara(i)
}

// Taranmamis (yeni eklenmis) tarif sayisi
export function yeniTarifSayisi(e: LzOgunEslesme | undefined, tarifIdleri: number[]): number {
  const b = new Set(e?.bakilan ?? [])
  return tarifIdleri.filter((id) => !b.has(id)).length
}

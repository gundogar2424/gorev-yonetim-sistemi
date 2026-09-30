// DIYET OGUNLERI ↔ TARIFLER: her ogun icin defterdeki tariflerin uyumu
// yapay zekayla bulunur ve diyet kaydinda saklanir. Yeni eklenen tarifler
// sonradan yalnizca kendileri taranir; plan degisince sonuclar sifirlanir.
import { useSyncExternalStore } from 'react'
import { listRecipes, lzDb, updateRecipe } from '../db'
import type { LzOgunEslesme } from '../types'
import { aiOgunEslestir, apiAnahtari } from './ai'

const PARTI = 40

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
        const s = await aiOgunEslestir(
          ogun,
          plan.notlar,
          parti.map((r) => ({ id: r.id!, baslik: r.title, porsiyon: r.servings, malzemeler: r.ingredients, bilinen: r.besin }))
        )
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

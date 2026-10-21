// Lezzet Defteri yedegi: tarifler, sofralar, haftalik plan ve alisveris listesi
// tek JSON dosyasina indirilir; istenince geri yuklenir. API anahtari YAZILMAZ.
import { lzDb } from '../db'
import type { LzDiyet, LzMekan, LzPlan, LzRecipe, LzShopItem, LzTable } from '../types'

interface LzBackup {
  app: 'lezzet-defteri'
  version: 1
  exportedAt: number
  recipes: LzRecipe[]
  tables: LzTable[]
  plans: LzPlan[]
  shopping: LzShopItem[]
  diyet?: LzDiyet[]
  mekanlar?: LzMekan[]
  ayarlar?: Record<string, string> // takip edilen influencer'lar, fotograflari, kendi etiketlerim, profil… (API anahtari YOK)
}

// Yedege giren telefon ayarlari; anahtarlar ve gecici onbellekler girmez
const AYAR_ANAHTARLARI = ['lz-yemek-hesaplari', 'lz-hesap-cikan', 'lz-hesap-aday', 'lz-hesap-foto', 'lz-hesap-oto', 'lz-kendi-etiketler', 'lz-profil', 'lz-gezi', 'lz-theme', 'lz-shop-grup', 'lz-tasarruf', 'lz-gunluk-sinir']
function ayarlariOku(): Record<string, string> {
  const a: Record<string, string> = {}
  for (const k of AYAR_ANAHTARLARI) {
    try {
      const v = localStorage.getItem(k)
      if (v !== null) a[k] = v
    } catch {
      /* yok */
    }
  }
  return a
}
// Geri yuklerken: listeler birlestirilir, fotograflar eklenir, digerleri telefonda yoksa yazilir
function ayarlariYukle(a: Record<string, string> | undefined): void {
  if (!a) return
  for (const k of AYAR_ANAHTARLARI) {
    const yeni = a[k]
    if (yeni === undefined) continue
    try {
      const eski = localStorage.getItem(k)
      if (eski === null) {
        localStorage.setItem(k, yeni)
        continue
      }
      const e = JSON.parse(eski) as unknown
      const y = JSON.parse(yeni) as unknown
      if (Array.isArray(e) && Array.isArray(y)) localStorage.setItem(k, JSON.stringify([...new Set([...e, ...y])]))
      else if (e && y && typeof e === 'object' && typeof y === 'object') localStorage.setItem(k, JSON.stringify({ ...(y as object), ...(e as object) }))
    } catch {
      /* duz metin ayar: telefondaki kalir */
    }
  }
}

export async function downloadBackup(): Promise<void> {
  const data: LzBackup = {
    app: 'lezzet-defteri',
    version: 1,
    exportedAt: Date.now(),
    recipes: await lzDb.recipes.toArray(),
    tables: await lzDb.sofralar.toArray(),
    plans: await lzDb.plans.toArray(),
    shopping: await lzDb.shopping.toArray(),
    diyet: await lzDb.diyet.toArray(),
    mekanlar: await lzDb.mekanlar.toArray(),
    ayarlar: ayarlariOku()
  }
  const metin = JSON.stringify(data)
  const d = new Date()
  const ad = `lezzet-rotasi-yedek-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`
  // Telefonda (APK) indirme baglantisi calismaz: dosya yazilip paylasim menusu acilir (Drive, e-posta, WhatsApp, Dosyalar…)
  const { Capacitor } = await import('@capacitor/core')
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
    const { Share } = await import('@capacitor/share')
    const yaz = await Filesystem.writeFile({ path: ad, data: metin, directory: Directory.Cache, encoding: Encoding.UTF8 })
    await Share.share({ title: 'Lezzet Rotası yedeği', dialogTitle: 'Yedeği kaydet (Drive, e-posta…)', files: [yaz.uri] })
    return
  }
  const blob = new Blob([metin], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = ad
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Geri yukleme mevcut veriyi SILMEZ; yedektekiler eklenir. Ayni baslikli tarif
// ve ayni adli sofra atlanir. Kimlikler yeniden verildigi icin tarif-sofra ve
// plan-tarif baglari eski->yeni kimlik eslemesiyle kurulur.
export async function restoreBackup(file: File): Promise<{ eklendi: number; atlandi: number; mekan: number }> {
  let data: LzBackup
  try {
    data = JSON.parse(await file.text()) as LzBackup
  } catch {
    throw new Error('Dosya okunamadı. Geçerli bir yedek dosyası seç.')
  }
  if (data?.app !== 'lezzet-defteri' || !Array.isArray(data.recipes)) {
    throw new Error('Bu dosya Lezzet Rotası yedeği değil.')
  }

  let eklendi = 0
  let atlandi = 0
  let mekan = 0
  await lzDb.transaction('rw', [lzDb.recipes, lzDb.sofralar, lzDb.plans, lzDb.shopping, lzDb.diyet, lzDb.mekanlar], async () => {
    // Mekanlar: ayni adli ve ayni sehirdeki mekan atlanir
    const mevcutMekan = await lzDb.mekanlar.toArray()
    const mk = (m: LzMekan) => `${m.ad}|${m.sehir}`.toLocaleLowerCase('tr')
    for (const m of data.mekanlar ?? []) {
      if (mevcutMekan.some((x) => mk(x) === mk(m))) continue
      const { id: _id, ...rest } = m
      await lzDb.mekanlar.add(rest)
      mekan++
    }
    // Diyet plani: telefonda plan yoksa yedektekini al (varsa uzerine yazma)
    ayarlariYukle(data.ayarlar)
    if (data.diyet?.[0] && !(await lzDb.diyet.get(1))) await lzDb.diyet.put({ ...data.diyet[0], id: 1, eslesme: undefined })
    const sofraEsle = new Map<number, number>()
    const mevcutSofra = await lzDb.sofralar.toArray()
    for (const t of data.tables ?? []) {
      const ayni = mevcutSofra.find((m) => m.name.toLocaleLowerCase('tr') === t.name.toLocaleLowerCase('tr'))
      if (ayni) sofraEsle.set(t.id!, ayni.id!)
      else {
        const { id, ...rest } = t
        sofraEsle.set(id!, await lzDb.sofralar.add(rest))
      }
    }

    const tarifEsle = new Map<number, number>()
    const mevcut = await lzDb.recipes.toArray()
    const baslik = (s: string) => s.trim().toLocaleLowerCase('tr')
    for (const r of data.recipes) {
      const ayni = mevcut.find((m) => baslik(m.title) === baslik(r.title ?? ''))
      if (ayni) {
        tarifEsle.set(r.id!, ayni.id!)
        atlandi++
        continue
      }
      const { id, ...rest } = r
      const now = Date.now()
      const yeni = await lzDb.recipes.add({
        ...rest,
        title: rest.title || 'Adsız tarif',
        photo: rest.photo ?? '',
        sourceUrl: rest.sourceUrl ?? '',
        platform: rest.platform ?? 'manual',
        author: rest.author ?? '',
        servings: rest.servings ?? 0,
        minutes: rest.minutes ?? 0,
        ingredients: rest.ingredients ?? [],
        steps: rest.steps ?? [],
        notes: rest.notes ?? '',
        tags: rest.tags ?? [],
        tableIds: (rest.tableIds ?? []).map((t) => sofraEsle.get(t)).filter((t): t is number => !!t),
        favorite: rest.favorite ? 1 : 0,
        cookCount: rest.cookCount ?? 0,
        lastCookedAt: rest.lastCookedAt ?? 0,
        createdAt: rest.createdAt ?? now,
        updatedAt: rest.updatedAt ?? now
      })
      tarifEsle.set(id!, yeni)
      eklendi++
    }

    for (const p of data.plans ?? []) {
      const rid = tarifEsle.get(p.recipeId)
      if (!rid) continue
      const var_ = await lzDb.plans.where('date').equals(p.date).filter((x) => x.meal === p.meal && x.recipeId === rid).count()
      if (!var_) await lzDb.plans.add({ date: p.date, meal: p.meal, recipeId: rid, createdAt: p.createdAt ?? Date.now() })
    }

    const acik = new Set((await lzDb.shopping.toArray()).map((i) => i.text.toLocaleLowerCase('tr')))
    for (const i of data.shopping ?? []) {
      if (acik.has(i.text.toLocaleLowerCase('tr'))) continue
      const { id: _id, ...rest } = i
      await lzDb.shopping.add({ ...rest, recipeId: tarifEsle.get(rest.recipeId) ?? 0 })
    }
  })
  return { eklendi, atlandi, mekan }
}

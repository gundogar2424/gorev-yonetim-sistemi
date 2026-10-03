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
    mekanlar: await lzDb.mekanlar.toArray()
  }
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const d = new Date()
  a.href = url
  a.download = `lezzet-defteri-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Geri yukleme mevcut veriyi SILMEZ; yedektekiler eklenir. Ayni baslikli tarif
// ve ayni adli sofra atlanir. Kimlikler yeniden verildigi icin tarif-sofra ve
// plan-tarif baglari eski->yeni kimlik eslemesiyle kurulur.
export async function restoreBackup(file: File): Promise<{ eklendi: number; atlandi: number }> {
  let data: LzBackup
  try {
    data = JSON.parse(await file.text()) as LzBackup
  } catch {
    throw new Error('Dosya okunamadı. Geçerli bir yedek dosyası seç.')
  }
  if (data?.app !== 'lezzet-defteri' || !Array.isArray(data.recipes)) {
    throw new Error('Bu dosya Lezzet Defteri yedeği değil.')
  }

  let eklendi = 0
  let atlandi = 0
  await lzDb.transaction('rw', [lzDb.recipes, lzDb.sofralar, lzDb.plans, lzDb.shopping, lzDb.diyet, lzDb.mekanlar], async () => {
    // Mekanlar: ayni adli ve ayni sehirdeki mekan atlanir
    const mevcutMekan = await lzDb.mekanlar.toArray()
    const mk = (m: LzMekan) => `${m.ad}|${m.sehir}`.toLocaleLowerCase('tr')
    for (const m of data.mekanlar ?? []) {
      if (mevcutMekan.some((x) => mk(x) === mk(m))) continue
      const { id: _id, ...rest } = m
      await lzDb.mekanlar.add(rest)
    }
    // Diyet plani: telefonda plan yoksa yedektekini al (varsa uzerine yazma)
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
  return { eklendi, atlandi }
}

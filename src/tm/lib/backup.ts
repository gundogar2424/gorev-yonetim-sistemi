// Termomiks Defteri yedegi: tum tarifler tek bir JSON dosyasina indirilir,
// istenince geri yuklenir. Diyet Kocu'nun yedegiyle karismaz (app alani farkli).
import { addRecipe, tmDb } from '../db'
import { parseRecipeCode } from './recipeIO'
import type { TmRecipe } from '../types'

interface TmBackup {
  app: 'termomiks-defter'
  version: number
  exportedAt: number
  recipes: TmRecipe[]
}

export async function buildBackup(): Promise<TmBackup> {
  const recipes = await tmDb.recipes.toArray()
  return { app: 'termomiks-defter', version: 1, exportedAt: Date.now(), recipes }
}

export async function downloadBackup(): Promise<void> {
  const data = await buildBackup()
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const d = new Date()
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  a.href = url
  a.download = `termomiks-defter-${stamp}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Disaridan gelen kayitta eksik olabilecek ic alanlari doldurur. Elle
// hazirlanmis bir tarif dosyasinda favorite/updatedAt gibi alanlar bulunmaz;
// bunlar olmadan tarif veritabanina girer ama listede gorunmez.
function tamamla(r: TmRecipe): TmRecipe {
  const now = Date.now()
  return {
    ...r,
    title: r.title?.trim() || 'Adsız tarif',
    category: r.category || 'Diğer',
    servings: r.servings ?? 0,
    minutes: r.minutes ?? 0,
    ingredients: r.ingredients ?? [],
    steps: r.steps ?? [],
    notes: r.notes ?? '',
    warnings: r.warnings ?? [],
    source: r.source ?? '',
    originalText: r.originalText ?? '',
    origin: r.origin ?? 'ai',
    photo: r.photo ?? '',
    video: r.video ?? '',
    favorite: r.favorite ? 1 : 0,
    cookCount: r.cookCount ?? 0,
    lastCookedAt: r.lastCookedAt ?? 0,
    createdAt: r.createdAt ?? now,
    updatedAt: r.updatedAt ?? now
  }
}

// Yedegi geri yukler. Mevcut tarifler SILINMEZ; yedektekiler eklenir
// (ayni baslik + ayni adim sayisi varsa atlanir, kopya birikmesin).
export async function restoreBackup(file: File): Promise<{ eklendi: number; atlandi: number }> {
  const text = await file.text()
  let data: TmBackup
  try {
    data = JSON.parse(text) as TmBackup
  } catch {
    throw new Error('Dosya okunamadı. Geçerli bir yedek dosyası seç.')
  }
  if (data?.app !== 'termomiks-defter' || !Array.isArray(data.recipes)) {
    throw new Error('Bu dosya Termomiks Defteri yedeği değil.')
  }
  const mevcut = await tmDb.recipes.toArray()
  const anahtar = (r: TmRecipe) => `${r.title.trim().toLowerCase()}|${r.steps?.length ?? 0}`
  const varOlan = new Set(mevcut.map(anahtar))

  let eklendi = 0
  let atlandi = 0
  for (const r of data.recipes) {
    if (varOlan.has(anahtar(r))) {
      atlandi++
      continue
    }
    const { id: _id, ...rest } = r
    await tmDb.recipes.add(tamamla(rest as TmRecipe))
    eklendi++
  }
  return { eklendi, atlandi }
}


// TARIF DOSYASI. Yedek dosyasi disinda, icinde dogrudan tarif(ler) olan bir
// JSON dosyasi da secilebilsin diye: once yedek olarak denenir, olmazsa
// tarif kodu cozumleyicisine verilir. Boylece hazirlanmis bir tarif dosyasi
// (fotografi gomulu olabilir) tek dokunusla deftere eklenir.
export async function tarifDosyasiYukle(file: File): Promise<{ eklendi: number; atlandi: number }> {
  try {
    return await restoreBackup(file)
  } catch {
    // Yedek degilse: duz tarif dosyasi olarak oku
  }
  const metin = await file.text()
  const liste = parseRecipeCode(metin) // gecersizse anlasilir hata firlatir
  const mevcut = await tmDb.recipes.toArray()
  const anahtar = (baslik: string, adim: number) => `${baslik.trim().toLowerCase()}|${adim}`
  const varOlan = new Set(mevcut.map((r) => anahtar(r.title, r.steps?.length ?? 0)))

  let eklendi = 0
  let atlandi = 0
  for (const { recipe, source } of liste) {
    if (varOlan.has(anahtar(recipe.title, recipe.steps.length))) {
      atlandi++
      continue
    }
    await addRecipe(recipe, { source, origin: 'ai' })
    eklendi++
  }
  return { eklendi, atlandi }
}

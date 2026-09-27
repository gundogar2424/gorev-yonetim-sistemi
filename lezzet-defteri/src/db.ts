// Lezzet Defteri icin AYRI bir Dexie (IndexedDB) veritabani: 'lezzet-defteri'.
// Diger programlarin veritabanlarina dokunmaz.
import Dexie, { type Table } from 'dexie'
import type { LzDiyet, LzDraft, LzMeal, LzPlan, LzRecipe, LzShopItem, LzTable } from './types'

export class LezzetDB extends Dexie {
  recipes!: Table<LzRecipe, number>
  sofralar!: Table<LzTable, number>
  plans!: Table<LzPlan, number>
  shopping!: Table<LzShopItem, number>
  diyet!: Table<LzDiyet, number>

  constructor() {
    super('lezzet-defteri')
    this.version(1).stores({
      recipes: '++id, title, favorite, updatedAt, createdAt, *tableIds',
      sofralar: '++id, name',
      plans: '++id, date, recipeId',
      shopping: '++id, done, recipeId, createdAt'
    })
    // v2: diyetisyen plani (tek kayit, id = 1)
    this.version(2).stores({ diyet: 'id' })
  }
}

export const lzDb = new LezzetDB()

// --- Tarifler -------------------------------------------------------------

export async function listRecipes(): Promise<LzRecipe[]> {
  // Hepsini alip elde sirala: disaridan gelen kayitta updatedAt eksikse
  // indeksli sorgu o kaydi atar, tarif listede gorunmez.
  const hepsi = await lzDb.recipes.toArray()
  return hepsi.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
}

export async function addRecipe(d: LzDraft, tableIds: number[] = []): Promise<number> {
  const now = Date.now()
  return lzDb.recipes.add({
    title: d.title.trim() || 'Adsız tarif',
    photo: d.photo ?? '',
    sourceUrl: d.sourceUrl ?? '',
    platform: d.platform ?? 'manual',
    author: d.author ?? '',
    servings: d.servings || 0,
    minutes: d.minutes || 0,
    ingredients: clean(d.ingredients),
    steps: clean(d.steps),
    notes: d.notes ?? '',
    tags: d.tags ?? [],
    tableIds,
    favorite: 0,
    cookCount: 0,
    lastCookedAt: 0,
    createdAt: now,
    updatedAt: now
  })
}

export async function updateRecipe(id: number, patch: Partial<LzRecipe>): Promise<void> {
  const p = { ...patch, updatedAt: Date.now() }
  if (p.ingredients) p.ingredients = clean(p.ingredients)
  if (p.steps) p.steps = clean(p.steps)
  await lzDb.recipes.update(id, p)
}

export async function deleteRecipe(id: number): Promise<void> {
  await lzDb.transaction('rw', lzDb.recipes, lzDb.plans, async () => {
    await lzDb.recipes.delete(id)
    await lzDb.plans.where('recipeId').equals(id).delete()
  })
}

export async function toggleFavorite(id: number): Promise<void> {
  const r = await lzDb.recipes.get(id)
  if (r) await lzDb.recipes.update(id, { favorite: r.favorite ? 0 : 1 })
}

export async function markCooked(id: number): Promise<void> {
  const r = await lzDb.recipes.get(id)
  if (r) await lzDb.recipes.update(id, { cookCount: (r.cookCount ?? 0) + 1, lastCookedAt: Date.now() })
}

function clean(lines: string[] | undefined): string[] {
  return (lines ?? []).map((s) => s.trim()).filter(Boolean)
}

// --- Sofralar -------------------------------------------------------------

export async function addTable(name: string, emoji: string, notes = ''): Promise<number> {
  return lzDb.sofralar.add({ name: name.trim() || 'Sofra', emoji: emoji || '🍽️', notes: notes.trim(), createdAt: Date.now() })
}

export async function deleteTable(id: number): Promise<void> {
  await lzDb.transaction('rw', lzDb.sofralar, lzDb.recipes, async () => {
    await lzDb.sofralar.delete(id)
    const ilgili = await lzDb.recipes.where('tableIds').equals(id).toArray()
    for (const r of ilgili) {
      await lzDb.recipes.update(r.id!, { tableIds: r.tableIds.filter((t) => t !== id) })
    }
  })
}

// --- Haftalik plan --------------------------------------------------------

export async function addPlan(date: string, meal: LzMeal, recipeId: number): Promise<void> {
  await lzDb.plans.add({ date, meal, recipeId, createdAt: Date.now() })
}

// --- Alisveris ------------------------------------------------------------

// Tarifin malzemelerini listeye ekler. Listede ayni satir (tamamlanmamis)
// zaten varsa tekrar eklemez. Eklenen satir sayisini dondurur.
export async function addToShopping(lines: string[], recipeId = 0, recipeTitle = ''): Promise<number> {
  const mevcut = await lzDb.shopping.where('done').equals(0).toArray()
  const var_ = new Set(mevcut.map((i) => i.text.trim().toLocaleLowerCase('tr')))
  let n = 0
  const now = Date.now()
  for (const raw of lines) {
    const text = raw.trim()
    if (!text) continue
    // Tariften gelen "2 su bardağı sıcak su" gibi satirlar markette alinmaz
    if (recipeId && /(^|\s)((sıcak|soğuk|ılık|kaynar|kaynamış|içme)\s+)?su$/i.test(text.toLocaleLowerCase('tr'))) continue
    const k = text.toLocaleLowerCase('tr')
    if (var_.has(k)) continue
    var_.add(k)
    await lzDb.shopping.add({ text, done: 0, recipeId, recipeTitle, createdAt: now + n })
    n++
  }
  return n
}

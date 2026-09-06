// Termomiks Defteri icin AYRI bir Dexie (IndexedDB) veritabani.
// Adi 'termomiks-defter'; CRM'in ve Diyet Kocu'nun veritabanina dokunmaz.
import Dexie, { type Table } from 'dexie'
import type { TmRecipe, TmSettings, TmConversion } from './types'

export class TermomiksDB extends Dexie {
  recipes!: Table<TmRecipe, number>
  settings!: Table<TmSettings, number>

  constructor() {
    super('termomiks-defter')
    this.version(1).stores({
      // favorite/updatedAt indekslidir: favori suzmesi ve "son eklenen" siralamasi hizli olsun
      recipes: '++id, title, category, favorite, updatedAt, lastCookedAt',
      settings: 'id'
    })
  }
}

export const tmDb = new TermomiksDB()

const DEFAULT_SETTINGS: TmSettings = {
  id: 1,
  autoAdvance: true,
  sound: true,
  notify: true,
  keepAwake: true
}

export async function readTmSettings(): Promise<TmSettings> {
  const s = await tmDb.settings.get(1)
  return { ...DEFAULT_SETTINGS, ...(s ?? {}), id: 1 }
}

export async function saveTmSettings(patch: Partial<TmSettings>): Promise<void> {
  const cur = await readTmSettings()
  await tmDb.settings.put({ ...cur, ...patch, id: 1 })
}

// --- Tarifler -------------------------------------------------------------

export function listRecipes(): Promise<TmRecipe[]> {
  // En son guncellenen en ustte
  return tmDb.recipes.orderBy('updatedAt').reverse().toArray()
}

export function getRecipe(id: number): Promise<TmRecipe | undefined> {
  return tmDb.recipes.get(id)
}

// Yapistirilan koddan gelen (ya da elle girilen) tarifi deftere kaydeder.
export async function addRecipe(
  data: TmConversion,
  extra: { source?: string; originalText?: string; origin?: 'ai' | 'manual' } = {}
): Promise<number> {
  const now = Date.now()
  return tmDb.recipes.add({
    title: data.title.trim() || 'Adsız tarif',
    category: data.category || 'Diğer',
    servings: data.servings || 0,
    minutes: data.minutes || 0,
    ingredients: data.ingredients ?? [],
    steps: data.steps ?? [],
    notes: data.notes ?? '',
    warnings: data.warnings ?? [],
    photo: data.photo ?? '',
    source: extra.source ?? '',
    originalText: extra.originalText ?? '',
    origin: extra.origin ?? 'ai',
    favorite: 0,
    cookCount: 0,
    lastCookedAt: 0,
    createdAt: now,
    updatedAt: now
  })
}

export async function updateRecipe(id: number, patch: Partial<TmRecipe>): Promise<void> {
  await tmDb.recipes.update(id, { ...patch, updatedAt: Date.now() })
}

export async function deleteRecipe(id: number): Promise<void> {
  await tmDb.recipes.delete(id)
}

export async function toggleFavorite(id: number): Promise<void> {
  const r = await tmDb.recipes.get(id)
  if (!r) return
  await tmDb.recipes.update(id, { favorite: r.favorite ? 0 : 1 })
}

// Pisirme modu sonuna gelindiginde cagrilir: sayac + son pisirme tarihi.
export async function markCooked(id: number): Promise<void> {
  const r = await tmDb.recipes.get(id)
  if (!r) return
  await tmDb.recipes.update(id, { cookCount: (r.cookCount ?? 0) + 1, lastCookedAt: Date.now() })
}

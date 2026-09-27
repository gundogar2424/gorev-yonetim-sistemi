// Lezzet Defteri veri tipleri.
import type { TmSurum } from './lib/tm7'
// Diger programlarla (CRM, Diyet Kocu, Termomiks...) HICBIR tip/tablo paylasmaz.

// Tarifin geldigi yer. Listede kucuk rozet olarak gosterilir.
export type LzPlatform = 'instagram' | 'tiktok' | 'youtube' | 'pinterest' | 'facebook' | 'web' | 'manual'

export interface LzRecipe {
  id?: number
  title: string
  photo: string // data URI (cihazda saklanir). Bos olabilir.
  sourceUrl: string // Tarifin alindigi paylasim/sayfa adresi. Bos olabilir.
  platform: LzPlatform
  author: string // Paylasan hesap / site adi (bos olabilir)
  servings: number // Kac kisilik (0 = belirtilmemis)
  minutes: number // Toplam sure, dakika (0 = belirtilmemis)
  ingredients: string[] // "2 su bardağı un" gibi serbest satirlar
  steps: string[]
  notes: string
  tags: string[] // Akşam Yemeği, Tatlı, Pratik...
  tableIds: number[] // Hangi sofralara ait (Kocam, Çocuklar...)
  tm?: TmSurum // Thermomix TM7 uyarlamasi (varsa)
  favorite: 0 | 1 // Dexie boolean indeksleyemez
  cookCount: number
  lastCookedAt: number
  createdAt: number
  updatedAt: number
}

// "Sofra": tarifleri kisilere / ortamlara gore toplayan grup
// (orn. "Kocam", "Canım Kızım", "Misafir sofrası").
export interface LzTable {
  id?: number
  name: string
  emoji: string
  notes?: string // Sevmedikleri, alerjileri, beslenme bicimi (yapay zeka dikkate alir)
  createdAt: number
}

export type LzMeal = 'kahvalti' | 'ogle' | 'aksam'

// Haftalik plan satiri: bir gune bir ogun icin bir tarif.
export interface LzPlan {
  id?: number
  date: string // YYYY-MM-DD (yerel)
  meal: LzMeal
  recipeId: number
  createdAt: number
}

export interface LzShopItem {
  id?: number
  text: string
  done: 0 | 1
  recipeId: number // 0 = elle eklendi
  recipeTitle: string
  createdAt: number
}

// Linkten / metinden cikarilan, henuz kaydedilmemis tarif taslagi.
export interface LzDraft {
  title: string
  photo: string
  sourceUrl: string
  platform: LzPlatform
  author: string
  servings: number
  minutes: number
  ingredients: string[]
  steps: string[]
  notes: string
  tags: string[]
}

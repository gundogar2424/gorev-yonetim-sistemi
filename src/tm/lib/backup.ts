// Termomiks Defteri yedegi: tum tarifler tek bir JSON dosyasina indirilir,
// istenince geri yuklenir. Diyet Kocu'nun yedegiyle karismaz (app alani farkli).
import { tmDb } from '../db'
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
    await tmDb.recipes.add(rest as TmRecipe)
    eklendi++
  }
  return { eklendi, atlandi }
}

// Yeni kaydedilen tariflerin pilav pisirici uyarlamasini arka planda kendiliginden uretir.
// Ozellik ilk acildiginda var olan tarifler kapsanmaz (toplu harcama olmasin); onlar sekmeden tek tek uyarlanir.
import { lzDb, updateRecipe } from '../db'
import { ppAcik } from './pisirici'

const KEY_BASLANGIC = 'lz-pp-baslangic'
const denendi = new Set<number>()
let calisiyor = false

function baslangic(): number {
  try {
    const v = Number(localStorage.getItem(KEY_BASLANGIC))
    if (v) return v
    const simdi = Date.now()
    localStorage.setItem(KEY_BASLANGIC, String(simdi))
    return simdi
  } catch {
    return Date.now()
  }
}

export async function ppOtoUret(): Promise<void> {
  if (calisiyor || !ppAcik()) return
  const { aiPilavPisirici, apiAnahtari } = await import('./ai')
  if (!apiAnahtari()) return
  const bas = baslangic()
  calisiyor = true
  try {
    const bekleyen = (await lzDb.recipes.toArray()).filter((r) => !r.pp && (r.createdAt ?? 0) >= bas && !denendi.has(r.id!))
    for (const r of bekleyen) {
      denendi.add(r.id!)
      try {
        const pp = await aiPilavPisirici(r)
        const guncel = await lzDb.recipes.get(r.id!)
        if (guncel && !guncel.pp) await updateRecipe(r.id!, { pp })
      } catch (e) {
        // Gunluk sinir / kota: bugun icin dur, yarin acilista tekrar denenir
        if (/sınır|kota|quota|429|harcama/i.test(e instanceof Error ? e.message : String(e))) {
          denendi.delete(r.id!)
          break
        }
      }
    }
  } finally {
    calisiyor = false
  }
}

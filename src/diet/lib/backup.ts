// Diyet Kocu verisinin yedeklenmesi / geri yuklenmesi ve yer acma islemleri.
// Tum veri tek bir JSON dosyasina indirilir; istenince geri yuklenir.
import { dietDb } from '../db'
import type { DietEntry, Measurement, Vital, DietSettings, Exercise, Water, Steps, Sleep, ProgressPhoto, SavedProduct } from '../types'

interface DietBackup {
  app: 'diet-coach'
  version: number
  exportedAt: number
  entries: DietEntry[]
  measurements: Measurement[]
  vitals: Vital[]
  exercises: Exercise[]
  water: Water[]
  steps: Steps[]
  sleep: Sleep[]
  progress: ProgressPhoto[]
  products: SavedProduct[]
  settings: DietSettings | null
}

// Tum diyet verisini topla (yedek nesnesi)
export async function buildBackupData(): Promise<DietBackup> {
  const [entries, measurements, vitals, exercises, water, steps, sleep, progress, products, settingsRow] = await Promise.all([
    dietDb.entries.toArray(),
    dietDb.measurements.toArray(),
    dietDb.vitals.toArray(),
    dietDb.exercises.toArray(),
    dietDb.water.toArray(),
    dietDb.steps.toArray(),
    dietDb.sleep.toArray(),
    dietDb.progress.toArray(),
    dietDb.products.toArray(),
    dietDb.settings.toCollection().first()
  ])
  // API anahtari da yedege dahil edilir ki yeniden kurulumda tekrar girmek
  // gerekmesin. (Yedek dosyasi kisiseldir; baskasiyla paylasma.)
  const settings: DietSettings | null = settingsRow ? { ...settingsRow } : null
  // FOTOGRAFSIZ HAFIF YEDEK: yemek/ilerleme fotograflari (buyuk base64) yedege
  // ALINMAZ — boylece cok veride bile telefon hafizasi dolup COKMEZ. Kayitlarin
  // kendisi (tarih, ogun, deger...) tam olarak durur; sadece foto alani bos gider.
  // Not: fotograflar zaten her cihazda yerelde ve senkronda korunur.
  const entriesLite = entries.map((e) => ({ ...e, photo: '' }))
  const progressLite = progress.map((p) => ({ ...p, photo: '' }))
  return {
    app: 'diet-coach',
    version: 4,
    exportedAt: Date.now(),
    entries: entriesLite,
    measurements,
    vitals,
    exercises,
    water,
    steps,
    sleep,
    progress: progressLite,
    products,
    settings
  }
}

// Yedek dosyasini indir
export async function downloadDietBackup() {
  const data = await buildBackupData()
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const stamp = new Date().toISOString().slice(0, 10)
  a.href = url
  a.download = `diyet-yedek-${stamp}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  return data
}

// Yedek dosyasini cozumle ve dogrula
export function parseDietBackup(text: string): DietBackup {
  const j = JSON.parse(text)
  if (j?.app !== 'diet-coach' || !Array.isArray(j.entries)) {
    throw new Error('Bu dosya bir Diyet Koçu yedeği değil.')
  }
  return j as DietBackup
}

// Geri yukle. mode: 'replace' = mevcudu sil & yukle, 'merge' = uzerine ekle
export async function restoreDietBackup(b: DietBackup, mode: 'replace' | 'merge') {
  if (mode === 'replace') {
    await dietDb.entries.clear()
    await dietDb.measurements.clear()
    await dietDb.vitals.clear()
    await dietDb.exercises.clear()
    await dietDb.water.clear()
    await dietDb.steps.clear()
    await dietDb.sleep.clear()
    await dietDb.progress.clear()
    await dietDb.products.clear()
  }
  // id catismasini onlemek icin id'leri dusurerek ekle
  const strip = <T extends { id?: number }>(arr: T[]) => arr.map(({ id: _id, ...rest }) => rest)
  if (b.entries?.length) await dietDb.entries.bulkAdd(strip(b.entries) as DietEntry[])
  if (b.measurements?.length) await dietDb.measurements.bulkAdd(strip(b.measurements) as Measurement[])
  if (b.vitals?.length) await dietDb.vitals.bulkAdd(strip(b.vitals) as Vital[])
  if (b.exercises?.length) await dietDb.exercises.bulkAdd(strip(b.exercises) as Exercise[])
  if (b.water?.length) await dietDb.water.bulkAdd(strip(b.water) as Water[])
  if (b.steps?.length) await dietDb.steps.bulkAdd(strip(b.steps) as Steps[])
  if (b.sleep?.length) await dietDb.sleep.bulkAdd(strip(b.sleep) as Sleep[])
  if (b.progress?.length) await dietDb.progress.bulkAdd(strip(b.progress) as ProgressPhoto[])
  if (b.products?.length) await dietDb.products.bulkAdd(strip(b.products) as SavedProduct[])
  // Ayarlar (apiKey haric) yedekte varsa, mevcut ayara isle
  if (b.settings) {
    const cur = await dietDb.settings.toCollection().first()
    const patch = { ...b.settings }
    delete patch.id
    if (cur?.id != null) await dietDb.settings.update(cur.id, patch)
    else await dietDb.settings.add(patch)
  }
  return {
    entries: b.entries?.length ?? 0,
    measurements: b.measurements?.length ?? 0,
    vitals: b.vitals?.length ?? 0,
    exercises: b.exercises?.length ?? 0,
    water: b.water?.length ?? 0,
    steps: b.steps?.length ?? 0,
    sleep: b.sleep?.length ?? 0,
    progress: b.progress?.length ?? 0
  }
}

// Yer acma: belirli gun sayisindan eski kayitlarin FOTOGRAFLARINI siler
// (kayitlar kalir, sadece yer kaplayan foto verisi silinir).
export async function clearOldPhotos(keepDays = 7): Promise<number> {
  const cutoff = Date.now() - keepDays * 86_400_000
  const old = await dietDb.entries.where('createdAt').below(cutoff).toArray()
  let n = 0
  for (const e of old) {
    if (e.photo) {
      await dietDb.entries.update(e.id!, { photo: '' })
      n++
    }
  }
  return n
}

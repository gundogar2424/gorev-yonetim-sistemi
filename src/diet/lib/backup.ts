// Diyet Kocu verisinin yedeklenmesi / geri yuklenmesi ve yer acma islemleri.
// Tum veri tek bir JSON dosyasina indirilir; istenince geri yuklenir.
import { dietDb } from '../db'
import type {
  DietEntry,
  Measurement,
  Vital,
  DietSettings,
  Exercise,
  Water,
  Steps,
  Sleep,
  ProgressPhoto,
  SavedProduct,
  Lab,
  ShoppingItem,
  CheckIn,
  Craving,
  DayNote,
  MedLog,
  MedDef,
  Favorite
} from '../types'

// Yedek surum 5: tahlil, ilac tanimlari/kayitlari, check-in, kriz, gun notu ve
// alisveris listesi de yedege girer. Eski (v4) yedeklerde bu alanlar YOKTUR;
// geri yuklerken hepsi istege bagli okunur, eksikse o tablo atlanir.
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
  // v5'te eklendi (eski yedeklerde bulunmaz)
  labs?: Lab[]
  shopping?: ShoppingItem[]
  checkins?: CheckIn[]
  cravings?: Craving[]
  daynotes?: DayNote[]
  medlogs?: MedLog[]
  meds?: MedDef[]
  favorites?: Favorite[]
  settings: DietSettings | null
}

// Tum diyet verisini topla (yedek nesnesi)
export async function buildBackupData(): Promise<DietBackup> {
  const [
    entries,
    measurements,
    vitals,
    exercises,
    water,
    steps,
    sleep,
    progress,
    products,
    labs,
    shopping,
    checkins,
    cravings,
    daynotes,
    medlogs,
    meds,
    favorites,
    settingsRow
  ] = await Promise.all([
    dietDb.entries.toArray(),
    dietDb.measurements.toArray(),
    dietDb.vitals.toArray(),
    dietDb.exercises.toArray(),
    dietDb.water.toArray(),
    dietDb.steps.toArray(),
    dietDb.sleep.toArray(),
    dietDb.progress.toArray(),
    dietDb.products.toArray(),
    dietDb.labs.toArray(),
    dietDb.shopping.toArray(),
    dietDb.checkins.toArray(),
    dietDb.cravings.toArray(),
    dietDb.daynotes.toArray(),
    dietDb.medlogs.toArray(),
    dietDb.meds.toArray(),
    dietDb.favorites.toArray(),
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
    version: 6,
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
    labs,
    shopping,
    checkins,
    cravings,
    daynotes,
    medlogs,
    meds,
    favorites,
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
    // v5 tablolari: SADECE yedekte varsa temizle. Eski (v4) bir yedek "replace"
    // ile geri yuklenirse tahlil/ilac/kriz kayitlarini SILMEYELIM — yedekte
    // karsiligi yok, silersek geri gelmez.
    if (b.labs) await dietDb.labs.clear()
    if (b.shopping) await dietDb.shopping.clear()
    if (b.checkins) await dietDb.checkins.clear()
    if (b.cravings) await dietDb.cravings.clear()
    if (b.daynotes) await dietDb.daynotes.clear()
    if (b.medlogs) await dietDb.medlogs.clear()
    if (b.meds) await dietDb.meds.clear()
    if (b.favorites) await dietDb.favorites.clear()
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
  if (b.labs?.length) await dietDb.labs.bulkAdd(strip(b.labs) as Lab[])
  if (b.shopping?.length) await dietDb.shopping.bulkAdd(strip(b.shopping) as ShoppingItem[])
  if (b.checkins?.length) await dietDb.checkins.bulkAdd(strip(b.checkins) as CheckIn[])
  if (b.cravings?.length) await dietDb.cravings.bulkAdd(strip(b.cravings) as Craving[])
  if (b.daynotes?.length) await dietDb.daynotes.bulkAdd(strip(b.daynotes) as DayNote[])
  if (b.favorites?.length) await dietDb.favorites.bulkAdd(strip(b.favorites) as Favorite[])

  // ILAC TANIMLARI + ALIM KAYITLARI birlikte gelir. Kayittaki medId, tanimin
  // id'sine baglidir; eklerken id'ler yeniden uretildigi icin bag KOPAR.
  // O yuzden eski id -> yeni id eslemesi cikarilip kayitlara islenir.
  const medIdMap = new Map<number, number>()
  if (b.meds?.length) {
    const existing = await dietDb.meds.toArray()
    // Ayni ilac zaten varsa (createdAt kimligi) tekrar ekleme — yoksa cift
    // bildirim kurulur. Bu, senkronun kullandigi kimlik kuralinin aynisi.
    const byCreated = new Map(existing.map((m) => [m.createdAt, m.id!]))
    for (const m of b.meds) {
      const oldId = m.id
      const already = byCreated.get(m.createdAt)
      if (already != null) {
        if (oldId != null) medIdMap.set(oldId, already)
        continue
      }
      const { id: _id, ...rest } = m
      const newId = (await dietDb.meds.add(rest as MedDef)) as number
      if (oldId != null) medIdMap.set(oldId, newId)
    }
  }
  if (b.medlogs?.length) {
    await dietDb.medlogs.bulkAdd(
      b.medlogs.map(({ id: _id, ...rest }) => ({
        ...rest,
        medId: rest.medId != null ? medIdMap.get(rest.medId) : undefined
      })) as MedLog[]
    )
  }

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
    progress: b.progress?.length ?? 0,
    labs: b.labs?.length ?? 0,
    shopping: b.shopping?.length ?? 0,
    checkins: b.checkins?.length ?? 0,
    cravings: b.cravings?.length ?? 0,
    daynotes: b.daynotes?.length ?? 0,
    medlogs: b.medlogs?.length ?? 0,
    meds: b.meds?.length ?? 0,
    favorites: b.favorites?.length ?? 0
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

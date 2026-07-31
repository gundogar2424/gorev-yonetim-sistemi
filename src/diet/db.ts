// Diyet Kocu icin AYRI bir Dexie (IndexedDB) veritabani.
// CRM veritabanina hic dokunmaz; semasi ve surumu bagimsizdir.
import Dexie, { type Table } from 'dexie'
import type {
  DietEntry,
  DietSettings,
  Measurement,
  Vital,
  Lab,
  ShoppingItem,
  Exercise,
  Water,
  Steps,
  Sleep,
  ProgressPhoto,
  SavedProduct,
  CheckIn,
  Craving,
  DayNote,
  MedLog,
  MedDef,
  MealType,
  Favorite
} from './types'

export class DietCoachDB extends Dexie {
  entries!: Table<DietEntry, number>
  settings!: Table<DietSettings, number>
  measurements!: Table<Measurement, number>
  vitals!: Table<Vital, number>
  labs!: Table<Lab, number>
  shopping!: Table<ShoppingItem, number>
  exercises!: Table<Exercise, number>
  water!: Table<Water, number>
  steps!: Table<Steps, number>
  sleep!: Table<Sleep, number>
  progress!: Table<ProgressPhoto, number>
  products!: Table<SavedProduct, number>
  checkins!: Table<CheckIn, number>
  cravings!: Table<Craving, number>
  daynotes!: Table<DayNote, number>
  medlogs!: Table<MedLog, number>
  meds!: Table<MedDef, number>
  favorites!: Table<Favorite, number>

  constructor() {
    super('diet-coach')
    this.version(1).stores({
      // Tarihe ve karara gore sorgulanabilir alanlar indexlenir
      entries: '++id, createdAt, dateStr, decision',
      settings: '++id'
    })
    // Surum 2: olcu takibi + saglik (seker/tansiyon) tablolari
    this.version(2).stores({
      entries: '++id, createdAt, dateStr, decision',
      settings: '++id',
      measurements: '++id, dateStr, createdAt',
      vitals: '++id, dateStr, createdAt, kind'
    })
    // Surum 3: tahliller + alisveris listesi
    this.version(3).stores({
      entries: '++id, createdAt, dateStr, decision',
      settings: '++id',
      measurements: '++id, dateStr, createdAt',
      vitals: '++id, dateStr, createdAt, kind',
      labs: '++id, dateStr, createdAt',
      shopping: '++id, createdAt, done'
    })
    // Surum 4: egzersiz kayitlari (+puan)
    this.version(4).stores({
      entries: '++id, createdAt, dateStr, decision',
      settings: '++id',
      measurements: '++id, dateStr, createdAt',
      vitals: '++id, dateStr, createdAt, kind',
      labs: '++id, dateStr, createdAt',
      shopping: '++id, createdAt, done',
      exercises: '++id, dateStr, createdAt'
    })
    // Surum 5: gunluk su takibi
    this.version(5).stores({
      entries: '++id, createdAt, dateStr, decision',
      settings: '++id',
      measurements: '++id, dateStr, createdAt',
      vitals: '++id, dateStr, createdAt, kind',
      labs: '++id, dateStr, createdAt',
      shopping: '++id, createdAt, done',
      exercises: '++id, dateStr, createdAt',
      water: '++id, dateStr'
    })
    // Surum 6: gunluk adim takibi
    this.version(6).stores({
      entries: '++id, createdAt, dateStr, decision',
      settings: '++id',
      measurements: '++id, dateStr, createdAt',
      vitals: '++id, dateStr, createdAt, kind',
      labs: '++id, dateStr, createdAt',
      shopping: '++id, createdAt, done',
      exercises: '++id, dateStr, createdAt',
      water: '++id, dateStr',
      steps: '++id, dateStr'
    })
    // Surum 7: uyku takibi + ilerleme fotograflari
    this.version(7).stores({
      entries: '++id, createdAt, dateStr, decision',
      settings: '++id',
      measurements: '++id, dateStr, createdAt',
      vitals: '++id, dateStr, createdAt, kind',
      labs: '++id, dateStr, createdAt',
      shopping: '++id, createdAt, done',
      exercises: '++id, dateStr, createdAt',
      water: '++id, dateStr',
      steps: '++id, dateStr',
      sleep: '++id, dateStr',
      progress: '++id, dateStr, createdAt'
    })
    // Surum 8: elle girilen urun hafizasi (barkod -> besin)
    this.version(8).stores({
      entries: '++id, createdAt, dateStr, decision',
      settings: '++id',
      measurements: '++id, dateStr, createdAt',
      vitals: '++id, dateStr, createdAt, kind',
      labs: '++id, dateStr, createdAt',
      shopping: '++id, createdAt, done',
      exercises: '++id, dateStr, createdAt',
      water: '++id, dateStr',
      steps: '++id, dateStr',
      sleep: '++id, dateStr',
      progress: '++id, dateStr, createdAt',
      products: '++id, barcode'
    })
    // Surum 9: gun ici "nasilsin?" check-in kayitlari
    this.version(9).stores({
      entries: '++id, createdAt, dateStr, decision',
      settings: '++id',
      measurements: '++id, dateStr, createdAt',
      vitals: '++id, dateStr, createdAt, kind',
      labs: '++id, dateStr, createdAt',
      shopping: '++id, createdAt, done',
      exercises: '++id, dateStr, createdAt',
      water: '++id, dateStr',
      steps: '++id, dateStr',
      sleep: '++id, dateStr',
      progress: '++id, dateStr, createdAt',
      products: '++id, barcode',
      checkins: '++id, dateStr, createdAt'
    })
    // Surum 10: kriz ani ("canim cekiyor") kayitlari
    this.version(10).stores({
      entries: '++id, createdAt, dateStr, decision',
      settings: '++id',
      measurements: '++id, dateStr, createdAt',
      vitals: '++id, dateStr, createdAt, kind',
      labs: '++id, dateStr, createdAt',
      shopping: '++id, createdAt, done',
      exercises: '++id, dateStr, createdAt',
      water: '++id, dateStr',
      steps: '++id, dateStr',
      sleep: '++id, dateStr',
      progress: '++id, dateStr, createdAt',
      products: '++id, barcode',
      checkins: '++id, dateStr, createdAt',
      cravings: '++id, dateStr, createdAt'
    })
    // Surum 11: gune ozel not/plan
    this.version(11).stores({
      entries: '++id, createdAt, dateStr, decision',
      settings: '++id',
      measurements: '++id, dateStr, createdAt',
      vitals: '++id, dateStr, createdAt, kind',
      labs: '++id, dateStr, createdAt',
      shopping: '++id, createdAt, done',
      exercises: '++id, dateStr, createdAt',
      water: '++id, dateStr',
      steps: '++id, dateStr',
      sleep: '++id, dateStr',
      progress: '++id, dateStr, createdAt',
      products: '++id, barcode',
      checkins: '++id, dateStr, createdAt',
      cravings: '++id, dateStr, createdAt',
      daynotes: '++id, dateStr'
    })
    // Surum 12: ilac kullanim kayitlari (ne zaman/hangi ilac, ogunle iliskisi)
    this.version(12).stores({
      entries: '++id, createdAt, dateStr, decision',
      settings: '++id',
      measurements: '++id, dateStr, createdAt',
      vitals: '++id, dateStr, createdAt, kind',
      labs: '++id, dateStr, createdAt',
      shopping: '++id, createdAt, done',
      exercises: '++id, dateStr, createdAt',
      water: '++id, dateStr',
      steps: '++id, dateStr',
      sleep: '++id, dateStr',
      progress: '++id, dateStr, createdAt',
      products: '++id, barcode',
      checkins: '++id, dateStr, createdAt',
      cravings: '++id, dateStr, createdAt',
      daynotes: '++id, dateStr',
      medlogs: '++id, dateStr, createdAt'
    })
    // Surum 13: tanimli ilac/vitamin listesi (doz saatleri, gunler, uyum raporu)
    this.version(13).stores({
      entries: '++id, createdAt, dateStr, decision',
      settings: '++id',
      measurements: '++id, dateStr, createdAt',
      vitals: '++id, dateStr, createdAt, kind',
      labs: '++id, dateStr, createdAt',
      shopping: '++id, createdAt, done',
      exercises: '++id, dateStr, createdAt',
      water: '++id, dateStr',
      steps: '++id, dateStr',
      sleep: '++id, dateStr',
      progress: '++id, dateStr, createdAt',
      products: '++id, barcode',
      checkins: '++id, dateStr, createdAt',
      cravings: '++id, dateStr, createdAt',
      daynotes: '++id, dateStr',
      medlogs: '++id, dateStr, createdAt, medId',
      meds: '++id, active, createdAt'
    })
    // Surum 14: sik tuketilen urunler (tek dokunusla ekleme)
    this.version(14).stores({
      entries: '++id, createdAt, dateStr, decision',
      settings: '++id',
      measurements: '++id, dateStr, createdAt',
      vitals: '++id, dateStr, createdAt, kind',
      labs: '++id, dateStr, createdAt',
      shopping: '++id, createdAt, done',
      exercises: '++id, dateStr, createdAt',
      water: '++id, dateStr',
      steps: '++id, dateStr',
      sleep: '++id, dateStr',
      progress: '++id, dateStr, createdAt',
      products: '++id, barcode',
      checkins: '++id, dateStr, createdAt',
      cravings: '++id, dateStr, createdAt',
      daynotes: '++id, dateStr',
      medlogs: '++id, dateStr, createdAt, medId',
      meds: '++id, active, createdAt',
      favorites: '++id, createdAt'
    })
  }
}

export const dietDb = new DietCoachDB()

// ---- Vucut olculeri (SALT OKUNUR sorgular; yazma ayri fonksiyonlarda) ----
export function listMeasurements(): Promise<Measurement[]> {
  return dietDb.measurements.orderBy('createdAt').toArray()
}
export async function addMeasurement(m: Omit<Measurement, 'id' | 'createdAt'>) {
  await dietDb.measurements.add({ ...m, createdAt: Date.now() })
}
export async function deleteMeasurement(id: number) {
  await dietDb.measurements.delete(id)
}
// Bir olcum kaydini gunceller (yanlis girilen degeri duzeltmek icin).
// patch icinde bir alan undefined ise o alan kayittan SILINIR (bosaltilir).
export async function updateMeasurement(id: number, patch: Partial<Measurement>) {
  await dietDb.measurements.update(id, patch)
}

// ---- Seker / tansiyon olcumleri ----
export function listVitals(): Promise<Vital[]> {
  return dietDb.vitals.orderBy('createdAt').toArray()
}
export async function addVital(v: Omit<Vital, 'id' | 'createdAt'>) {
  await dietDb.vitals.add({ ...v, createdAt: Date.now() })
}
export async function deleteVital(id: number) {
  await dietDb.vitals.delete(id)
}

// ---- Tahliller ----
export function listLabs(): Promise<Lab[]> {
  return dietDb.labs.orderBy('createdAt').reverse().toArray()
}
export async function addLab(l: Omit<Lab, 'id' | 'createdAt'>): Promise<number> {
  return dietDb.labs.add({ ...l, createdAt: Date.now() })
}
export async function updateLab(id: number, patch: Partial<Lab>) {
  await dietDb.labs.update(id, patch)
}
export async function deleteLab(id: number) {
  await dietDb.labs.delete(id)
}

// ---- Egzersiz kayitlari (SALT OKUNUR sorgu; +puan kazandirir) ----
export function listExercises(): Promise<Exercise[]> {
  return dietDb.exercises.orderBy('createdAt').reverse().toArray()
}
export async function addExercise(
  text: string,
  minutes?: number,
  kcal?: number,
  extra?: Pick<Exercise, 'steps' | 'avgHr' | 'cadence' | 'distanceKm'>,
  dateStr?: string // hangi gune eklenecek (bos ise bugun)
) {
  await dietDb.exercises.add({
    text,
    minutes,
    kcal,
    ...(extra || {}),
    createdAt: Date.now(),
    dateStr: dateStr || new Date().toLocaleDateString('en-CA')
  })
}
export async function deleteExercise(id: number) {
  await dietDb.exercises.delete(id)
}

// HEALTH CONNECT: bir gunun Health'ten gelen antrenmanlarini yaz. Ayni gunun
// daha once Health'ten alinmis (text'inde `tag` gecen) kayitlarini ONCE siler ki
// tekrar ice aktarınca CIFT olmasin. Elle eklenen egzersizlere dokunmaz.
// TEK SEFERLIK TEMIZLIK: Health Connect'ten gelen antrenmanlar bir donem
// her ice aktarimda YENI createdAt aliyordu; bulut senkronu da createdAt'e
// gore birlestirdigi icin silinen kayitlar geri gelip ayni antrenman
// defalarca yaziliyordu (gunluk raporda 20 satir gibi). Kimlik artik
// oturumun baslangic zamani, ama CIHAZDA BIRIKMIS kopyalar duruyor.
// Ayni gun + ayni ad + ayni sure olanlardan EN ESKIsini birakip digerlerini
// siliyoruz. Bir kez calisir; bayrak localStorage'da tutulur.
const DEDUPE_FLAG = 'diet-health-dedupe-v1'
export async function dedupeHealthExercisesOnce(): Promise<number> {
  try {
    if (localStorage.getItem(DEDUPE_FLAG)) return 0
  } catch {
    /* localStorage yoksa yine de calis */
  }
  let removed = 0
  try {
    const all = await dietDb.exercises.toArray()
    const seen = new Set<string>()
    const dup: number[] = []
    for (const e of all.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))) {
      if (!(e.text || '').includes(HEALTH_TAG_DB)) continue
      const key = `${e.dateStr}|${e.text}|${e.minutes ?? ''}`
      if (seen.has(key)) {
        if (e.id != null) dup.push(e.id)
      } else {
        seen.add(key)
      }
    }
    if (dup.length) await dietDb.exercises.bulkDelete(dup)
    removed = dup.length
    try {
      localStorage.setItem(DEDUPE_FLAG, '1')
    } catch {
      /* yok say */
    }
  } catch {
    /* temizlik basarisiz — uygulamayi engellemesin */
  }
  return removed
}

// lib/health.ts'teki HEALTH_TAG ile ayni deger; db katmani oraya bagimli
// olmasin diye burada tekrar tanimli.
const HEALTH_TAG_DB = '(Health Connect)'

export async function replaceHealthExercises(
  dateStr: string,
  tag: string,
  workouts: { text: string; minutes?: number; kcal?: number; avgHr?: number; distanceKm?: number; steps?: number; startMs?: number }[]
): Promise<void> {
  const existing = await dietDb.exercises.where('dateStr').equals(dateStr).toArray()
  const stale = existing.filter((e) => (e.text || '').includes(tag) && e.id != null).map((e) => e.id as number)
  if (stale.length) await dietDb.exercises.bulkDelete(stale)
  for (const w of workouts) {
    await dietDb.exercises.add({
      text: w.text,
      minutes: w.minutes,
      kcal: w.kcal,
      avgHr: w.avgHr,
      distanceKm: w.distanceKm,
      steps: w.steps,
      // SABIT KIMLIK: antrenmanin baslangic zamani. Date.now() kullanmak
      // her ice aktarmayi "yeni kayit" gibi gosteriyordu; bulut senkronu da
      // createdAt'e gore birlestirdigi icin silinen kayitlari geri getirip
      // ayni antrenmani defalarca yaziyordu (raporda 20 satir gibi).
      createdAt: w.startMs ?? Date.now(),
      dateStr
    })
  }
}

// HIZLI TASLAK ÖĞÜN: fotoğrafı hemen kaydeder (yapay zekaya sormadan). Sonra
// Geçmiş'te "yapay zekayla düzelt" ile incelenip gerçek değerler doldurulur.
export async function addDraftEntry(photo: string, mealType: MealType, createdAt?: number, note?: string) {
  const now = createdAt ?? Date.now()
  const desc = note?.trim()
  await dietDb.entries.add({
    foodFound: false,
    // Yazi girildiyse adi o olsun (yoksa "İncelenecek öğün")
    foodName: desc ? desc.slice(0, 60) : '📷 İncelenecek öğün',
    draftNote: desc || undefined,
    healthy: true,
    riskLevel: 'düşük',
    estimatedCalories: 0,
    protein: 0,
    carb: 0,
    fat: 0,
    dietScore: 0,
    scoreReason: '',
    harms: [],
    motivations: [],
    healthierAlternative: '',
    verdict: 'Sonra yapay zekayla incelenecek',
    compliancePercent: -1,
    complianceNote: '',
    macroFix: '',
    cravingPortion: '',
    cravingNote: '',
    photo,
    decision: 'ate',
    mealType,
    createdAt: now,
    dateStr: new Date(now).toLocaleDateString('en-CA'),
    pending: true
  })
}

// ---- Gunluk su takibi ----
// Bir gunun bardak sayisini OKU (SALT OKUNUR; useLiveQuery icinde guvenli)
export async function getWaterDay(dateStr: string): Promise<number> {
  const row = await dietDb.water.where('dateStr').equals(dateStr).first()
  return row?.glasses ?? 0
}
export function listWater(): Promise<Water[]> {
  return dietDb.water.orderBy('dateStr').toArray()
}
// Bir gunun bardak sayisini ayarla (yazma baglami; 0'a duserse kaydi siler)
export async function setWaterDay(dateStr: string, glasses: number) {
  const g = Math.max(0, Math.round(glasses))
  const row = await dietDb.water.where('dateStr').equals(dateStr).first()
  if (row?.id != null) {
    if (g === 0) await dietDb.water.delete(row.id)
    else await dietDb.water.update(row.id, { glasses: g })
  } else if (g > 0) {
    await dietDb.water.add({ dateStr, glasses: g, createdAt: Date.now() })
  }
}

// ---- Kriz ani ("canim cekiyor") ----
export async function addCraving(outcome: 'resisted' | 'ate', note?: string) {
  const now = new Date()
  await dietDb.cravings.add({ dateStr: now.toLocaleDateString('en-CA'), createdAt: Date.now(), outcome, note })
}
export function listCravings(): Promise<Craving[]> {
  return dietDb.cravings.orderBy('createdAt').toArray()
}

// ---- Gune ozel not/plan ----
export function getDayNote(dateStr: string): Promise<DayNote | undefined> {
  return dietDb.daynotes.where('dateStr').equals(dateStr).first()
}
export async function setDayNote(dateStr: string, text: string) {
  const t = text.trim()
  const row = await dietDb.daynotes.where('dateStr').equals(dateStr).first()
  if (row?.id != null) {
    if (!t) await dietDb.daynotes.delete(row.id)
    else await dietDb.daynotes.update(row.id, { text: t })
  } else if (t) {
    await dietDb.daynotes.add({ dateStr, text: t, createdAt: Date.now() })
  }
}

// ---- Gun ici "nasilsin?" check-in (gunde ISTEDIGI KADAR, saatli) ----
export async function getCheckinDay(dateStr: string): Promise<CheckIn | undefined> {
  return dietDb.checkins.where('dateStr').equals(dateStr).first()
}
// Gunun tum check-in'leri (kronolojik) — yemek oncesi/sonrasi bag kurmak icin
export function listCheckinsDay(dateStr: string): Promise<CheckIn[]> {
  return dietDb.checkins.where('dateStr').equals(dateStr).sortBy('createdAt')
}
// Yeni bir his/aclik kaydi ekler (her cagrida AYRI kayit; saat damgasiyla)
export async function addCheckin(mood?: number, note?: string, hunger?: number) {
  const now = new Date()
  await dietDb.checkins.add({ dateStr: now.toLocaleDateString('en-CA'), createdAt: Date.now(), mood, note, hunger })
}
export async function deleteCheckin(id: number) {
  await dietDb.checkins.delete(id)
}
export function listCheckins(): Promise<CheckIn[]> {
  return dietDb.checkins.orderBy('createdAt').toArray()
}
// Bir gunun check-in'ini kaydeder/gunceller (gun basina tek kayit)
export async function saveCheckinDay(dateStr: string, patch: { mood?: number; energy?: number; note?: string }) {
  const row = await dietDb.checkins.where('dateStr').equals(dateStr).first()
  if (row?.id != null) await dietDb.checkins.update(row.id, patch)
  else await dietDb.checkins.add({ dateStr, createdAt: Date.now(), ...patch })
}

// ---- Ilac kullanim kayitlari ----
// Gunun ilac kayitlari (kronolojik)
export function listMedLogsDay(dateStr: string): Promise<MedLog[]> {
  return dietDb.medlogs.where('dateStr').equals(dateStr).sortBy('createdAt')
}
// Tum ilac kayitlari (baglam/rapor icin)
export function listMedLogs(): Promise<MedLog[]> {
  return dietDb.medlogs.orderBy('createdAt').toArray()
}
// Bir ilaci "aldim" olarak isaretle (su an; ogun iliskisi/tanim opsiyonel)
export async function addMedLog(
  name: string,
  relation?: MedLog['relation'],
  opts?: {
    medId?: number
    kind?: 'ilac' | 'vitamin'
    time?: string
    status?: 'taken' | 'skipped'
    dateStr?: string
    takenAt?: number // gercekte alinan zaman (ms) — kullanici saati degistirdiyse
  }
) {
  const now = new Date()
  await dietDb.medlogs.add({
    dateStr: opts?.dateStr ?? now.toLocaleDateString('en-CA'),
    createdAt: opts?.takenAt ?? Date.now(),
    name: name.trim(),
    relation,
    medId: opts?.medId,
    kind: opts?.kind,
    time: opts?.time,
    status: opts?.status
  })
}
export async function deleteMedLog(id: number) {
  await dietDb.medlogs.delete(id)
}

// ---- Tanimli ilac/vitamin (MedDef) ----
export function listMeds(): Promise<MedDef[]> {
  return dietDb.meds.orderBy('createdAt').toArray()
}
export async function addMed(m: Omit<MedDef, 'id' | 'createdAt'>) {
  const now = Date.now()
  return dietDb.meds.add({ ...m, createdAt: now, updatedAt: now })
}
export async function updateMed(id: number, patch: Partial<MedDef>) {
  await dietDb.meds.update(id, { ...patch, updatedAt: Date.now() })
}
export async function deleteMed(id: number) {
  await dietDb.meds.delete(id)
}

// ---- Su (ml esasli) ----
// Bir gunun toplam suyunu ml olarak dondurur (eski bardak kaydi 200 ml sayilir)
export async function getWaterMlDay(dateStr: string): Promise<number> {
  const row = await dietDb.water.where('dateStr').equals(dateStr).first()
  if (!row) return 0
  return row.ml != null ? row.ml : (row.glasses || 0) * 200
}
// Bir gune ml ekler/cikarir (negatif olabilir); 0'in altina inmez, 0'da kaydi siler
export async function addWaterMl(dateStr: string, deltaMl: number) {
  const row = await dietDb.water.where('dateStr').equals(dateStr).first()
  const current = row ? (row.ml != null ? row.ml : (row.glasses || 0) * 200) : 0
  const next = Math.max(0, Math.round(current + deltaMl))
  if (row?.id != null) {
    if (next === 0) await dietDb.water.delete(row.id)
    else await dietDb.water.update(row.id, { ml: next, glasses: Math.round(next / 200) })
  } else if (next > 0) {
    await dietDb.water.add({ dateStr, ml: next, glasses: Math.round(next / 200), createdAt: Date.now() })
  }
}

// ---- Gunluk adim takibi (elle girilir) ----
export async function getStepsDay(dateStr: string): Promise<number> {
  const row = await dietDb.steps.where('dateStr').equals(dateStr).first()
  return row?.count ?? 0
}
export function listSteps(): Promise<Steps[]> {
  return dietDb.steps.orderBy('dateStr').toArray()
}
// Gunun aktivite verisini (adim + etkin sure + aktivite/toplam kalori + mesafe) upsert et.
// Samsung Health vb.'den elle girilen degerleri saklar. Bos/0 alanlar temizlenir.
export async function getStepsRow(dateStr: string): Promise<Steps | undefined> {
  return dietDb.steps.where('dateStr').equals(dateStr).first()
}
export async function setActivityDay(
  dateStr: string,
  patch: { count?: number; activeMin?: number; activeKcal?: number; burnedKcal?: number; distanceKm?: number }
) {
  const clean = (n?: number) => (n != null && isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : undefined)
  const data = {
    count: Math.max(0, Math.round(patch.count ?? 0)),
    activeMin: clean(patch.activeMin),
    activeKcal: clean(patch.activeKcal),
    burnedKcal: clean(patch.burnedKcal),
    distanceKm: clean(patch.distanceKm)
  }
  const empty = !data.count && !data.activeMin && !data.activeKcal && !data.burnedKcal && !data.distanceKm
  const row = await dietDb.steps.where('dateStr').equals(dateStr).first()
  if (row?.id != null) {
    if (empty) await dietDb.steps.delete(row.id)
    else await dietDb.steps.update(row.id, data)
  } else if (!empty) {
    await dietDb.steps.add({ dateStr, createdAt: Date.now(), ...data })
  }
}
// Bir gunun adim sayisini ayarla (0'a duserse kaydi siler)
export async function setStepsDay(dateStr: string, count: number) {
  const c = Math.max(0, Math.round(count))
  const row = await dietDb.steps.where('dateStr').equals(dateStr).first()
  if (row?.id != null) {
    if (c === 0) await dietDb.steps.delete(row.id)
    else await dietDb.steps.update(row.id, { count: c })
  } else if (c > 0) {
    await dietDb.steps.add({ dateStr, count: c, createdAt: Date.now() })
  }
}

// ---- Gunluk uyku takibi (elle, saat) ----
export async function getSleepDay(dateStr: string): Promise<number> {
  const row = await dietDb.sleep.where('dateStr').equals(dateStr).first()
  return row?.hours ?? 0
}
export function listSleep(): Promise<Sleep[]> {
  return dietDb.sleep.orderBy('dateStr').toArray()
}
export async function setSleepDay(dateStr: string, hours: number) {
  const h = Math.max(0, Math.min(24, Math.round(hours * 10) / 10))
  const row = await dietDb.sleep.where('dateStr').equals(dateStr).first()
  if (row?.id != null) {
    if (h === 0) await dietDb.sleep.delete(row.id)
    else await dietDb.sleep.update(row.id, { hours: h })
  } else if (h > 0) {
    await dietDb.sleep.add({ dateStr, hours: h, createdAt: Date.now() })
  }
}

// ---- Ilerleme fotograflari (once-sonra) ----
export function listProgress(): Promise<ProgressPhoto[]> {
  return dietDb.progress.orderBy('createdAt').reverse().toArray()
}
export async function addProgress(photo: string, note?: string): Promise<number> {
  return dietDb.progress.add({
    photo,
    note,
    createdAt: Date.now(),
    dateStr: new Date().toLocaleDateString('en-CA')
  })
}
export async function deleteProgress(id: number) {
  await dietDb.progress.delete(id)
}

// ---- Alisveris listesi ----
export function listShopping(): Promise<ShoppingItem[]> {
  return dietDb.shopping.orderBy('createdAt').toArray()
}
export async function addShopping(text: string, category?: string, meals?: string[]) {
  await dietDb.shopping.add({ text, done: false, createdAt: Date.now(), category, meals })
}
// Kategori ve ogun bilgisini koruyarak birden cok urunu tek seferde ekler
export async function addShoppingMany(items: { text: string; category?: string; meals?: string[] }[]) {
  const now = Date.now()
  await dietDb.shopping.bulkAdd(
    items.map((it, i) => ({ text: it.text, category: it.category, meals: it.meals, done: false, createdAt: now + i }))
  )
}
export async function toggleShopping(id: number, done: boolean) {
  await dietDb.shopping.update(id, { done })
}
export async function deleteShopping(id: number) {
  await dietDb.shopping.delete(id)
}
export async function clearDoneShopping() {
  const done = await dietDb.shopping.filter((s) => s.done).toArray()
  await dietDb.shopping.bulkDelete(done.map((s) => s.id!))
}

// Ayarlari OKU (SALT OKUNUR — hicbir yazma yapmaz).
// useLiveQuery icinde cagrildigi icin burada DB'ye yazmak yasak
// (Dexie "Readwrite transaction in liveQuery context" hatasi verir).
// Kayit yoksa, DB'ye dokunmadan bellekte varsayilan bir nesne dondurur.
export async function readDietSettings(): Promise<DietSettings> {
  const s = await dietDb.settings.toCollection().first()
  return s ?? { model: 'claude-opus-5' }
}

// Ayarlari guncelle (yazma baglami — kayit yoksa olusturur, varsa gunceller)
export async function saveDietSettings(patch: Partial<DietSettings>) {
  const s = await dietDb.settings.toCollection().first()
  const stamped = { ...patch, updatedAt: Date.now() } // senkronda "yeni olan kazanir" icin
  if (s?.id != null) {
    await dietDb.settings.update(s.id, stamped)
  } else {
    await dietDb.settings.add({ model: 'claude-opus-5', ...stamped })
  }
}

// ---- SIK TUKETTIKLERIM (tek dokunusla ekleme) ----
// Amac: bir bardak cay/kahve icin her seferinde yapay zeka calistirmamak.
// Deger kullanicinin bir kez girdigi sabit kalori/makrodur; cagri yapilmaz.
export function listFavorites(): Promise<Favorite[]> {
  return dietDb.favorites.orderBy('createdAt').toArray()
}

export async function addFavorite(f: Omit<Favorite, 'id' | 'createdAt' | 'uses'>): Promise<number> {
  return (await dietDb.favorites.add({ ...f, uses: 0, createdAt: Date.now() })) as number
}

export async function updateFavorite(id: number, patch: Partial<Favorite>): Promise<void> {
  await dietDb.favorites.update(id, patch)
}

export async function deleteFavorite(id: number): Promise<void> {
  await dietDb.favorites.delete(id)
}

// Sik tuketileni GUNE EKLE. Yapay zeka CAGRILMAZ (quick: true).
// mealType 'serbest' verilir ki takip edilen bir ana ogunun yerine gecmesin —
// "cay ictim" kahvalti yapilmis sayilmamali.
export async function addFavoriteToDay(f: Favorite, dateStr: string): Promise<void> {
  await dietDb.entries.add({
    photo: '',
    foodFound: true,
    foodName: f.emoji ? `${f.emoji} ${f.name}` : f.name,
    healthy: true,
    riskLevel: 'düşük',
    estimatedCalories: Math.max(0, Math.round(f.kcal || 0)),
    protein: Math.max(0, Math.round(f.protein || 0)),
    carb: Math.max(0, Math.round(f.carb || 0)),
    fat: Math.max(0, Math.round(f.fat || 0)),
    sugar: Math.max(0, Math.round(f.sugar || 0)),
    dietScore: 0,
    scoreReason: '',
    harms: [],
    motivations: [],
    healthierAlternative: '',
    verdict: '',
    compliancePercent: -1,
    complianceNote: '',
    macroFix: '',
    cravingPortion: '',
    cravingNote: '',
    decision: 'ate',
    mealType: 'serbest',
    quick: true,
    createdAt: Date.now(),
    dateStr
  })
  if (f.id != null) await dietDb.favorites.update(f.id, { uses: (f.uses ?? 0) + 1 })
}

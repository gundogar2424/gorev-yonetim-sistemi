// ORTAK SAGLIK AKLI: veritabanindaki HER SEYDEN kompakt bir baglam metni
// uretir ve tum yapay zeka modullerine verilir. Boylece moduller birbirinin
// verisini kullanir (kilo/olcu egilimi, seker, ilac, bugunku durum, kriz
// oruntusu...). Yerel DB okumasi — internet/token maliyeti sadece bu metnin
// modele gitmesi kadardir.
import { dietDb } from '../db'
import { todayStr, dayAdherence } from '../streak'
import { mealLabel } from './meals'
import { movementKcal, plausibleDistanceKm } from './movement'
import type { DietEntry, DietSettings, Measurement } from '../types'

const fmt = (n: number) => Math.round(n * 10) / 10

// FOTOGRAFSIZ OKUMA. entries tablosundaki her kayit base64 bir yemek
// fotografi tasiyor (~200-400 KB). `toArray()` bunlarin HEPSINI ayni anda
// bellege aliyordu: aylik veride on-larca MB eder ve bu HER yapay zeka
// cagrisinda bastan tekrarlanir. Telefonda WebView'i sisirip donmaya ve
// bellek kaynakli cokmelere yol aciyor.
// Burada fotografa hic ihtiyac yok — akisla okuyup fotograf alanini aninda
// dusuruyoruz; boylece ayni anda bellekte en fazla TEK fotograf bulunur.
async function readEntriesLite(): Promise<DietEntry[]> {
  const out: DietEntry[] = []
  await dietDb.entries.each((e) => {
    out.push(e.photo ? { ...e, photo: '' } : e)
  })
  return out
}

// Cagri tipi. Amac: her cagriya HER SEYI gondermemek. 'full' varsayilandir
// (hicbir sey kirpilmaz); digerleri o cagri icin ANLAMSIZ olan satirlari atar.
// Suphedeysen 'full' birak — modulu kor etmektense token odemek yeglenir.
export type HealthScope = 'full' | 'food' | 'shopping' | 'quick'

export async function buildHealthContext(settings?: DietSettings, scope: HealthScope = 'full'): Promise<string> {
  const today = todayStr()
  const since30 = todayStr(new Date(Date.now() - 29 * 86_400_000))
  const since14 = todayStr(new Date(Date.now() - 13 * 86_400_000))
  const since7 = todayStr(new Date(Date.now() - 6 * 86_400_000))

  const [entries, measurements, vitals, exercises, waterRow, checkins, cravings, labs, dayNote, medToday, medAll, checkinsAll, medDefs, stepsAll, waterAll, sleepAll, shoppingAll] = await Promise.all([
    readEntriesLite(),
    dietDb.measurements.orderBy('createdAt').toArray(),
    dietDb.vitals.orderBy('createdAt').toArray(),
    dietDb.exercises.toArray(),
    dietDb.water.where('dateStr').equals(today).first(),
    dietDb.checkins.where('dateStr').equals(today).sortBy('createdAt'),
    dietDb.cravings.toArray(),
    dietDb.labs.orderBy('createdAt').toArray(),
    dietDb.daynotes.where('dateStr').equals(today).first(),
    dietDb.medlogs.where('dateStr').equals(today).sortBy('createdAt'),
    dietDb.medlogs.orderBy('createdAt').toArray(),
    dietDb.checkins.toArray(),
    dietDb.meds.toArray(),
    dietDb.steps.toArray(),
    dietDb.water.toArray(),
    dietDb.sleep.toArray(),
    dietDb.shopping.toArray()
  ])

  const L: string[] = []
  // Satiri ekle. skipIn verilirse, o kapsamlarda satir HIC yazilmaz.
  const add = (text: string, skipIn?: HealthScope[]) => {
    if (skipIn && skipIn.includes(scope)) return
    // DIKKAT: burasi L.push OLMALI. Bir kez `add(text)` yazildi ve fonksiyon
    // kendini cagirir hale geldi; sonsuz ozyineleme her yapay zeka cagrisini
    // "Maximum call stack size exceeded" ile dusurdu.
    L.push(text)
  }

  // BUGUN HANGI GUN? — bu bilgi HIC gonderilmiyordu.
  //
  // Diyet listeleri cogu zaman gune gore degisiyor: "Hafta sonu ogle ve aksam
  // ana yemek menu: ...", "Haftada 5 gun su, haftada 2 gun bu". Model gunu
  // bilmeden listenin hangi kolunu uygulayacagini secemez; cumartesi gunu hafta
  // ici menusune gore kiyaslayip haksiz dusuk uyum veriyordu.
  const dowNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']
  const todayDate = new Date(today + 'T12:00:00')
  const dow = todayDate.getDay()
  const isWeekend = dow === 0 || dow === 6
  add(
    `BUGÜN: ${today} ${dowNames[dow]} — ${isWeekend ? 'HAFTA SONU' : 'hafta içi'}. Diyet listesinde güne göre değişen bölümler varsa (ör. "hafta sonu öğle/akşam menüsü", "haftada 5 gün şu, 2 gün bu") BUGÜNE UYAN bölümü esas al; yanlış günün menüsüyle kıyaslayıp uyumu düşürme. Listede bir öğün için birden fazla alternatif varsa (VEYA ile ayrılmış), kullanıcının yediği HANGİ alternatife yakınsa ONA göre değerlendir — en yakın seçeneği bul, hepsini birden bekleme.`
  )

  // SENI TANIYAN KALICI PROFIL (varsa) — en tepede, tum degerlendirmelerin temeli.
  // DIKKAT: profil ESKI olabilir; guncel sayilar (kilo/olcu/tarih) icin ASAGIDAKI
  // taze verileri esas al — profildeki sayilari "en son" sanma.
  if (settings?.personalProfile?.trim()) {
    add(
      `SENİ TANIYAN KİŞİSEL PROFİL (uygulamanın bu kullanıcı için ÖNCEDEN çıkardığı kalıcı özet — huy/tercih/örüntü için kullan). ÖNEMLİ: Bu profil ESKİ olabilir; GÜNCEL kilo/ölçü/tarih için AŞAĞIDAKI "EN SON ÖLÇÜM" ve "ölçü eğilimi" satırlarını esas al, profildeki sayıları en güncel sanma:\n${settings.personalProfile.trim()}`
    )
  }

  // BUGUNE OZEL not/plan — en basta ve guclu: tum degerlendirmeler buna uysun
  if (dayNote?.text?.trim()) {
    add(
      `BUGÜNE ÖZEL NOT/PLAN (kullanıcı bugün için şunu belirtti — analiz, öneri ve gün değerlendirmesinde MUTLAKA dikkate al, buna aykırı ceza/uyarı verme): "${dayNote.text.trim()}". Örn. öğünleri birleştirdiyse bunu normal say, "çift öğün" gibi değerlendirme.`
    )
  }

  // Profil
  const prof: string[] = []
  if (settings?.gender) prof.push(settings.gender)
  if (settings?.age) prof.push(`${settings.age} yaş`)
  if (settings?.heightCm) prof.push(`boy ${settings.heightCm} cm`)
  const weights = measurements.filter((m) => typeof m.weight === 'number')
  const lastW = weights.length ? (weights[weights.length - 1].weight as number) : undefined
  const lastWDate = weights.length ? weights[weights.length - 1].dateStr : undefined
  if (lastW) prof.push(`kilo ${lastW} kg (${lastWDate})`)
  if (settings?.targetWeight) prof.push(`hedef kilo ${settings.targetWeight} kg`)
  if (prof.length) add(`Profil: ${prof.join(', ')}.`)
  if (settings?.conditions?.trim()) add(`Rahatsızlıklar: ${settings.conditions.trim()}.`)
  // Serbest-metin ilaç listesi YALNIZCA yapılandırılmış ilaç tablosu boşken kullanılsın
  // (aksi halde aynı ilaç 2-3 kez, farklı yazımla geçip modeli yanıltıyordu).
  const hasMedTable = medDefs.some((m) => m.active !== false)
  if (!hasMedTable && settings?.medications?.trim()) add(`Kullandığı ilaçlar: ${settings.medications.trim()}.`)
  if (settings?.activityLevel?.trim()) add(`Hareket düzeyi: ${settings.activityLevel.trim()} (kalori/porsiyon önerisinde dikkate al).`, ['shopping', 'quick'])
  if (settings?.dailyRhythm?.trim()) add(`Günlük düzen (uyku/iş): ${settings.dailyRhythm.trim()} (öğün saati/plan önerisini buna göre yap).`, ['shopping', 'quick'])
  if (settings?.dislikedFoods?.trim())
    add(`Sevmediği/kaçındığı/alerjik yiyecekler (ASLA önerme): ${settings.dislikedFoods.trim()}.`)
  if (settings?.preferences?.trim()) {
    add(
      `KİŞİSEL ALIŞKANLIKLAR/TERCİHLER (analiz ve tahminlerde MUTLAKA bunları esas al, görselden aksini VARSAYMA): ${settings.preferences.trim()}. Örn. "kahveyi şekersiz içer" dendiyse kahveyi şekersiz say, kaloriyi ve şekeri ona göre hesapla.`
    )
  }

  // EN SON ÖLÇÜM — net ve tarihli. AI'ın "güncel veri yok / tek nokta" yanılgısına
  // düşmemesi için en başta, açıkça. (Profil eski olabilir; bu satır TAZE gerçektir.)
  if (measurements.length) {
    const last = measurements[measurements.length - 1]
    const parts: string[] = []
    if (typeof last.weight === 'number') parts.push(`kilo ${last.weight} kg`)
    if (typeof last.arm === 'number') parts.push(`kol ${last.arm} cm`)
    if (typeof last.chest === 'number') parts.push(`göğüs ${last.chest} cm`)
    if (typeof last.fold === 'number') parts.push(`bel kıvrımı ${last.fold} cm`)
    if (typeof last.navel === 'number') parts.push(`göbek ${last.navel} cm`)
    if (typeof last.hip === 'number') parts.push(`kalça ${last.hip} cm`)
    if (typeof last.leg === 'number') parts.push(`bacak ${last.leg} cm`)
    add(
      `EN SON ÖLÇÜM (${last.dateStr} — kullanıcının GİRDİĞİ en güncel veri, bunu esas al): ${parts.join(' · ') || '—'}. Toplam ${measurements.length} ölçüm kaydı var; "veri yok/tek nokta" deme.`
    , ['food', 'shopping', 'quick'])

    // BİR ÖNCEKİ ÖLÇÜME GÖRE — net, TARİHLİ karşılaştırma (AI "önceki haftayı" 30 günlük
    // eğilimin en eski değeriyle KARIŞTIRMASIN). Her ölçü için ayrı ayrı fark.
    const MFIELDS: { k: 'weight' | 'arm' | 'chest' | 'fold' | 'navel' | 'hip' | 'leg'; l: string; u: string }[] = [
      { k: 'weight', l: 'kilo', u: 'kg' },
      { k: 'fold', l: 'bel kıvrımı', u: 'cm' },
      { k: 'navel', l: 'göbek', u: 'cm' },
      { k: 'hip', l: 'kalça', u: 'cm' },
      { k: 'chest', l: 'göğüs', u: 'cm' },
      { k: 'arm', l: 'kol', u: 'cm' },
      { k: 'leg', l: 'bacak', u: 'cm' }
    ]
    if (measurements.length >= 2) {
      const prev = measurements[measurements.length - 2]
      const diffs = MFIELDS.filter((f) => typeof last[f.k] === 'number' && typeof prev[f.k] === 'number').map((f) => {
        const d = fmt((last[f.k] as number) - (prev[f.k] as number))
        return `${f.l} ${prev[f.k]}→${last[f.k]}${f.u} (${d > 0 ? '+' : ''}${d})`
      })
      if (diffs.length) {
        add(
          `BİR ÖNCEKİ ÖLÇÜME GÖRE DEĞİŞİM (${prev.dateStr} → ${last.dateStr} — yani "geçen ölçüme/haftaya göre"): ${diffs.join(' · ')}. ÖNEMLİ: "önceki hafta/önceki ölçüm" derken SADECE bu ${prev.dateStr} değerlerini kullan; daha eski kayıtlarla (30 günlük eğilimin başı) KARIŞTIRMA.`
        , ['food', 'shopping', 'quick'])
      }
    }
  }

  // Kilo + TUM olcu egilimleri (son 30 gun) — "yagdan mi kastan mi" sorusu
  // icin ham veri: kilo sabitken bel/gobek inceliyorsa yag kaybi lehinedir.
  const m30 = measurements.filter((m) => m.dateStr >= since30)
  const m30first = m30.length ? m30[0].dateStr : ''
  const m30last = m30.length ? m30[m30.length - 1].dateStr : ''
  const trend = (key: keyof Measurement, label: string, unit: string): string | null => {
    const withVal = m30.filter((m) => typeof m[key] === 'number')
    if (withVal.length < 2) return null
    const a = withVal[0][key] as number
    const b = withVal[withVal.length - 1][key] as number
    const d = fmt(b - a)
    if (d === 0) return `${label} sabit (${b}${unit})`
    return `${label} ${a}→${b}${unit} (${d > 0 ? '+' : ''}${d})`
  }
  const trends = [
    trend('weight', 'kilo', 'kg'),
    trend('fold', 'bel kıvrımı', 'cm'),
    trend('navel', 'göbek', 'cm'),
    trend('hip', 'kalça', 'cm'),
    trend('chest', 'göğüs', 'cm'),
    trend('arm', 'kol', 'cm'),
    trend('leg', 'bacak', 'cm')
  ].filter(Boolean)
  if (trends.length) {
    add(
      `Son ~30 GÜNLÜK ölçü eğilimi (EN ESKİ kayıt ${m30first} → EN SON ${m30last} arası, birden çok haftayı kapsar — "önceki hafta" DEĞİL): ${trends.join(' · ')}. (Yorum ipucu: kilo sabit/az düşükken bel-göbek inceliyorsa yağ kaybı + kas korunumu olasıdır; kol/bacak inceliyor ama bel değişmiyorsa kas kaybına dikkat çek.)`
    , ['food', 'shopping', 'quick'])
  }

  // TUM ZAMAN yolculugu: ilk kayittan bugune degisim (uzun vadeli seyir).
  // 30 gunluk pencere tum kilo verme surecini gostermeyebilir; bu onu tamamlar.
  const journey = (key: keyof Measurement, label: string, unit: string): string | null => {
    const withVal = measurements.filter((m) => typeof m[key] === 'number')
    if (withVal.length < 2) return null
    const a = withVal[0][key] as number
    const b = withVal[withVal.length - 1][key] as number
    const d = fmt(b - a)
    if (d === 0) return null
    const firstDate = withVal[0].dateStr
    return `${label} ${a}→${b}${unit} (${d > 0 ? '+' : ''}${d}, ${firstDate}’ten beri)`
  }
  const journeys = [
    journey('weight', 'kilo', 'kg'),
    journey('fold', 'bel kıvrımı', 'cm'),
    journey('navel', 'göbek', 'cm'),
    journey('hip', 'kalça', 'cm'),
    journey('chest', 'göğüs', 'cm'),
    journey('arm', 'kol', 'cm'),
    journey('leg', 'bacak', 'cm')
  ].filter(Boolean)
  if (journeys.length) {
    add(`Başlangıçtan bugüne toplam değişim: ${journeys.join(' · ')}. (Kilo düşerken bel/kalça/bacak da inceliyorsa süreç sağlıklı ilerliyor demektir; bunu bütünsel yorumla.)`, ['food', 'shopping', 'quick'])
  }

  // Seker: son 5 olcum + ortalama; tansiyon: son deger
  const sugars = vitals.filter((v) => v.kind === 'seker' && typeof v.sugar === 'number')
  if (sugars.length) {
    const last5 = sugars.slice(-5).map((v) => `${v.sugar}${v.sugarContext ? `(${v.sugarContext})` : ''}`)
    const pool = sugars.slice(-10)
    const avg = Math.round(pool.reduce((s, v) => s + (v.sugar || 0), 0) / pool.length)
    add(`Kan şekeri: son ${last5.length} ölçüm ${last5.join(', ')} mg/dL; son ${pool.length} ölçüm ortalaması ~${avg}.`, ['shopping'])
  }
  const bps = vitals.filter((v) => v.kind === 'tansiyon' && typeof v.systolic === 'number')
  if (bps.length) {
    const b = bps[bps.length - 1]
    add(`Son tansiyon: ${b.systolic}/${b.diastolic}${b.pulse ? `, nabız ${b.pulse}` : ''}.`, ['shopping'])
  }

  // Son 7 gun diyet basarisi ortalamasi
  const adhs: number[] = []
  for (let i = 0; i < 7; i++) {
    const d = todayStr(new Date(Date.now() - i * 86_400_000))
    const p = dayAdherence(entries, d)
    if (p != null) adhs.push(p)
  }
  if (adhs.length) add(`Son 7 gün diyet başarısı ortalaması: %${Math.round(adhs.reduce((a, b) => a + b, 0) / adhs.length)}.`, ['food', 'shopping', 'quick'])

  // HAFTALIK/AYLIK OZET — "bu haftayı/ilerlemeyi değerlendir" isteginde koc bunlari
  // kullansin: spor gecmisi, ogun/kalori gecmisi (bugunle sinirli kalmasin).
  {
    const sum = (arr: typeof exercises) => ({
      n: arr.length,
      min: arr.reduce((s, e) => s + (e.minutes || 0), 0),
      kcal: arr.reduce((s, e) => s + (e.kcal || 0), 0),
      days: new Set(arr.map((e) => e.dateStr)).size
    })
    const ex7 = sum(exercises.filter((e) => e.dateStr >= since7))
    const ex30 = sum(exercises.filter((e) => e.dateStr >= since30))
    if (ex30.n) {
      add(
        // NOT: Health Connect'ten gelen antrenmanlarda kalori YOK (eklentinin
        // verdigi sayi bazal metabolizmayi iceriyordu, bilerek silindi).
        // Sifirsa "~0 kcal" yazmak yaniltici olur — o parcayi hic yazmiyoruz.
        // Gunun gercek hareket kalorisi zaten ADIM satirinda ("kcal aktivite").
        `SPOR geçmişi: son 7 günde ${ex7.n} antrenman (${ex7.days} gün, ${ex7.min} dk${ex7.kcal ? `, ~${ex7.kcal} kcal` : ''}); son 30 günde ${ex30.n} antrenman (${ex30.days} gün, ${ex30.min} dk${ex30.kcal ? `, ~${ex30.kcal} kcal` : ''}). Haftalık değerlendirmede spor düzenini ve kalori yakımını dikkate al; antrenman kalorisi yoksa günlük aktivite kalorisine bak.`
      , ['food', 'shopping', 'quick'])
    }
    // Ogun/kalori gecmisi (son 7 gun): gunluk ortalama alinan kalori
    const ateAll = entries.filter((e) => e.decision === 'ate')
    const days7 = new Set(ateAll.filter((e) => e.dateStr >= since7).map((e) => e.dateStr))
    if (days7.size) {
      const kcal7 = ateAll.filter((e) => e.dateStr >= since7).reduce((s, e) => s + (e.estimatedCalories || 0), 0)
      add(`ÖĞÜN geçmişi: son 7 günde ${days7.size} gün kayıt, toplam ~${kcal7} kcal (günlük ort. ~${Math.round(kcal7 / days7.size)} kcal). Haftalık değerlendirmede bu eğilimi kullan.`, ['food', 'shopping', 'quick'])
    }

    // TÜM ZAMAN (ilk kayıttan bugüne) genel tablo — koç haftayı değerlendirirken tüm
    // yolculuğu da görsün; eski verilerde de işine yarayacak örüntü olabilir.
    const allDates = new Set<string>()
    entries.forEach((e) => allDates.add(e.dateStr))
    const firstDate = [...entries.map((e) => e.dateStr), ...measurements.map((m) => m.dateStr), ...exercises.map((e) => e.dateStr)]
      .filter(Boolean)
      .sort()[0]
    if (firstDate) {
      const allAdh: number[] = []
      for (const d of allDates) {
        const p = dayAdherence(entries, d)
        if (p != null) allAdh.push(p)
      }
      const bits: string[] = [`ilk kayıt ${firstDate}`, `${allDates.size} gün öğün kaydı`]
      if (ateAll.length) bits.push(`toplam ${ateAll.length} öğün`)
      if (allAdh.length) bits.push(`tüm zaman diyet başarısı ort. %${Math.round(allAdh.reduce((a, b) => a + b, 0) / allAdh.length)}`)
      if (exercises.length)
      {
        const exMin = exercises.reduce((s, e) => s + (e.minutes || 0), 0)
        const exKcal = exercises.reduce((s, e) => s + (e.kcal || 0), 0)
        bits.push(`${exercises.length} antrenman (${exMin} dk${exKcal ? `, ~${exKcal} kcal` : ''})`)
      }
      add(
        `BAŞLANGIÇTAN BUGÜNE GENEL: ${bits.join(' · ')}. Haftalık/ilerleme değerlendirmesinde SADECE bu haftaya değil, ilk kayıttan bugüne bu uzun vadeli tabloya da bak; eski verilerdeki örüntü/ilerlemeyi de kullan.`
      , ['food', 'shopping', 'quick'])
    }

    // BİRLEŞİK ÖĞÜNLER: kullanıcı geç kalkınca iki öğünü tek kayıtta birleştirmiş olabilir.
    // O günlerde ilgili iki öğünü TEK öğün say; "öğün atladı" DEME.
    const combined = entries.filter((e) => e.alsoMeal && e.dateStr >= since14)
    if (combined.length) {
      const list = combined
        .slice(-8)
        .map((e) => `${e.dateStr}: ${mealLabel(e.mealType)}${[e.alsoMeal, e.alsoMeal2].filter(Boolean).map((x) => '+' + mealLabel(x as never)).join('')}`)
        .join(' · ')
      add(
        `BİRLEŞİK ÖĞÜNLER (son 14 gün — kullanıcı bu günlerde iki öğünü tek öğünde birleştirdi): ${list}. Bu günlerde ilgili iki öğünü TEK öğün gibi değerlendir, "kahvaltı/öğün atladın" deme.`
      , ['food', 'shopping', 'quick'])
    }
  }

  // GÜNLÜK AKTİVİTE (akıllı saatten): bugünkü + son 7 gün ortalaması. Kalori dengesi
  // ve hareket düzeyi yorumunda kullan (adım/etkin süre/aktivite-toplam kalori/mesafe).
  if (stepsAll.length) {
    const st = stepsAll.find((s) => s.dateStr === today)
    if (st) {
      const p: string[] = []
      if (st.count) p.push(`${st.count} adım`)
      if (st.activeMin) p.push(`${st.activeMin} dk etkin`)
      // Bazal metabolizmayi iceren "toplam yakim" KOCA VERILMEZ; mukerrer
      // kayitlar yuzunden sisiyor ve kalori butcesini ucuruyor (lib/movement.ts).
      const mk = movementKcal(st)
      if (mk) p.push(`~${mk} kcal hareket`)
      const dk = plausibleDistanceKm(st)
      if (dk) p.push(`${dk} km`)
      if (p.length) add(`Bugünkü aktivite (saatten): ${p.join(' · ')}.`, ['shopping', 'quick'])
    }
    const last7 = stepsAll.filter((s) => s.dateStr >= since7)
    if (last7.length) {
      const avg = (sel: (s: (typeof last7)[number]) => number | undefined) => {
        const vals = last7.map(sel).filter((n): n is number => typeof n === 'number' && n > 0)
        return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0
      }
      const aSteps = avg((s) => s.count)
      const aBurn = avg((s) => movementKcal(s))
      if (aSteps || aBurn) {
        add(
          `Son 7 gün aktivite ort.: ${aSteps ? `${aSteps} adım/gün` : ''}${aSteps && aBurn ? ', ' : ''}${aBurn ? `~${aBurn} kcal/gün hareket` : ''}. Kalori dengesi ve hareket düzeyini buna göre değerlendir.`
        , ['food', 'shopping', 'quick'])
      }
    }
  }

  // Bugunku durum: kalori, su, spor, son moral
  const todays = entries.filter((e) => e.dateStr === today && e.decision === 'ate')
  const kcal = todays.reduce((s, e) => s + (e.estimatedCalories || 0), 0)
  const waterMl = waterRow ? (waterRow.ml != null ? waterRow.ml : (waterRow.glasses || 0) * 200) : 0
  const exToday = exercises.filter((e) => e.dateStr === today)
  const bits = [`~${kcal} kcal alındı${settings?.calorieGoal ? ` (günlük hedef ${settings.calorieGoal})` : ''}`]
  if (waterMl > 0) bits.push(`${waterMl} ml su içildi`)
  if (exToday.length)
    bits.push(
      `spor: ${exToday
        .map((e) => {
          const d = [
            e.minutes ? `${e.minutes} dk` : '',
            e.distanceKm ? `${e.distanceKm} km` : '',
            e.steps ? `${e.steps} adım` : '',
            e.avgHr ? `${e.avgHr} bpm` : '',
            e.cadence ? `${e.cadence} adım/dk` : '',
            e.kcal ? `~${e.kcal} kcal` : ''
          ]
            .filter(Boolean)
            .join(', ')
          return d ? `${e.text} (${d})` : e.text
        })
        .join('; ')}`
    )
  const lastMood = checkins.length ? checkins[checkins.length - 1] : undefined
  if (lastMood?.mood != null) bits.push(`son moral ${lastMood.mood}/10${lastMood.note ? ` ("${lastMood.note}")` : ''}`)
  add(`Bugün şu ana kadar: ${bits.join(' · ')}.`)

  // TEK DOKUNUSLA eklenenler (cay/kahve/ayran gibi sik tuketilenler). Bunlar
  // OGUN DEGIL; kullanici bilerek yapay zekaya inceletmedi. Ayri yaziyoruz ki
  // koc bunlari "ogun atladi/bozdu" diye degerlendirmesin, ama kafein ve
  // kalori toplaminda hesaba katabilsin.
  const quicks = entries.filter((e) => e.dateStr === today && e.quick)
  if (quicks.length) {
    const q = new Map<string, { n: number; kcal: number }>()
    for (const e of quicks) {
      const cur = q.get(e.foodName) ?? { n: 0, kcal: 0 }
      q.set(e.foodName, { n: cur.n + 1, kcal: cur.kcal + (e.estimatedCalories || 0) })
    }
    const list = [...q.entries()].map(([n, v]) => `${v.n}× ${n}${v.kcal ? ` (~${v.kcal} kcal)` : ''}`).join(', ')
    add(
      `Bugün tek dokunuşla eklediği içecek/atıştırmalıklar (ÖĞÜN DEĞİL — kullanıcı bunları bilerek incelettirmedi, öğün gibi değerlendirme ve puan kırma): ${list}. Kalori toplamına dahildir; kafein/şeker yorumunda kullanabilirsin.`,
      ['shopping', 'quick']
    )
  }

  // SU (genel saglik icin temel): bugunku alim hedefe gore + son 7 gun ortalamasi.
  // PROAKTIF: yetersizse gun icinde suyu ARTIRMASINI net soyle (koc/analiz/checkup
  // her yerde). Kafein ve egzersizle su ihtiyacini iliskilendir.
  {
    const mlOf = (w?: { ml?: number; glasses?: number }) => (w ? (w.ml != null ? w.ml : (w.glasses || 0) * 200) : 0)
    const goalMl = settings?.waterGoal ? settings.waterGoal * 200 : 2500
    const todayMl = mlOf(waterRow)
    let sum7 = 0
    for (let i = 0; i < 7; i++) {
      const d = todayStr(new Date(Date.now() - i * 86_400_000))
      sum7 += mlOf(waterAll.find((w) => w.dateStr === d))
    }
    const avg7 = Math.round(sum7 / 7)
    const pctToday = goalMl ? Math.round((todayMl / goalMl) * 100) : 0
    const low = todayMl < goalMl * 0.6 || todayMl < 1500
    add(
      `SU DURUMU (genel sağlık için ÖNEMLİ): bugün ${todayMl} ml içildi (hedef ${goalMl} ml, %${pctToday}); son 7 gün ort. ~${avg7} ml/gün. ` +
        (low
          ? `Su BUGÜN YETERSİZ görünüyor — gün içinde suyu ARTIRMASINI net ama nazikçe söyle (ör. "bir sonraki saat başlarında birer bardak su iç"). `
          : `Su bugün iyi gidiyor, kısaca takdir edebilirsin. `) +
        `Az su; kabızlık, baş ağrısı, yorgunluk, koyu idrar ve tokluk hissinde azalmayla bağlantılıdır. Kafein (kahve/çay) ve egzersiz su ihtiyacını ARTIRIR — bunları birlikte yorumla.`
    , ['food', 'shopping', 'quick'])
  }

  // UYKU (Samsung Health/Health Connect'ten ya da elle): dun gece + 7 gun ort.
  // Uyku; aclik hormonlari (ghrelin/leptin), tatli krizi, insulin direnci ve
  // toparlanma ile dogrudan iliskilidir — bunlari BIRLIKTE yorumla.
  if (sleepAll.length) {
    const lastNight = sleepAll.find((s) => s.dateStr === today)
    let sum7 = 0
    let n7 = 0
    for (let i = 0; i < 7; i++) {
      const d = todayStr(new Date(Date.now() - i * 86_400_000))
      const row = sleepAll.find((s) => s.dateStr === d)
      if (row?.hours) {
        sum7 += row.hours
        n7++
      }
    }
    const avg7 = n7 ? Math.round((sum7 / n7) * 10) / 10 : 0
    const bits: string[] = []
    if (lastNight?.hours) bits.push(`dün gece ${lastNight.hours} saat`)
    if (avg7) bits.push(`son 7 gün ort. ${avg7} saat/gece (${n7} gece kaydı)`)
    if (bits.length) {
      const short = (lastNight?.hours ?? avg7) > 0 && (lastNight?.hours ?? avg7) < 6.5
      add(
        `UYKU: ${bits.join(' · ')}. ` +
          (short
            ? 'Uyku YETERSİZ görünüyor (<6,5 sa). Az uyku; açlık hormonlarını bozar (ghrelin↑/leptin↓), tatlı-karbonhidrat krizini artırır, insülin direncini ve kan şekerini kötüleştirir, antrenman toparlanmasını yavaşlatır. Bugün tatlı krizi/fazla yeme olduysa bunu uykuyla İLİŞKİLENDİR ve erken yatmayı, akşam kafeini kesmeyi öner. '
            : 'Uyku iyi görünüyor; toparlanma ve iştah kontrolü açısından bunu kısaca olumlu belirtebilirsin. ') +
          'Kilo durağanlığı, açlık örüntüsü ve kafein tüketimiyle birlikte değerlendir.'
      , ['food', 'shopping', 'quick'])
    }
  }

  // KAHVE/KAFEIN: bugunku kafeinli icecek sayisi. Uyku/tansiyon/su ile iliskilendir.
  {
    const isCaffeine = (n?: string) =>
      !!n && /kahve|espresso|latte|cappuccino|americano|mocha|nescafe|filtre|çay(?!dan)|matcha|enerji ?i[çc]ece/i.test(n)
    const coffeeToday = entries.filter((e) => e.dateStr === today && e.decision === 'ate' && isCaffeine(e.foodName)).length
    if (coffeeToday > 0) {
      add(
        `KAHVE/KAFEİN: bugün ~${coffeeToday} kafeinli içecek (kahve/çay vb.). Kafein idrar söktürür (su ihtiyacını artırır) ve fazlası uykuyu, kalp çarpıntısını, tansiyonu ve kan şekeri dalgalanmasını etkileyebilir. Çoksa (≥3-4) öğleden sonra/akşam azaltmasını ve yanında su içmesini öner; tansiyon/şeker verisiyle birlikte değerlendir.`
      , ['food', 'shopping', 'quick'])
    }
  }

  // Bugunku ACLIK kayitlari (moralden AYRI boyut) — ogun/aktivite ile bag kur.
  // Ornek: "14:00 açlık 8/10" ama son ogun 11:00 ise porsiyon/protein yetersiz.
  const hungerToday = checkins.filter((c) => c.hunger != null)
  if (hungerToday.length) {
    const hs = hungerToday
      .map((c) => `${new Date(c.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} açlık ${c.hunger}/10`)
      .join(', ')
    add(
      `Bugünkü AÇLIK kayıtları (1 tok–10 çok aç; moralden ayrı): ${hs}. Yüksek açlık saatlerini son öğünle ve aktiviteyle ilişkilendir; sık erken acıkıyorsa porsiyon/protein/lif önerisi ver.`
    , ['shopping', 'quick'])
  }

  // ACLIK ORUNTUSU (son 30 gun): en sik hangi saatlerde cok acikiyor (>=7/10).
  // Proaktif oneri/hatirlatma icin sinyal: "genelde 16'da acikiyorsun".
  const hungry30 = checkinsAll.filter((c) => c.dateStr >= since30 && (c.hunger ?? 0) >= 7)
  if (hungry30.length >= 3) {
    const hourCount = new Map<number, number>()
    for (const c of hungry30) {
      const h = new Date(c.createdAt).getHours()
      hourCount.set(h, (hourCount.get(h) ?? 0) + 1)
    }
    const top = [...hourCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([h]) => `${h}:00`)
    add(
      `AÇLIK ÖRÜNTÜSÜ: son 30 günde en çok ${top.join(' ve ')} civarı acıkıyor (yüksek açlık kaydı). Bu saatlerden önce ara öğün/su öner, proaktif davran.`
    , ['food', 'quick'])
  }

  // TANIMLI ILAC/VITAMIN listesi + bugunku uyum (planlanan vs alinan)
  const activeMeds = medDefs.filter((m) => m.active !== false)
  if (activeMeds.length) {
    const todayDow = new Date(today + 'T00:00:00').getDay()
    const todaysMeds = activeMeds.filter((m) => !m.days || !m.days.length || m.days.includes(todayDow))
    const defLines = activeMeds.map((m) => {
      const rel = m.relation === 'tok' ? 'tok' : m.relation === 'ac' ? 'aç' : 'farketmez'
      const gun = !m.days || !m.days.length ? 'her gün' : m.days.map((d) => ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'][d]).join(',')
      return `${m.name}${m.brand ? ` [${m.brand}]` : ''} (${m.kind === 'vitamin' ? 'vitamin' : 'ilaç'}, ${rel}, ${gun}, saat ${m.times?.join('/') || '—'})`
    })
    add(`Düzenli kullandığı ilaç/vitaminler: ${defLines.join('; ')}.`, ['shopping', 'quick'])
    // Etken madde analizleri (varsa): ilerleme/gerileme yorumlarinda yediklerle
    // BIRLIKTE degerlendir (ornegin D vitamini + gunes, omega-3 + lipid profili).
    const ingLines = activeMeds
      .filter((m) => m.ingredients?.trim())
      .map((m) => `• ${m.name}: ${m.ingredients!.trim().replace(/\s+/g, ' ')}`)
    if (ingLines.length) {
      add(
        `İlaç/vitamin ETKEN MADDE bilgisi (yorumlarda beslenme ve ilerleme/gerileme ile birlikte kullan; teşhis/doz tavsiyesi verme):\n${ingLines.join('\n')}`
      , ['food', 'shopping', 'quick'])
    }
    // Bugun alinmamis dozlar
    const missing = todaysMeds
      .filter((m) => {
        const need = (m.times || []).length || 1
        const got = medToday.filter((l) => l.medId === m.id).length
        return got < need
      })
      .map((m) => m.name)
    if (missing.length) {
      add(`Bugün HENÜZ alınmamış görünen ilaç/vitamin: ${missing.join(', ')} — uygunsa nazikçe hatırlat.`, ['food', 'shopping', 'quick'])
    }
  }

  // ILAC kullanim kayitlari: bugun alinanlar + son 7 gun duzeni. Ogunle iliskisi
  // (ac/tok) onemli; ilac yemekten sonra aliniyor mu goruntule.
  if (medToday.length) {
    const ms = medToday
      .map((m) => {
        const t = new Date(m.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
        const rel = m.relation === 'tok' ? ' (yemekten sonra)' : m.relation === 'ac' ? ' (aç karnına)' : ''
        return `${t} ${m.name}${rel}`
      })
      .join(', ')
    add(`Bugün alınan ilaçlar: ${ms}.`, ['food', 'shopping', 'quick'])
  }
  const med7 = medAll.filter((m) => m.dateStr >= todayStr(new Date(Date.now() - 6 * 86_400_000)))
  if (med7.length >= 3) {
    const days = new Set(med7.map((m) => m.dateStr)).size
    add(`Son 7 günde ${med7.length} ilaç kaydı (${days} gün) — düzenliliği ve öğünle ilişkisini değerlendirebilirsin.`, ['food', 'shopping', 'quick'])
  }

  // (Tokluk/satiety özelliği kaldırıldı — artık kaydedilmiyor; ilgili sinyal üretilmez.)

  // Kriz oruntusu (son 14 gun): saat dagilimi + direnc orani
  const cr = cravings.filter((c) => c.dateStr >= since14)
  if (cr.length) {
    const hrs = cr.map((c) => `${new Date(c.createdAt).getHours()}:00`)
    const res = cr.filter((c) => c.outcome === 'resisted').length
    add(`Son 14 günde ${cr.length} kriz anı (saatler: ${hrs.join(', ')}); ${res}/${cr.length} direnç. Kriz saatleri yaklaşırken önden uyarabilirsin.`, ['food', 'shopping', 'quick'])
  }

  // TANIDIK YIYECEKLER: kullanicinin daha once yedigi yiyecekler — fotograf
  // tanimada onyargi/ipucu olsun. Kullanici bir yemegi duzeltince (dogru adla
  // kaydedince) o da bu listeye girer; boylece ayni hata tekrarlanmaz.
  const freq = new Map<string, number>()
  for (const e of entries) {
    if (e.decision !== 'ate') continue
    const name = (e.foodName || '').trim()
    if (name && name.length <= 40) freq.set(name, (freq.get(name) ?? 0) + 1)
  }
  const known = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18).map(([n]) => n)
  if (known.length) {
    add(
      `Kullanıcının daha önce yediği/tanıdığı yiyecekler (bir FOTOĞRAFI değerlendirirken, görseldeki şey bunlardan birine benziyorsa önce bunu düşün; örn. kahverengi kurutulmuş meyveyi yanlış türle karıştırma): ${known.join(', ')}.`
    , ['shopping', 'quick'])
  }

  // Son tahlil(ler): en yeni 1-2 kaydin kisa ozeti (kompakt tutulur). Boylece
  // koc/yemek/seker analizi de tahlil sonuclarini (HbA1c, kolesterol vb.) bilir.
  if (labs.length) {
    const recent = labs.slice(-2)
    const bits = recent.map((lb) => {
      const body = (lb.analysis?.trim() || lb.text?.trim() || '').replace(/\s+/g, ' ').slice(0, 500)
      return `[${lb.dateStr}] ${lb.title || 'Tahlil'}: ${body}`
    })
    add(`Son tahlil(ler) (özet; ilaç/rahatsızlıkla birlikte değerlendir):\n${bits.join('\n')}`, ['shopping', 'quick'])
  }

  // ALISVERIS LISTESI: evde neyin var/neyin eksik oldugunu gosterir. "Ne yesem",
  // menu ve oneri modulleri var olan urunlerden oneri yapsin, olmayani istemesin.
  if (shoppingAll.length) {
    const pending = shoppingAll.filter((s) => !s.done).map((s) => s.text.trim()).filter(Boolean).slice(0, 25)
    // Son 7 gunde isaretlenenler ~ eve yeni girmis urunler
    const since = Date.now() - 7 * 86_400_000
    const bought = shoppingAll
      .filter((s) => s.done && s.createdAt >= since)
      .map((s) => s.text.trim())
      .filter(Boolean)
      .slice(0, 20)
    if (bought.length) add(`Son günlerde alışverişte işaretlediği (evde olması muhtemel) ürünler: ${bought.join(', ')}.`, ['food', 'quick'])
    if (pending.length) add(`Alışveriş listesinde HENÜZ ALINMAMIŞ ürünler (bunları "evde var" sayma): ${pending.join(', ')}.`, ['food', 'quick'])
  }

  return L.join('\n')
}



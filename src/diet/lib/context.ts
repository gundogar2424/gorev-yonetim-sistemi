// ORTAK SAGLIK AKLI: veritabanindaki HER SEYDEN kompakt bir baglam metni
// uretir ve tum yapay zeka modullerine verilir. Boylece moduller birbirinin
// verisini kullanir (kilo/olcu egilimi, seker, ilac, bugunku durum, kriz
// oruntusu...). Yerel DB okumasi — internet/token maliyeti sadece bu metnin
// modele gitmesi kadardir.
import { dietDb } from '../db'
import { todayStr, dayAdherence } from '../streak'
import { mealLabel } from './meals'
import type { DietSettings, Measurement } from '../types'

const fmt = (n: number) => Math.round(n * 10) / 10

export async function buildHealthContext(settings?: DietSettings): Promise<string> {
  const today = todayStr()
  const since30 = todayStr(new Date(Date.now() - 29 * 86_400_000))
  const since14 = todayStr(new Date(Date.now() - 13 * 86_400_000))

  const [entries, measurements, vitals, exercises, waterRow, checkins, cravings, labs, dayNote, medToday, medAll, checkinsAll, medDefs] = await Promise.all([
    dietDb.entries.toArray(),
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
    dietDb.meds.toArray()
  ])

  const L: string[] = []

  // SENI TANIYAN KALICI PROFIL (varsa) — en tepede, tum degerlendirmelerin temeli
  if (settings?.personalProfile?.trim()) {
    L.push(
      `SENİ TANIYAN KİŞİSEL PROFİL (uygulamanın bu kullanıcı için çıkardığı kalıcı özet — önerilerini ve yorumlarını buna göre kişiselleştir, buradaki kurallara uy):\n${settings.personalProfile.trim()}`
    )
  }

  // BUGUNE OZEL not/plan — en basta ve guclu: tum degerlendirmeler buna uysun
  if (dayNote?.text?.trim()) {
    L.push(
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
  if (lastW) prof.push(`kilo ${lastW} kg`)
  if (settings?.targetWeight) prof.push(`hedef kilo ${settings.targetWeight} kg`)
  if (prof.length) L.push(`Profil: ${prof.join(', ')}.`)
  if (settings?.conditions?.trim()) L.push(`Rahatsızlıklar: ${settings.conditions.trim()}.`)
  if (settings?.medications?.trim()) L.push(`Kullandığı ilaçlar: ${settings.medications.trim()}.`)
  if (settings?.activityLevel?.trim()) L.push(`Hareket düzeyi: ${settings.activityLevel.trim()} (kalori/porsiyon önerisinde dikkate al).`)
  if (settings?.dailyRhythm?.trim()) L.push(`Günlük düzen (uyku/iş): ${settings.dailyRhythm.trim()} (öğün saati/plan önerisini buna göre yap).`)
  if (settings?.dislikedFoods?.trim())
    L.push(`Sevmediği/kaçındığı/alerjik yiyecekler (ASLA önerme): ${settings.dislikedFoods.trim()}.`)
  if (settings?.preferences?.trim()) {
    L.push(
      `KİŞİSEL ALIŞKANLIKLAR/TERCİHLER (analiz ve tahminlerde MUTLAKA bunları esas al, görselden aksini VARSAYMA): ${settings.preferences.trim()}. Örn. "kahveyi şekersiz içer" dendiyse kahveyi şekersiz say, kaloriyi ve şekeri ona göre hesapla.`
    )
  }

  // Kilo + TUM olcu egilimleri (son 30 gun) — "yagdan mi kastan mi" sorusu
  // icin ham veri: kilo sabitken bel/gobek inceliyorsa yag kaybi lehinedir.
  const m30 = measurements.filter((m) => m.dateStr >= since30)
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
    L.push(
      `Son 30 gün ölçü eğilimi: ${trends.join(' · ')}. (Yorum ipucu: kilo sabit/az düşükken bel-göbek inceliyorsa yağ kaybı + kas korunumu olasıdır; kol/bacak inceliyor ama bel değişmiyorsa kas kaybına dikkat çek.)`
    )
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
    L.push(`Başlangıçtan bugüne toplam değişim: ${journeys.join(' · ')}. (Kilo düşerken bel/kalça/bacak da inceliyorsa süreç sağlıklı ilerliyor demektir; bunu bütünsel yorumla.)`)
  }

  // Seker: son 5 olcum + ortalama; tansiyon: son deger
  const sugars = vitals.filter((v) => v.kind === 'seker' && typeof v.sugar === 'number')
  if (sugars.length) {
    const last5 = sugars.slice(-5).map((v) => `${v.sugar}${v.sugarContext ? `(${v.sugarContext})` : ''}`)
    const pool = sugars.slice(-10)
    const avg = Math.round(pool.reduce((s, v) => s + (v.sugar || 0), 0) / pool.length)
    L.push(`Kan şekeri: son ölçümler ${last5.join(', ')} mg/dL; son ortalama ~${avg}.`)
  }
  const bps = vitals.filter((v) => v.kind === 'tansiyon' && typeof v.systolic === 'number')
  if (bps.length) {
    const b = bps[bps.length - 1]
    L.push(`Son tansiyon: ${b.systolic}/${b.diastolic}${b.pulse ? `, nabız ${b.pulse}` : ''}.`)
  }

  // Son 7 gun diyet basarisi ortalamasi
  const adhs: number[] = []
  for (let i = 0; i < 7; i++) {
    const d = todayStr(new Date(Date.now() - i * 86_400_000))
    const p = dayAdherence(entries, d)
    if (p != null) adhs.push(p)
  }
  if (adhs.length) L.push(`Son 7 gün diyet başarısı ortalaması: %${Math.round(adhs.reduce((a, b) => a + b, 0) / adhs.length)}.`)

  // Bugunku durum: kalori, su, spor, son moral
  const todays = entries.filter((e) => e.dateStr === today && e.decision === 'ate')
  const kcal = todays.reduce((s, e) => s + (e.estimatedCalories || 0), 0)
  const waterMl = waterRow ? (waterRow.ml != null ? waterRow.ml : (waterRow.glasses || 0) * 200) : 0
  const exToday = exercises.filter((e) => e.dateStr === today)
  const bits = [`~${kcal} kcal alındı${settings?.calorieGoal ? ` (günlük hedef ${settings.calorieGoal})` : ''}`]
  if (waterMl > 0) bits.push(`${waterMl} ml su içildi`)
  if (exToday.length) bits.push(`spor: ${exToday.map((e) => e.text).join(', ')}`)
  const lastMood = checkins.length ? checkins[checkins.length - 1] : undefined
  if (lastMood?.mood != null) bits.push(`son moral ${lastMood.mood}/10${lastMood.note ? ` ("${lastMood.note}")` : ''}`)
  L.push(`Bugün şu ana kadar: ${bits.join(' · ')}.`)

  // Bugunku ACLIK kayitlari (moralden AYRI boyut) — ogun/aktivite ile bag kur.
  // Ornek: "14:00 açlık 8/10" ama son ogun 11:00 ise porsiyon/protein yetersiz.
  const hungerToday = checkins.filter((c) => c.hunger != null)
  if (hungerToday.length) {
    const hs = hungerToday
      .map((c) => `${new Date(c.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} açlık ${c.hunger}/10`)
      .join(', ')
    L.push(
      `Bugünkü AÇLIK kayıtları (1 tok–10 çok aç; moralden ayrı): ${hs}. Yüksek açlık saatlerini son öğünle ve aktiviteyle ilişkilendir; sık erken acıkıyorsa porsiyon/protein/lif önerisi ver.`
    )
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
    L.push(
      `AÇLIK ÖRÜNTÜSÜ: son 30 günde en çok ${top.join(' ve ')} civarı acıkıyor (yüksek açlık kaydı). Bu saatlerden önce ara öğün/su öner, proaktif davran.`
    )
  }

  // TANIMLI ILAC/VITAMIN listesi + bugunku uyum (planlanan vs alinan)
  const activeMeds = medDefs.filter((m) => m.active !== false)
  if (activeMeds.length) {
    const todayDow = new Date(today + 'T00:00:00').getDay()
    const todaysMeds = activeMeds.filter((m) => !m.days || !m.days.length || m.days.includes(todayDow))
    const defLines = activeMeds.map((m) => {
      const rel = m.relation === 'tok' ? 'tok' : m.relation === 'ac' ? 'aç' : 'farketmez'
      const gun = !m.days || !m.days.length ? 'her gün' : m.days.map((d) => ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'][d]).join(',')
      return `${m.name} (${m.kind === 'vitamin' ? 'vitamin' : 'ilaç'}, ${rel}, ${gun}, saat ${m.times?.join('/') || '—'})`
    })
    L.push(`Düzenli kullandığı ilaç/vitaminler: ${defLines.join('; ')}.`)
    // Bugun alinmamis dozlar
    const missing = todaysMeds
      .filter((m) => {
        const need = (m.times || []).length || 1
        const got = medToday.filter((l) => l.medId === m.id).length
        return got < need
      })
      .map((m) => m.name)
    if (missing.length) {
      L.push(`Bugün HENÜZ alınmamış görünen ilaç/vitamin: ${missing.join(', ')} — uygunsa nazikçe hatırlat.`)
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
    L.push(`Bugün alınan ilaçlar: ${ms}.`)
  }
  const med7 = medAll.filter((m) => m.dateStr >= todayStr(new Date(Date.now() - 6 * 86_400_000)))
  if (med7.length >= 3) {
    const days = new Set(med7.map((m) => m.dateStr)).size
    L.push(`Son 7 günde ${med7.length} ilaç kaydı (${days} gün) — düzenliliği ve öğünle ilişkisini değerlendirebilirsin.`)
  }

  // Tokluk dusuk ogun tipleri (son 14 gun) — porsiyon sinyali
  const lowSat = entries.filter((e) => e.dateStr >= since14 && e.decision === 'ate' && e.satiety != null && e.satiety <= 4)
  if (lowSat.length) {
    const byMeal = new Map<string, number>()
    for (const e of lowSat) {
      const k = e.mealType ? mealLabel(e.mealType) : 'Diğer'
      byMeal.set(k, (byMeal.get(k) ?? 0) + 1)
    }
    L.push(
      `Son 14 günde tokluğu düşük (≤4/10) öğünler: ${[...byMeal.entries()].map(([k, n]) => `${k} x${n}`).join(', ')} — porsiyon yetersizliği sinyali.`
    )
  }

  // Kriz oruntusu (son 14 gun): saat dagilimi + direnc orani
  const cr = cravings.filter((c) => c.dateStr >= since14)
  if (cr.length) {
    const hrs = cr.map((c) => `${new Date(c.createdAt).getHours()}:00`)
    const res = cr.filter((c) => c.outcome === 'resisted').length
    L.push(`Son 14 günde ${cr.length} kriz anı (saatler: ${hrs.join(', ')}); ${res}/${cr.length} direnç. Kriz saatleri yaklaşırken önden uyarabilirsin.`)
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
    L.push(
      `Kullanıcının daha önce yediği/tanıdığı yiyecekler (bir FOTOĞRAFI değerlendirirken, görseldeki şey bunlardan birine benziyorsa önce bunu düşün; örn. kahverengi kurutulmuş meyveyi yanlış türle karıştırma): ${known.join(', ')}.`
    )
  }

  // Son tahlil(ler): en yeni 1-2 kaydin kisa ozeti (kompakt tutulur). Boylece
  // koc/yemek/seker analizi de tahlil sonuclarini (HbA1c, kolesterol vb.) bilir.
  if (labs.length) {
    const recent = labs.slice(-2)
    const bits = recent.map((lb) => {
      const body = (lb.analysis?.trim() || lb.text?.trim() || '').replace(/\s+/g, ' ').slice(0, 500)
      return `[${lb.dateStr}] ${lb.title || 'Tahlil'}: ${body}`
    })
    L.push(`Son tahlil(ler) (özet; ilaç/rahatsızlıkla birlikte değerlendir):\n${bits.join('\n')}`)
  }

  return L.join('\n')
}

import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { useLiveQuery } from 'dexie-react-hooks'
import DietHeader from '../DietHeader'
import { dietDb, readDietSettings, saveDietSettings, listExercises, listMeasurements, getWaterMlDay, addWaterMl, listWater, listCheckinsDay, addCheckin, deleteCheckin, addCraving, listShopping, setDayNote, addDraftEntry, getStepsRow } from '../db'
import { analyzeFood, analyzeFoodByText, chatAboutFood, coachChat, cravingHelp, menuChat, mealClarifyChat, splitDietPlanMeals } from '../ai'
import { computeStats, todayStr, dayAdherence, TRACKED_MEALS, setActiveMeals } from '../streak'
import { quoteOfDay } from '../lib/quotes'
import { scheduleSugarReminder, applyNotifications, activeMealTypes, mergeReminders } from '../lib/notify'
import { fileToResizedDataUrl, urlToResizedDataUrl } from '../../lib/image'
import { MEAL_OPTIONS, guessMeal, mealLabel, mealEmoji } from '../lib/meals'
import { isBeverage } from '../lib/food'
import { decodeBarcodeFromImage } from '../lib/barcode'
import { buildHealthContext } from '../lib/context'
import { autoSyncHealthToday } from '../lib/health'
import { fetchMenuContent } from '../lib/webmenu'
import { nativeScan } from '../lib/barcode'
import type { Decision, DietEntry, FoodAnalysis, MealType, Measurement, Exercise, DietSettings, CheckIn } from '../types'

type Phase = 'idle' | 'converse' | 'analyzing' | 'result' | 'saved'

// Bir Date'i yerel <input type="datetime-local"> degerine cevirir (YYYY-MM-DDTHH:mm)
function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

// Yemegin saglik durumuna gore renk temasi (yesil = saglikli, sari = orta, kirmizi = riskli)
interface Theme {
  band: string
  soft: string
  text: string
  chip: string
  emoji: string
  label: string
}
function healthTheme(a: FoodAnalysis): Theme {
  if (a.healthy || a.riskLevel === 'düşük') {
    return {
      band: 'bg-emerald-600',
      soft: 'bg-emerald-50',
      text: 'text-emerald-700',
      chip: 'bg-emerald-100 text-emerald-800',
      emoji: '✅',
      label: 'Sağlıklı seçim'
    }
  }
  if (a.riskLevel === 'orta') {
    return {
      band: 'bg-amber-500',
      soft: 'bg-amber-50',
      text: 'text-amber-700',
      chip: 'bg-amber-100 text-amber-800',
      emoji: '⚠️',
      label: 'Dikkatli ol'
    }
  }
  return {
    band: 'bg-rose-600',
    soft: 'bg-rose-50',
    text: 'text-rose-700',
    chip: 'bg-rose-100 text-rose-800',
    emoji: '🚫',
    label: 'Diyetini bozar'
  }
}

// Kisi fizigi baglami (boy/yas/cinsiyet/kilo) — yapay zekaya porsiyon-kalori icin verilir
function bodyContext(s?: DietSettings, measurements?: Measurement[]): string | undefined {
  if (!s) return undefined
  const parts: string[] = []
  if (s.gender) parts.push(s.gender)
  if (s.age) parts.push(`${s.age} yaşında`)
  if (s.heightCm) parts.push(`boy ${s.heightCm} cm`)
  const w = (measurements ?? [])
    .filter((m) => typeof m.weight === 'number')
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((m) => m.weight as number)
    .pop()
  if (w) parts.push(`kilo ${w} kg`)
  return parts.length
    ? `Kişinin fiziği: ${parts.join(', ')}. Porsiyon ve kalori değerlendirmelerini buna göre yap.`
    : undefined
}

export default function Capture() {
  const navigate = useNavigate()
  const settings = useLiveQuery(() => readDietSettings(), [], undefined)
  const entries = useLiveQuery(() => dietDb.entries.toArray(), [], [])
  const exercises = useLiveQuery(() => listExercises(), [], [])
  const measurements = useLiveQuery(() => listMeasurements(), [], [])
  const stats = computeStats(entries ?? [], exercises ?? [])

  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [photo, setPhoto] = useState<string>('')
  const [analysis, setAnalysis] = useState<FoodAnalysis | null>(null)
  const [error, setError] = useState('')
  const [savedDecision, setSavedDecision] = useState<Decision>('none')
  const [mealType, setMealType] = useState<MealType>(guessMeal())
  const [alsoMeal, setAlsoMeal] = useState<MealType | undefined>(undefined)
  const [alsoMeal2, setAlsoMeal2] = useState<MealType | undefined>(undefined)
  const [note, setNote] = useState('') // kullanici duzeltmesi (result ekraninda)
  // Analiz oncesi koc ile NETLESTIRME sohbeti (foto uzerine konusma)
  const [clarifyChat, setClarifyChat] = useState<{ role: 'user' | 'assistant'; text: string }[]>([])
  const [clarifyInput, setClarifyInput] = useState('')
  const [clarifyBusy, setClarifyBusy] = useState(false)
  const [editing, setEditing] = useState(false) // duzeltme kutusu acik mi
  const [textMode, setTextMode] = useState(false) // fotografsiz, yazarak ekleme
  const [textNote, setTextNote] = useState('') // yazarak ekleme metni
  const [chat, setChat] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]) // ogun sohbeti
  const [chatInput, setChatInput] = useState('')
  const [chatBusy, setChatBusy] = useState(false)
  const [customWhen, setCustomWhen] = useState(false) // gecmis tarih/saate kaydet
  const [whenStr, setWhenStr] = useState('') // datetime-local degeri (gecmis ogun)

  const hasKey = !!settings?.apiKey

  // Takip edilecek öğünler = kullanıcının "Öğünlerim"de işaretlediği öğünler
  // (bildirim anahtarı DEĞİL). Puanlama/atlanan öğün cezası bunu kullanır.
  const trackedMeals = activeMealTypes(settings)
  useEffect(() => {
    setActiveMeals(trackedMeals)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackedMeals.join(',')])

  // SAMSUNG HEALTH OTOMATİK TAZELEME: uygulama açıldığında ve arka plandan
  // öne geldiğinde bugünün adım/kalori/antrenman verisini sessizce günceller.
  // İzin verilmemişse hiçbir şey yapmaz (izin penceresi açmaz).
  useEffect(() => {
    autoSyncHealthToday()
    const onVisible = () => {
      if (document.visibilityState === 'visible') autoSyncHealthToday()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  // Diyet listesi yüklendiğinde/değiştiğinde: yapay zeka BİR KEZ öğünlere bölsün
  // (kahvaltı/öğle/akşam/ara öğünler). Sonuç ayara kaydedilir; "Sıradaki öğün"de
  // o öğünde ne yeneceği gösterilir. Aynı liste için tekrar bölmez (token tasarrufu).
  const splitBusy = useRef(false)
  useEffect(() => {
    const plan = settings?.dietPlan?.trim()
    if (!plan || !settings?.apiKey || splitBusy.current) return
    if (settings.dietPlanMealsSrc === plan) return // bu liste zaten bölünmüş
    splitBusy.current = true
    void splitDietPlanMeals({ apiKey: settings.apiKey, dietPlan: plan, model: settings.model })
      .then((meals) => saveDietSettings({ dietPlanMeals: meals as Partial<Record<MealType, string>>, dietPlanMealsSrc: plan }))
      .catch(() => {})
      .finally(() => {
        splitBusy.current = false
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.dietPlan, settings?.apiKey, settings?.dietPlanMealsSrc])

  // "Sıradaki öğün" kartına dokununca: o öğünü önceden seç, ekleme menüsüne kaydır
  const [pendingMeal, setPendingMeal] = useState<MealType | null>(null)
  const addMenuRef = useRef<HTMLDivElement>(null)
  function addForMeal(meal: MealType) {
    setPendingMeal(meal)
    setMealType(meal)
    setAlsoMeal(undefined)
    setAlsoMeal2(undefined)
    setTextMode(false)
    setPhase('idle')
    setTimeout(() => addMenuRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60)
  }

  // Fotograf sec: APK'da native Camera (galeri HEIC/buyuk fotograflari da JPEG'e
  // cevirir), web'de gizli <input type=file> kullanilir.
  async function pickPhoto(source: 'camera' | 'gallery') {
    if (!hasKey) return
    if (Capacitor.isNativePlatform()) {
      try {
        const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera')
        const photo = await Camera.getPhoto({
          quality: 80,
          width: 1024,
          correctOrientation: true,
          allowEditing: true, // cektikten sonra kirp/duzenle (kesme-bicme)
          saveToGallery: source === 'camera', // cekilen fotografi telefon galerisine kaydet
          resultType: CameraResultType.DataUrl,
          source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos
        })
        if (!photo.dataUrl) return
        setNote('')
        setEditing(false)
        setMealType(pendingMeal ?? guessMeal())
        setPendingMeal(null)
        await afterCapture(photo.dataUrl)
      } catch (err) {
        // Kullanici secimi iptal ettiyse hata gosterme
        const msg = err instanceof Error ? err.message.toLowerCase() : ''
        if (msg.includes('cancel') || msg.includes('denied') || msg.includes('no image')) return
        setError('Fotoğraf alınamadı. Lütfen tekrar deneyin.')
        setPhase('idle')
      }
      return
    }
    // Web: gizli input'u ac
    ;(source === 'camera' ? cameraRef : galleryRef).current?.click()
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setNote('')
    setEditing(false)
    setMealType(pendingMeal ?? guessMeal()) // sıradaki öğün kartından seçildiyse onu koru
    setPendingMeal(null)
    try {
      const dataUrl = await fileToResizedDataUrl(file, 1000, 0.85)
      await afterCapture(dataUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fotoğraf okunamadı.')
      setPhase('idle')
    }
  }

  // AKILLI ÇEKİM: önce karede BARKOD var mı bak (token harcamaz). Varsa
  // paketli ürün demektir -> Barkod ekranına yönlendir (orada ürün/etiket işi
  // yapılır). Barkod yoksa YEMEK -> önce "bilgi ekle" ekranı (preAnalyze).
  async function afterCapture(dataUrl: string) {
    setPhase('analyzing')
    try {
      const code = await decodeBarcodeFromImage(dataUrl)
      if (code && /^\d{6,14}$/.test(code.trim())) {
        setPhase('idle')
        navigate(`/barkod?code=${code.trim()}`)
        return
      }
    } catch {
      // barkod yok / okunamadi -> yemek olarak devam
    }
    // TOKEN TASARRUFU: fotoğrafı çekince OTOMATİK yapay zekaya GÖNDERME.
    // Kullanıcı ne yediğini yazsın (ucuz + doğru); isterse fotoğraftan da
    // okutabilir. Böylece her çekimde boşuna görüntü token'ı harcanmaz.
    setPhoto(dataUrl)
    setClarifyChat([])
    setClarifyInput('')
    setPhase('converse')
  }

  // Hangi öğün(ler)? Birleşikse "Kahvaltı + Öğle" → uyum ona göre hesaplanır
  const mealInfoStr = () =>
    [mealType, alsoMeal, alsoMeal2].filter(Boolean).map((m) => mealLabel(m as MealType)).join(' + ') || undefined

  // YAZIDAN hesapla: fotoğrafı GÖNDERMEDEN, kullanıcının yazdığı açıklamadan
  // değerlendir. Fotoğraf kayıtta durmaya devam eder (diyetisyene gider).
  async function analyzeFromText() {
    const desc = clarifyInput.trim()
    if (!desc) {
      setError('Önce ne yediğini kısaca yaz (örn. süzme peynir 3 kaşık, 1 dilim ekmek).')
      return
    }
    setError('')
    setAnalysis(null)
    setPhase('analyzing')
    try {
      const result = await analyzeFoodByText({
        apiKey: settings!.apiKey!,
        note: desc,
        model: settings?.model,
        userName: settings?.userName,
        goal: settings?.goal,
        dietPlan: settings?.dietPlan,
        mealInfo: mealInfoStr(),
        dietitianNotes: settings?.dietitianNotes,
        body: bodyContext(settings, measurements),
        health: await buildHealthContext(settings)
      })
      setAnalysis(result)
      setPhase('result')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu.')
      setPhase('converse')
    }
  }

  // Koç fotoğrafa bakıp ilk gözlemini + sorularını üretir (netleştirme başlar)
  async function startClarify(dataUrl: string) {
    setError('')
    setClarifyBusy(true)
    try {
      const reply = await mealClarifyChat({
        apiKey: settings!.apiKey!,
        photoDataUrl: dataUrl,
        history: [],
        model: settings?.model,
        userName: settings?.userName,
        goal: settings?.goal,
        dietPlan: settings?.dietPlan,
        dietitianNotes: settings?.dietitianNotes,
        health: await buildHealthContext(settings)
      })
      setClarifyChat([{ role: 'assistant', text: reply }])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu.')
    } finally {
      setClarifyBusy(false)
    }
  }

  // Kullanıcı cevap yazar; koç netleştirmeye devam eder (foto tekrar gitmez)
  async function sendClarify() {
    const q = clarifyInput.trim()
    if (!q || clarifyBusy) return
    const hist = [...clarifyChat, { role: 'user' as const, text: q }]
    setClarifyChat(hist)
    setClarifyInput('')
    setClarifyBusy(true)
    try {
      const reply = await mealClarifyChat({
        apiKey: settings!.apiKey!,
        photoDataUrl: photo,
        history: hist,
        model: settings?.model,
        userName: settings?.userName,
        goal: settings?.goal,
        dietPlan: settings?.dietPlan,
        dietitianNotes: settings?.dietitianNotes,
        health: await buildHealthContext(settings)
      })
      setClarifyChat([...hist, { role: 'assistant', text: reply }])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu.')
    } finally {
      setClarifyBusy(false)
    }
  }

  // HIZLI KAYDET: soru sormadan, fotoğrafı hemen taslak olarak kaydet ve yola devam et.
  // Yemeği bitirince Geçmiş'ten "yapay zekayla düzelt" ile incelenip değerler doldurulur.
  async function quickSave() {
    if (!photo) return
    let createdAt = Date.now()
    if (customWhen && whenStr) {
      const d = new Date(whenStr)
      if (!isNaN(d.getTime())) createdAt = d.getTime()
    }
    await addDraftEntry(photo, mealType, createdAt, clarifyInput.trim() || undefined)
    setSavedDecision('ate')
    setPhase('saved')
    // Bu öğün artık kayıtlı — hatırlatıcıyı güncelle (yediysen bir daha sormasın)
    void readDietSettings().then(applyNotifications)
  }

  // Onayla ve hesapla: konuşmayı + fotoğrafı birlikte gönderip kesin analizi al
  async function finalizeConversation() {
    const transcript = clarifyChat.map((m) => `${m.role === 'assistant' ? 'Koç' : 'Ben'}: ${m.text}`).join('\n')
    const note = transcript
      ? `Fotoğraf üzerine koçla yaptığım netleştirme konuşması (analizini fotoğrafa VE bu konuşmada netleşen bilgilere göre yap):\n${transcript}`
      : ''
    await analyze(photo, note)
  }

  // Fotografi (varsa duzeltme notuyla) incele
  async function analyze(dataUrl: string, noteArg: string) {
    setError('')
    setAnalysis(null)
    setPhase('analyzing')
    try {
      const result = await analyzeFood({
        apiKey: settings!.apiKey!,
        photoDataUrl: dataUrl,
        model: settings?.model,
        userName: settings?.userName,
        goal: settings?.goal,
        dietPlan: settings?.dietPlan,
        mealInfo: mealInfoStr(),
        dietitianNotes: settings?.dietitianNotes,
        note: noteArg || undefined,
        body: bodyContext(settings, measurements),
        health: await buildHealthContext(settings)
      })
      setAnalysis(result)
      setPhase('result')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu.')
      setPhase('idle')
    }
  }

  // Fotografsiz: kullanici yemegi yazar, sadece metinden degerlendirilir
  async function analyzeText() {
    if (!textNote.trim()) return
    setPhoto('') // fotograf yok
    setTextMode(false)
    setMealType(pendingMeal ?? guessMeal())
    setPendingMeal(null)
    setError('')
    setAnalysis(null)
    setPhase('analyzing')
    try {
      const result = await analyzeFoodByText({
        apiKey: settings!.apiKey!,
        note: textNote,
        model: settings?.model,
        userName: settings?.userName,
        goal: settings?.goal,
        dietPlan: settings?.dietPlan,
        mealInfo: mealInfoStr(),
        dietitianNotes: settings?.dietitianNotes,
        body: bodyContext(settings, measurements),
        health: await buildHealthContext(settings)
      })
      setAnalysis(result)
      setPhase('result')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu.')
      setPhase('idle')
    }
  }

  // Kullanici "yanlis tanidi" deyip aciklama yazinca yeniden incele.
  // FOTOGRAF VARSA foto + notu BIRLIKTE gonderiyoruz: boylece kullanici notta
  // bir seyi yazmayi unutsa bile, fotografta gorunen diger ogeler dusmez.
  // Fotograf yoksa (yazarak eklenen ogun) sadece metinden incelenir.
  async function reanalyze() {
    if (!note.trim()) return
    setEditing(false)
    if (photo) {
      await analyze(photo, note)
      return
    }
    setError('')
    setAnalysis(null)
    setPhase('analyzing')
    try {
      const result = await analyzeFoodByText({
        apiKey: settings!.apiKey!,
        note,
        model: settings?.model,
        userName: settings?.userName,
        goal: settings?.goal,
        dietPlan: settings?.dietPlan,
        mealInfo: mealInfoStr(),
        dietitianNotes: settings?.dietitianNotes,
        body: bodyContext(settings, measurements),
        health: await buildHealthContext(settings)
      })
      setAnalysis(result)
      setPhase('result')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu.')
      setPhase('result')
    }
  }

  async function decide(decision: Decision) {
    if (!analysis) return
    // Gecmis tarih/saat secildiyse onu kullan; yoksa su an
    let createdAt = Date.now()
    let dateStr = todayStr()
    if (customWhen && whenStr) {
      const d = new Date(whenStr)
      if (!isNaN(d.getTime())) {
        createdAt = d.getTime()
        dateStr = todayStr(d)
      }
    }
    await dietDb.entries.add({
      ...analysis,
      photo,
      decision,
      mealType,
      alsoMeal: alsoMeal && alsoMeal !== mealType ? alsoMeal : undefined,
      alsoMeal2: alsoMeal2 && alsoMeal2 !== mealType && alsoMeal2 !== alsoMeal ? alsoMeal2 : undefined,
      createdAt,
      dateStr
    })
    setSavedDecision(decision)
    setPhase('saved')
    // Bu öğün artık kayıtlı — hatırlatıcıyı güncelle (yediysen bir daha sormasın)
    if (decision === 'ate') void readDietSettings().then(applyNotifications)
    // Ana ogunlerden (kahvalti/ogle/aksam) ~2 saat sonra tok seker olcum
    // hatirlatmasi. Ara ogun/icecekte tetiklenmez. (Tokluk/"doydun mu"
    // hatirlatmasi kaldirildi — kullanici acligini istedigi zaman isaretliyor.)
    if (decision === 'ate' && Date.now() - createdAt < 60_000) {
      const mainMeal = mealType === 'kahvalti' || mealType === 'ogle' || mealType === 'aksam'
      if (settings?.sugarPostMealReminderEnabled && mainMeal && !isBeverage(analysis.foodName)) {
        void scheduleSugarReminder(120)
      }
    }
  }

  function reset() {
    setPhase('idle')
    setPhoto('')
    setAnalysis(null)
    setMealType(guessMeal())
    setPendingMeal(null)
    setAlsoMeal(undefined)
    setAlsoMeal2(undefined)
    setSavedDecision('none')
    setError('')
    setNote('')
    setClarifyChat([])
    setClarifyInput('')
    setClarifyBusy(false)
    setEditing(false)
    setTextMode(false)
    setTextNote('')
    setChat([])
    setChatInput('')
    setCustomWhen(false)
    setWhenStr('')
  }

  // Yemek hakkinda soru sor (sadece metin -> az token)
  async function sendChat() {
    const q = chatInput.trim()
    if (!q || !analysis) return
    const history = [...chat, { role: 'user' as const, text: q }]
    setChat(history)
    setChatInput('')
    setChatBusy(true)
    try {
      const res = await chatAboutFood({
        apiKey: settings!.apiKey!,
        foodName: analysis.foodName,
        dietScore: analysis.dietScore,
        estimatedCalories: analysis.estimatedCalories,
        protein: analysis.protein ?? 0,
        carb: analysis.carb ?? 0,
        fat: analysis.fat ?? 0,
        context: `risk ${analysis.riskLevel}.`,
        history,
        model: settings?.model,
        userName: settings?.userName,
        goal: settings?.goal,
        dietPlan: settings?.dietPlan,
        dietitianNotes: settings?.dietitianNotes,
        health: await buildHealthContext(settings)
      })
      // Kullanici sohbette yemegi/miktari duzelttiyse puani/kaloriyi/makroyu guncelle
      if (res.correction.changed) {
        const c = res.correction
        setAnalysis((prev) =>
          prev
            ? {
                ...prev,
                foodName: c.foodName || prev.foodName,
                dietScore: c.dietScore,
                scoreReason: c.scoreReason,
                estimatedCalories: c.estimatedCalories,
                protein: c.protein,
                carb: c.carb,
                fat: c.fat
              }
            : prev
        )
      }
      setChat([...history, { role: 'assistant', text: res.reply }])
    } catch (err) {
      setChat([...history, { role: 'assistant', text: err instanceof Error ? err.message : 'Cevap alınamadı.' }])
    } finally {
      setChatBusy(false)
    }
  }

  return (
    <div>
      <DietHeader title="Diyet Koçu" subtitle="Yemeden önce çek, kararını ver" />

      {/* Yan bosluk MFP'yle ayni: kart kenari ekrandan ~%5 iceride (12px degil
          16px). Kartlar arasi bosluk da bir tik daralttildi — sayfa daha
          derli toplu, daha az "kaba" duruyor. */}
      <div className="px-4 pt-1 pb-3 space-y-3">
        {/* Seri kartim — TEK buyuk rakam. Once 38px seri + 22px puan yan yana
            duruyordu; iki buyuk rakam ayni kartta yarisinca kaba goruunuyordu. */}
        <div className="card p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="stat-label">Diyet serin</p>
              <p className="mt-1 flex items-baseline gap-1.5">
                <span className="stat-num text-[28px] leading-none">{stats.streak}</span>
                <span className="text-[14px] font-medium text-slate-500">gün</span>
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="stat-label">Puan</p>
              <p className="text-[16px] font-semibold text-slate-700 dark:text-[#e0e1e6] tabular-nums leading-none mt-1.5">
                {stats.points.toLocaleString('tr-TR')}
              </p>
            </div>
          </div>
          <p className="text-[13px] text-slate-500 mt-3 leading-relaxed">
            {stats.streak === 0
              ? 'Bugün temiz bir başlangıç yap.'
              : `${stats.streak} gündür diyetini bozmadın — devam.`}
          </p>
        </div>

        {/* Kilo hedefi & gidisat (motivasyon) */}
        <WeightGoal measurements={measurements ?? []} target={settings?.targetWeight} start={settings?.startWeight} height={settings?.heightCm} />

        {/* Bugunku diyet basari yuzdesi */}
        <DailyScore entries={entries ?? []} />

        {/* Girilmeyen (atlanan) takip edilen ogun icin tek satir kirmizi uyari */}
        <MissedMealsAlert entries={entries ?? []} tracked={trackedMeals} />

        {/* Sıradaki öğün: saati/ne kadar kaldığı; dokununca o öğünü eklemeye başlar */}
        <NextMeal entries={entries ?? []} settings={settings} onPick={addForMeal} />

        {/* Kriz ani: canim cekiyor! */}
        <CrisisSOS entries={entries ?? []} exercises={exercises ?? []} settings={settings} />

        {/* Gunluk motivasyon sozu */}
        <div className="card p-4">
          <p className="text-[14px] leading-relaxed text-slate-600 text-center italic">
            “{quoteOfDay(todayStr())}”
          </p>
        </div>

        {/* Kaydırmalı kontrol paneli: Kaloriler / Makrolar / Kalp için Sağlıklı /
            Düşük Karbonhidrat (MyFitnessPal'daki gibi 4 sayfa) */}
        <Dashboard entries={entries ?? []} exercises={exercises ?? []} goal={settings?.calorieGoal} />

        {/* Adım (otomatik, bütçeye karışmaz) + Egzersiz (bütçeye eklenir) */}
        <StepExerciseRow exercises={exercises ?? []} stepGoal={settings?.stepGoal} />

        {/* Su takibi (ml) */}
        <WaterCard goalMl={settings?.waterGoal ? settings.waterGoal * 200 : 2500} />

        {/* Bugun nasilsin? (moral/his + aclik) */}
        <MoodCheckIn />

        {/* İlaç takibi artık ana sayfada değil: doz vakti gelince ekranı kaplayan
            zorunlu hatırlatma penceresi çıkar (DueMedGate) + /ilaclarim sayfası. */}

        {/* TEK yapay zeka sohbeti: menu, yarin plani, Z raporu, gun analizi */}
        <CoachChat entries={entries ?? []} exercises={exercises ?? []} settings={settings} />

        {/* Aksam kontrolu: bugun karar verilmemis ogunler */}
        <PendingCheckIn entries={entries ?? []} />

        {!hasKey && (
          <div className="card p-4 bg-amber-50 border-amber-200 text-amber-800 text-sm">
            <p className="font-semibold mb-1">⚙️ Kurulum gerekli</p>
            <p>
              Fotoğraf incelemesi için bir Anthropic API anahtarı gerekiyor.{' '}
              <Link to="/ayarlar" className="underline font-semibold">
                Ayarlar
              </Link>{' '}
              bölümünden ekleyin.
            </p>
          </div>
        )}

        {error && <div className="card p-3 bg-rose-50 border-rose-200 text-rose-700 text-sm">{error}</div>}

        {/* Bos durum: TEK yapay zeka ekleme merkezi (foto/galeri/barkod/etiket/yazi) */}
        {phase === 'idle' && (
          <div ref={addMenuRef} className="card p-5 space-y-3">
            {pendingMeal && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2 text-center text-sm font-bold text-indigo-800">
                {mealLabel(pendingMeal)} ekleniyor
              </div>
            )}
            <div className="text-center space-y-1">
              <div className="text-5xl">📸</div>
              <p className="text-slate-600 text-sm">Ne eklemek istersin? Yapay zeka tanısın, karar vermene yardım etsin.</p>
            </div>

            {/* Ana yol: yemek fotografi */}
            <button onClick={() => pickPhoto('camera')} disabled={!hasKey} className="btn-primary w-full py-3 text-base">
              📷 Yemek Fotoğrafı Çek
            </button>

            {/* Diger yollar: galeri, yazi, barkod, paket etiketi */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => pickPhoto('gallery')}
                disabled={!hasKey}
                className="flex flex-col items-center justify-center gap-1 rounded-xl border border-slate-200 bg-slate-50 py-3 text-xs font-semibold text-slate-700 disabled:opacity-50"
              >
                <span className="text-2xl">🖼️</span>Galeriden Seç
              </button>
              <button
                onClick={() => setTextMode((v) => !v)}
                disabled={!hasKey}
                className="flex flex-col items-center justify-center gap-1 rounded-xl border border-slate-200 bg-slate-50 py-3 text-xs font-semibold text-slate-700 disabled:opacity-50"
              >
                <span className="text-2xl">✍️</span>Yazarak Ekle
              </button>
              <Link
                to="/barkod"
                className="flex flex-col items-center justify-center gap-1 rounded-xl border border-slate-200 bg-slate-50 py-3 text-xs font-semibold text-slate-700"
              >
                <span className="text-2xl">🏷️</span>Barkod Okut
              </Link>
              <Link
                to="/barkod?mode=etiket"
                className="flex flex-col items-center justify-center gap-1 rounded-xl border border-slate-200 bg-slate-50 py-3 text-xs font-semibold text-slate-700"
              >
                <span className="text-2xl">📷</span>Paket Etiketi
              </Link>
            </div>

            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPick} />
            <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={onPick} />

            {/* Fotografsiz: yazarak ekle (acilinca metin kutusu) */}
            {textMode && (
              <div className="space-y-2 text-left">
                <textarea
                  className="field-input min-h-[64px]"
                  autoFocus
                  placeholder="Ne yedin/yiyeceksin? örn. 5 çorba kaşığı pilav + 1 köfte kadar tavuk + 1 su bardağı ayran"
                  value={textNote}
                  onChange={(e) => setTextNote(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setTextMode(false)
                      setTextNote('')
                    }}
                    className="btn bg-slate-200 text-slate-700 hover:bg-slate-300 py-2.5"
                  >
                    Vazgeç
                  </button>
                  <button onClick={analyzeText} disabled={!textNote.trim()} className="btn-primary py-2.5">
                    İncele
                  </button>
                </div>
              </div>
            )}
            <p className="text-[11px] text-slate-400">
              Barkod paketli üründe token harcamaz; yazarak eklede fotoğraf gerekmez.
            </p>
          </div>
        )}

        {/* Analizden ÖNCE: KOÇ fotoğrafa bakar, ne gördüğünü söyler ve emin
            olamadıklarını SORAR. Konuşup netleştirince "Onayla ve hesapla" ile
            kesin kalori/makro çıkar. İstenirse konuşmadan direkt de hesaplanır. */}
        {phase === 'converse' && (
          <div className="card p-4 space-y-3">
            {photo && <img src={photo} alt="Yemek" className="w-full rounded-xl max-h-60 object-cover" />}

            {/* EN UCUZ + EN DOĞRU: ne yediğini yaz, metinden hesapla */}
            <label className="text-xs font-semibold text-slate-600">Ne yedin? (yazınca hem ucuz hem doğru olur)</label>
            <textarea
              className="field-input min-h-[110px] text-base leading-relaxed"
              placeholder="örn. süzme peynir 3 kaşık, 1 dilim esmer ekmek, 5 zeytin, 1 bardak çay şekersiz…"
              value={clarifyInput}
              onChange={(e) => setClarifyInput(e.target.value)}
            />
            <button onClick={analyzeFromText} className="btn-primary w-full py-2.5 font-bold">
              📝 Yazıdan hesapla · az token
            </button>

            {/* Alternatifler: fotoğraftan oku (çok token) ya da koç sorsun */}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => analyze(photo, clarifyInput.trim())} className="btn bg-slate-200 text-slate-700 hover:bg-slate-300 py-2 text-sm">
                📷 Fotoğraftan hesapla
              </button>
              <button onClick={() => void startClarify(photo)} disabled={clarifyBusy} className="btn bg-slate-100 text-slate-600 py-2 text-sm disabled:opacity-50">
                🧑‍🍳 Koç baksın
              </button>
            </div>

            {/* Koç sohbeti (yalnızca "Koç baksın"a basınca) */}
            {(clarifyChat.length > 0 || clarifyBusy) && (
              <div className="space-y-2">
                {clarifyChat.map((m, i) => (
                  <div
                    key={i}
                    className={`text-sm rounded-2xl px-3 py-2 whitespace-pre-wrap leading-relaxed ${
                      m.role === 'assistant' ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-500/10' : 'bg-slate-100 text-slate-700 ml-6'
                    }`}
                  >
                    {m.role === 'assistant' ? '🧑‍🍳 ' : ''}
                    {m.text}
                  </div>
                ))}
                {clarifyBusy && (
                  <div className="flex items-center gap-2 text-emerald-700 text-sm py-1">
                    <span className="animate-spin h-4 w-4 border-2 border-emerald-600 border-t-transparent rounded-full" />
                    <span>Koç bakıyor…</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <button onClick={sendClarify} disabled={!clarifyInput.trim() || clarifyBusy} className="btn bg-white border border-slate-200 text-slate-700 px-3 py-2 text-sm disabled:opacity-50">
                    Cevabı gönder
                  </button>
                  <button onClick={finalizeConversation} disabled={clarifyBusy} className="btn-primary flex-1 py-2 text-sm disabled:opacity-50">
                    ✓ Onayla ve hesapla (fotoğraflı)
                  </button>
                </div>
              </div>
            )}

            {error && <p className="text-xs text-rose-600">{error}</p>}
            <div className="border-t border-slate-100" />

            {/* HIZLI KAYDET + Vazgeç */}
            <button onClick={quickSave} className="btn bg-amber-100 text-amber-800 border border-amber-200 w-full py-2.5 font-bold">
              ⚡ Şimdi kaydet, sonra düzelt
            </button>
            <button onClick={reset} className="btn bg-slate-100 text-slate-600 w-full py-2">
              Vazgeç
            </button>
            <p className="text-[11px] text-slate-400">
              💡 En ucuz yol: ne yediğini yaz → “Yazıdan hesapla”. Fotoğraf kayıtta durur, diyetisyene gider; sadece yapay
              zekaya gönderilmez. Fotoğraftan okutmak birkaç kat fazla token harcar.
            </p>
          </div>
        )}

        {/* Inceleniyor */}
        {phase === 'analyzing' && (
          <div className="card p-4 space-y-3 text-center">
            {photo && <img src={photo} alt="Yemek" className="w-full rounded-xl max-h-72 object-cover" />}
            <div className="flex items-center justify-center gap-2 text-emerald-700 py-2">
              <span className="animate-spin h-5 w-5 border-2 border-emerald-600 border-t-transparent rounded-full" />
              <span className="font-semibold">Yemeğin inceleniyor…</span>
            </div>
          </div>
        )}

        {/* Sonuc */}
        {phase === 'result' && analysis && (
          <div className="space-y-3">
            {photo && <img src={photo} alt="Yemek" className="w-full rounded-2xl max-h-72 object-cover shadow" />}

            <ResultCard analysis={analysis} />

            {/* Yanlis tanidiysa kullanici duzeltir, ayni foto tekrar incelenir */}
            {!editing ? (
              <button
                onClick={() => {
                  setNote('')
                  setEditing(true)
                }}
                className="w-full text-center text-sm text-slate-500 underline py-1"
              >
                ✏️ Yanlış mı tanıdı / miktarı belirteyim
              </button>
            ) : (
              <div className="card p-3 space-y-2 border-emerald-200">
                <p className="section-title">Bu yemek ne? Ne kadar?</p>
                <textarea
                  className="field-input min-h-[64px]"
                  autoFocus
                  placeholder="örn. 5 çorba kaşığı pilav + 1 köfte kadar tavuk + 1 su bardağı ayran"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setEditing(false)}
                    className="btn bg-slate-200 text-slate-700 hover:bg-slate-300 py-2.5"
                  >
                    Vazgeç
                  </button>
                  <button onClick={reanalyze} disabled={!note.trim()} className="btn-primary py-2.5">
                    🔁 Tekrar incele
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  Yazdığını düzeltir/ekler; fotoğrafta görünen diğerlerini de sayar (unuttuğun düşmez).
                </p>
              </div>
            )}

            {/* Hangi ogun? — saate gore varsayilan secili gelir */}
            <div className="card p-3 space-y-2">
              <p className="section-title">Hangi öğün?</p>
              <div className="flex flex-wrap gap-1.5">
                {MEAL_OPTIONS.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => {
                      setMealType(m.value)
                      if (alsoMeal === m.value) setAlsoMeal(undefined)
                      if (alsoMeal2 === m.value) setAlsoMeal2(undefined)
                    }}
                    className={`text-sm font-semibold rounded-full px-3 py-1.5 ${
                      mealType === m.value ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {m.emoji} {m.label}
                  </button>
                ))}
              </div>

              {/* BIRLESIK OGUN: gec kalkinca 2-3 ogunu birlestir (or. kahvalti+ogle+ikindi) */}
              {!alsoMeal ? (
                <button onClick={() => setAlsoMeal(mealType === 'kahvalti' ? 'ogle' : 'kahvalti')} className="text-xs text-emerald-700 underline">
                  ＋ Bu öğünü başka bir öğünle birleştir (geç kalktım vb.)
                </button>
              ) : (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold text-emerald-700">Birleşik öğün — ikinci öğün:</p>
                    <button
                      onClick={() => {
                        setAlsoMeal(undefined)
                        setAlsoMeal2(undefined)
                      }}
                      className="text-[11px] text-slate-400 underline"
                    >
                      birleştirmeyi kaldır
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {MEAL_OPTIONS.filter((m) => m.value !== mealType && m.value !== alsoMeal2).map((m) => (
                      <button
                        key={m.value}
                        onClick={() => setAlsoMeal(m.value)}
                        className={`text-xs font-semibold rounded-full px-2.5 py-1 ${
                          alsoMeal === m.value ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {m.emoji} {m.label}
                      </button>
                    ))}
                  </div>

                  {/* ÜÇÜNCÜ öğün (opsiyonel) */}
                  {!alsoMeal2 ? (
                    <button
                      onClick={() => {
                        const free = MEAL_OPTIONS.find((m) => m.value !== mealType && m.value !== alsoMeal)
                        if (free) setAlsoMeal2(free.value)
                      }}
                      className="text-[11px] text-emerald-700 underline"
                    >
                      ＋ Üçüncü öğünü de ekle
                    </button>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-bold text-emerald-700">Üçüncü öğün:</p>
                        <button onClick={() => setAlsoMeal2(undefined)} className="text-[11px] text-slate-400 underline">
                          üçüncüyü kaldır
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {MEAL_OPTIONS.filter((m) => m.value !== mealType && m.value !== alsoMeal).map((m) => (
                          <button
                            key={m.value}
                            onClick={() => setAlsoMeal2(m.value)}
                            className={`text-xs font-semibold rounded-full px-2.5 py-1 ${
                              alsoMeal2 === m.value ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {m.emoji} {m.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  <p className="text-[10px] text-slate-400">
                    Bu kayıt “{mealLabel(mealType)} + {mealLabel(alsoMeal)}{alsoMeal2 ? ` + ${mealLabel(alsoMeal2)}` : ''}” olarak sayılır; koç bu öğünleri tek öğün gibi değerlendirir, “öğün atladın” demez.
                  </p>
                </div>
              )}
            </div>

            {/* Ne zaman yedim? — varsayilan "şimdi"; gecmis ogunu de girebilirsin */}
            <div className="card p-3 space-y-2">
              <p className="section-title">Ne zaman?</p>
              {!customWhen ? (
                <button
                  onClick={() => {
                    setWhenStr(toLocalInput(new Date()))
                    setCustomWhen(true)
                  }}
                  className="text-sm text-emerald-700 underline"
                >
                  Şimdi · geçmiş bir öğünü mü giriyorsun? ✏️
                </button>
              ) : (
                <div className="space-y-1.5">
                  <input
                    type="datetime-local"
                    className="field-input"
                    value={whenStr}
                    max={toLocalInput(new Date())}
                    onChange={(e) => setWhenStr(e.target.value)}
                  />
                  <button
                    onClick={() => {
                      setCustomWhen(false)
                      setWhenStr('')
                    }}
                    className="text-[11px] text-slate-400"
                  >
                    şimdiye al
                  </button>
                  <p className="text-[11px] text-slate-400">
                    Geçmiş öğünü doğru tarih/saate kaydedebilirsin.
                  </p>
                </div>
              )}
            </div>

            {/* Bu ogun hakkinda sohbet/soru (sadece metin -> az token) */}
            <div className="card p-3 space-y-2">
              <p className="section-title">Öğün hakkında</p>
              {chat.length > 0 && (
                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {chat.map((m, i) => (
                    <div
                      key={i}
                      className={`text-sm rounded-xl px-3 py-2 ${
                        m.role === 'user'
                          ? 'bg-emerald-600 text-white ml-8'
                          : 'bg-slate-100 text-slate-800 mr-8'
                      }`}
                    >
                      {m.text}
                    </div>
                  ))}
                  {chatBusy && <p className="text-xs text-slate-400 mr-8">yazıyor…</p>}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  className="field-input flex-1"
                  placeholder="örn. Yarısını yesem? Yanında ne yiyebilirim?"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendChat()}
                />
                <button onClick={sendChat} disabled={chatBusy || !chatInput.trim()} className="btn-primary px-4">
                  Sor
                </button>
              </div>
            </div>

            {/* Karar butonlari */}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => decide('resisted')} className="btn-primary py-3">
                💪 Vazgeçtim
              </button>
              <button
                onClick={() => decide('ate')}
                className="btn py-3 bg-slate-200 text-slate-700 hover:bg-slate-300"
              >
                😋 Yedim
              </button>
            </div>
            <button onClick={() => decide('none')} className="btn-ghost w-full py-2.5">
              ⏳ Sonra karar ver (akşam sor)
            </button>
            <button onClick={reset} className="w-full text-center text-sm text-slate-400 py-1">
              Vazgeç, baştan
            </button>
          </div>
        )}

        {/* Kaydedildi */}
        {phase === 'saved' && (
          <div className="card p-6 text-center space-y-4">
            <div className="text-6xl">
              {savedDecision === 'resisted' ? '🎉' : savedDecision === 'ate' ? '🤝' : '⏳'}
            </div>
            <p className="text-lg font-bold text-slate-800">
              {savedDecision === 'resisted'
                ? 'Aferin sana! Vazgeçtin.'
                : savedDecision === 'ate'
                  ? 'Kaydedildi. Yarın yeni bir gün.'
                  : 'Kaydedildi, karar sende.'}
            </p>
            <p className="text-sm text-slate-600">
              {savedDecision === 'resisted'
                ? `+10 puan! Diyet serin: ${stats.streak} gün. İraden için tebrikler! 🌟`
                : savedDecision === 'ate'
                  ? 'Önemli olan pes etmemek. Bir sonrakinde sen kazanacaksın. 💪'
                  : 'Akşam uygulamayı açınca "yedin mi?" diye soracağım. 🌙'}
            </p>
            <button onClick={reset} className="btn-primary w-full">
              Yeni Fotoğraf
            </button>
            <Link to="/gecmis" className="block text-sm text-emerald-700 underline">
              Geçmişi gör
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

// Kilo hedefi & gidisat karti: baslangic -> su an -> hedef, ne kadar verildi,
// hedefe ne kaldi ve ilerleme cubugu. Hedef girilmemisse nazikce yonlendirir.
function WeightGoal({ measurements, target, start, height }: { measurements: Measurement[]; target?: number; start?: number; height?: number }) {
  // Kilo girilmis olculeri kronolojik al
  const weights = measurements
    .filter((m) => typeof m.weight === 'number')
    .sort((a, b) => a.createdAt - b.createdAt)
  const current = weights.length ? (weights[weights.length - 1].weight as number) : undefined
  const startW = start ?? (weights.length ? (weights[0].weight as number) : undefined)

  // Hedef yoksa: olcu varsa kucuk bir yonlendirme goster, yoksa hic gosterme
  if (!target) {
    if (current == null) return null
    return (
      <Link to="/ayarlar" className="card p-3 flex items-center gap-3 bg-brand-50 border-brand-100">
        <span className="text-2xl">🎯</span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-brand-800">Kilo hedefi koy</p>
          <p className="text-xs text-brand-700/80">Ayarlar’dan hedef kiloyu gir, ilerlemeni burada göster.</p>
        </div>
        <span className="text-brand-700">→</span>
      </Link>
    )
  }

  if (current == null) {
    // Hedef var ama hic tarti yok -> tartmaya yonlendir
    return (
      <Link to="/takip" className="card p-3 flex items-center gap-3 bg-brand-50 border-brand-100">
        <span className="text-2xl">⚖️</span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-brand-800">Hedef: {target} kg</p>
          <p className="text-xs text-brand-700/80">İlk tartını gir, gidişatını takip edelim.</p>
        </div>
        <span className="text-brand-700">→</span>
      </Link>
    )
  }

  const base = startW ?? current
  const lost = Math.round((base - current) * 10) / 10 // + ise verilen kilo
  const remaining = Math.round((current - target) * 10) / 10 // + ise verilecek kilo
  const reached = current <= target + 0.05
  // Ilerleme: baslangictan hedefe ne kadar yol alindi (0-100)
  const span = base - target
  const pct = span > 0 ? Math.max(0, Math.min(100, Math.round(((base - current) / span) * 100))) : reached ? 100 : 0

  // BMI (boy girildiyse)
  const bmi = height && height > 0 ? Math.round((current / Math.pow(height / 100, 2)) * 10) / 10 : null
  const bmiCat = bmi == null ? '' : bmi < 18.5 ? 'zayıf' : bmi < 25 ? 'normal' : bmi < 30 ? 'fazla kilolu' : 'obez'
  const bmiCls = bmi == null ? '' : bmi < 18.5 || bmi >= 30 ? 'bg-rose-100 text-rose-700' : bmi < 25 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'

  return (
    <div className="card p-4 space-y-3">
      {/* Baslik satiri: BMI rozeti alta alindi. Once basligin yanindaydi,
          uzun oldugu icin ("BMI 33.1 · obez") satiri kirip duzeni bozuyordu. */}
      <div className="flex items-center justify-between gap-2">
        <span className="section-title">Kilo hedefin</span>
        <span className="text-[12px] font-medium text-slate-500 flex-shrink-0">{base} → {target} kg</span>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          {/* TEK buyuk rakam: guncel kilo. "hedefe kaldi" artik parlak mavi
              24px degil, sakin bir yardimci satir. */}
          <p className="text-[26px] font-bold tracking-tight text-slate-900 dark:text-[#e0e1e6] tabular-nums leading-none">
            {current}
            <span className="text-[14px] font-semibold text-slate-400"> kg</span>
          </p>
          <p className="text-[12px] text-slate-500 mt-1.5">
            {lost > 0 ? `Başlangıçtan beri ${lost} kg verdin` : lost < 0 ? `Başlangıca göre ${Math.abs(lost)} kg arttı` : 'Henüz değişim yok'}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          {reached ? (
            <span className="chip bg-brand-100 text-brand-800">Hedefe ulaştın</span>
          ) : (
            <>
              <p className="text-[15px] font-semibold text-slate-700 dark:text-[#e0e1e6] tabular-nums leading-none">
                {remaining} kg
              </p>
              <p className="text-[12px] text-slate-500 mt-1">hedefe kaldı</p>
            </>
          )}
        </div>
      </div>

      <div>
        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-brand-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center justify-between mt-1.5">
          {bmi != null && <span className={`chip ${bmiCls}`}>BMI {bmi} · {bmiCat}</span>}
          <span className="text-[11px] text-slate-400 ml-auto">%{pct} tamamlandı</span>
        </div>
      </div>
    </div>
  )
}

// Bugunku diyet basari yuzdesi: o gunku kararlarin ortalamasi (renkli, mesajli)
function DailyScore({ entries }: { entries: DietEntry[] }) {
  const pct = dayAdherence(entries, todayStr())
  if (pct == null) return null // bugun karar verilmis kayit yoksa gosterme

  // Kartin TAMAMINI yesile/kirmiziya boyamak yerine rengi yalnizca RAKAM ve
  // CUBUKTA tutuyoruz; zemin diger kartlarla ayni kaliyor. Tonlu zemin +
  // buyuk renkli rakam + emojili cumle bir arada kaba goruunuyordu.
  const theme =
    pct >= 80
      ? { bar: 'bg-emerald-500', text: 'text-emerald-600', msg: 'Harika gidiyorsun.' }
      : pct >= 50
        ? { bar: 'bg-amber-500', text: 'text-amber-600', msg: 'Fena değil, biraz daha dikkat.' }
        : { bar: 'bg-rose-500', text: 'text-rose-500', msg: 'Bugün zor geçti, yarın telafi.' }

  return (
    <div className="card p-4">
      <div className="flex items-end justify-between gap-2">
        <span className="section-title">Bugünkü diyet başarın</span>
        <span className={`text-[22px] font-bold tabular-nums leading-none ${theme.text}`}>%{pct}</span>
      </div>
      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden mt-2.5">
        <div className={`h-full ${theme.bar} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[13px] text-slate-500 mt-2">{theme.msg}</p>
    </div>
  )
}

// Bugun YENEN ogunlerin kalori HALKASI + makro (protein/karb/yag) dagilimi.
// MyFitnessPal mantigi: Kalan = Hedef − Yenen + Spor. Yani yapilan spor günlük
// kalori bütçesine EKLENİR (yenen kaloriyi karşılar), ayrıca ayrı da gösterilir.
// =====================================================================
// KONTROL PANELİ — MyFitnessPal'in "Bugün" ekranindaki KAYDIRMALI kart
// dizisi. Dort sayfa yan yana durur, parmakla kaydirilir, altta nokta
// gostergesi vardir:
//   1) Kaloriler   2) Makrolar   3) Kalp için Sağlıklı   4) Düşük Karbonhidrat
// Yanlarda onceki/sonraki kartin ucu gorunur (MFP'deki gibi).
// =====================================================================

// GUNLUK HEDEFLER — kalori hedefinden turetilir; oranlar MyFitnessPal ile
// birebir ayni: karbonhidrat %50, yag %30, protein %20, seker %15 (kaloriden).
// Lif/sodyum/kolesterol saglik esikleridir, kaloriye gore degismez.
// Ornek: 2.380 kcal -> 298 g karb / 79 g yag / 119 g protein / 89 g seker.
function dailyTargets(target: number) {
  return {
    carb: target ? Math.round((target * 0.5) / 4) : 0,
    fat: target ? Math.round((target * 0.3) / 9) : 0,
    protein: target ? Math.round((target * 0.2) / 4) : 0,
    sugar: target ? Math.round((target * 0.15) / 4) : 0,
    fiber: 30,
    sodium: 2300,
    cholesterol: 300
  }
}

function Dashboard({ entries, exercises, goal }: { entries: DietEntry[]; exercises: Exercise[]; goal?: number }) {
  const today = todayStr()
  const todays = entries.filter((e) => e.dateStr === today && e.decision === 'ate')
  const sum = (pick: (e: DietEntry) => number | undefined) => todays.reduce((s, e) => s + (pick(e) || 0), 0)

  const kcal = sum((e) => e.estimatedCalories)
  const protein = sum((e) => e.protein)
  const carb = sum((e) => e.carb)
  const fat = sum((e) => e.fat)
  const sugar = sum((e) => e.sugar)
  const fiber = sum((e) => e.fiber)
  const sodium = sum((e) => e.sodium)
  const cholesterol = sum((e) => e.cholesterol)

  // EGZERSİZ: MyFitnessPal'da bütçeye YALNIZCA kaydedilmiş antrenman eklenir.
  // Adım ayrı bir karttır ve kalori bütçesine karışmaz (MFP'de 3.443 adımda
  // "Egzersiz 0" yazmasının sebebi budur). Biz de aynısını yapıyoruz.
  const exBurned = exercises.filter((e) => e.dateStr === today).reduce((s, e) => s + (e.kcal || 0), 0)

  const target = goal && goal > 0 ? goal : 0
  const g = dailyTargets(target)

  const pages = [
    <CaloriePage key="kcal" target={target} eaten={kcal} exercise={exBurned} />,
    <MacroPage key="makro" carb={carb} fat={fat} protein={protein} g={g} />,
    <NutrientPage
      key="kalp"
      title="Kalp için Sağlıklı"
      rows={[
        { label: 'Yağ', value: fat, goal: g.fat, unit: 'g' },
        { label: 'Sodyum', value: sodium, goal: g.sodium, unit: 'mg' },
        { label: 'Kolesterol', value: cholesterol, goal: g.cholesterol, unit: 'mg' }
      ]}
    />,
    <NutrientPage
      key="karb"
      title="Düşük Karbonhidrat"
      rows={[
        { label: 'Karbonhidrat', value: carb, goal: g.carb, unit: 'g' },
        { label: 'Şeker', value: sugar, goal: g.sugar, unit: 'g' },
        { label: 'Lif', value: fiber, goal: g.fiber, unit: 'g' }
      ]}
    />
  ]

  return <Carousel pages={pages} />
}

// Yatay kaydirmali kart dizisi + nokta gostergesi. Kartlar ekranin %89'u
// kadar genis; boylece komsu kartin ucu gorunur ve "kaydirilabilir" oldugu
// bakinca anlasilir (MFP'deki davranisin aynisi).
function Carousel({ pages }: { pages: ReactNode[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)

  function onScroll() {
    const el = ref.current
    if (!el) return
    const first = el.firstElementChild as HTMLElement | null
    if (!first) return
    const step = first.offsetWidth + 12 // kart genisligi + gap-3
    setActive(Math.max(0, Math.min(pages.length - 1, Math.round(el.scrollLeft / step))))
  }

  return (
    <div>
      {/* Kaydirma alani SAGDAN ekran kenarina tasar (-mr-4): MFP'de de kart
          soldan icerideyken sonraki kartin ucu sag kenardan kesilir. Sayfa
          dolgusu icinde kalsaydi komsu kart ortada asili gibi duruyordu. */}
      <div
        ref={ref}
        onScroll={onScroll}
        className="-mr-4 flex items-stretch gap-3 overflow-x-auto snap-x snap-mandatory no-scrollbar"
      >
        {pages.map((p, i) => (
          <div key={i} className="snap-start shrink-0 w-[89%] last:mr-4">
            {p}
          </div>
        ))}
      </div>
      <div className="flex justify-center gap-2 mt-3">
        {pages.map((_, i) => (
          <span
            key={i}
            className={`h-2 w-2 rounded-full transition-colors ${
              i === active ? 'bg-brand-600' : 'bg-slate-300 dark:bg-[#52555c]'
            }`}
          />
        ))}
      </div>
    </div>
  )
}

// Kart basligi — MFP'de her sayfanin ustunde buyuk kalin bir baslik var.
function PageTitle({ children, note }: { children: ReactNode; note?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-[23px] font-bold leading-tight text-slate-900 dark:text-[#e0e1e6]">{children}</h2>
      {note && <p className="text-[13px] text-slate-500 mt-1">{note}</p>}
    </div>
  )
}

// 1. SAYFA — Kaloriler: solda halka (ortada KALAN), sagda Temel Hedef /
// Yiyecek / Egzersiz.
function CaloriePage({ target, eaten, exercise }: { target: number; eaten: number; exercise: number }) {
  // MyFitnessPal: gunluk butce = hedef + egzersiz; kalan = butce − yiyecek
  const budget = target + exercise
  const remaining = budget - eaten
  const frac = budget ? Math.min(1, eaten / budget) : 0
  const over = budget > 0 && eaten > budget
  const ringColor = over ? '#f54b72' : frac >= 0.85 ? '#f59525' : '#4d9bff'

  const R = 52
  const C = 2 * Math.PI * R

  return (
    <div className="card p-5 h-full">
      <PageTitle note="Kalan = Hedef − Yiyecek + Egzersiz">Kaloriler</PageTitle>

      <div className="flex items-center gap-4">
        <div className="relative flex-shrink-0" style={{ width: 128, height: 128 }}>
          <svg width="128" height="128" viewBox="0 0 128 128" className="-rotate-90">
            <circle cx="64" cy="64" r={R} fill="none" strokeWidth="9" className="stroke-slate-100 dark:stroke-[#151724]" />
            {budget > 0 && (
              <circle
                cx="64"
                cy="64"
                r={R}
                fill="none"
                stroke={ringColor}
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={`${C * frac} ${C}`}
                style={{ transition: 'stroke-dasharray .4s ease' }}
              />
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className={`text-[32px] leading-none font-bold tracking-tight tabular-nums ${
                over ? 'text-rose-500' : 'text-slate-900 dark:text-[#e0e1e6]'
              }`}
            >
              {budget > 0 ? Math.abs(remaining).toLocaleString('tr-TR') : eaten.toLocaleString('tr-TR')}
            </span>
            <span className="text-[12px] text-slate-500 mt-1.5">{budget > 0 ? (over ? 'Fazla' : 'Kalan') : 'Yiyecek'}</span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {budget > 0 ? (
            <div className="space-y-3">
              <StatRow icon="flag" color="#94a3b8" label="Temel Hedef" value={target} />
              <StatRow icon="fork" color="#70b8ff" label="Yiyecek" value={eaten} />
              <StatRow icon="flame" color="#f59525" label="Egzersiz" value={exercise} />
            </div>
          ) : (
            <p className="text-[13px] text-slate-500 leading-relaxed">
              Kalori hedefini Ayarlar’dan gir; hedef, yiyecek ve egzersiz burada birlikte görünsün.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// 2. SAYFA — Makrolar: uc halka, ustlerinde RENKLI etiket, altlarinda "kaldi".
function MacroPage({
  carb,
  fat,
  protein,
  g
}: {
  carb: number
  fat: number
  protein: number
  g: ReturnType<typeof dailyTargets>
}) {
  return (
    <div className="card p-5 h-full">
      <PageTitle>Makrolar</PageTitle>
      <div className="grid grid-cols-3 gap-2">
        <MacroRing label="Karbonhidrat" grams={carb} goalG={g.carb} color="#63d4ce" />
        <MacroRing label="Yağ" grams={fat} goalG={g.fat} color="#c38dd8" />
        <MacroRing label="Protein" grams={protein} goalG={g.protein} color="#ffc66d" />
      </div>
    </div>
  )
}

// 3. ve 4. SAYFA — besin degeri listesi: solda ad, sagda "alinan/hedef",
// altinda ince dolum cubugu. Hedef asilirsa cubuk kirmiziya doner.
function NutrientPage({
  title,
  rows
}: {
  title: string
  rows: { label: string; value: number; goal: number; unit: string }[]
}) {
  return (
    <div className="card p-5 h-full">
      <PageTitle>{title}</PageTitle>
      <div className="space-y-4">
        {rows.map((r) => {
          const frac = r.goal > 0 ? Math.min(1, r.value / r.goal) : 0
          const over = r.goal > 0 && r.value > r.goal
          return (
            <div key={r.label}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[15px] text-slate-700 dark:text-[#e0e1e6] truncate">{r.label}</span>
                <span className="text-[15px] font-bold text-slate-900 dark:text-[#e0e1e6] tabular-nums flex-shrink-0">
                  {Math.round(r.value).toLocaleString('tr-TR')}/{r.goal.toLocaleString('tr-TR')}
                  {r.unit}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-[#151724] mt-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${over ? 'bg-rose-500' : 'bg-brand-600'}`}
                  style={{ width: `${frac * 100}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Kalori kartindaki tek satir — MyFitnessPal duzeni: solda RENKLI simge,
// sagda ustte kucuk gri etiket, altinda KALIN rakam.
function StatRow({ icon, color, label, value }: { icon: StatIcon; color: string; label: string; value: number }) {
  return (
    <div className="flex items-start gap-3">
      <StatGlyph name={icon} color={color} />
      <div className="min-w-0">
        {/* MFP'de etiket de BEYAZ (gri degil), sadece rakam kalin */}
        <div className="text-[13px] text-slate-700 dark:text-[#e0e1e6] leading-tight truncate">{label}</div>
        <div className="text-[19px] font-bold text-slate-900 dark:text-[#e0e1e6] tabular-nums leading-tight">
          {value.toLocaleString('tr-TR')}
        </div>
      </div>
    </div>
  )
}

type StatIcon = 'flag' | 'fork' | 'flame'
function StatGlyph({ name, color }: { name: StatIcon; color: string }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: 'flex-shrink-0 mt-0.5'
  }
  if (name === 'flag')
    return (
      <svg {...common}>
        <line x1="5" y1="21" x2="5" y2="3" />
        <path d="M5 4h11l-2 3.5L16 11H5z" fill={color} stroke="none" />
      </svg>
    )
  if (name === 'fork')
    return (
      <svg {...common}>
        <path d="M8 3v7a2 2 0 0 1-2 2 2 2 0 0 1-2-2V3" />
        <line x1="6" y1="12" x2="6" y2="21" />
        <path d="M17 3c-1.6 1.2-2.5 3-2.5 5.2 0 1.7.8 2.8 2.5 2.8h1V3z" />
        <line x1="18" y1="11" x2="18" y2="21" />
      </svg>
    )
  return (
    <svg {...common}>
      <path d="M12 2.5c2.8 3.2 5.5 5.6 5.5 9.3A5.5 5.5 0 0 1 12 21a5.5 5.5 0 0 1-5.5-5.2c0-2.4 1.2-4 2.6-5.8.4 1.3 1.1 2 2 2.3-.4-2.9.3-5.6.9-9.8z" />
    </svg>
  )
}

// Tek makro halkasi (MyFitnessPal tarzi): ustte RENKLI etiket, ortada yenen
// gram + /hedef, altta "X gr. kaldı".
function MacroRing({ label, grams, goalG, color }: { label: string; grams: number; goalG: number; color: string }) {
  const R = 33
  const C = 2 * Math.PI * R
  const frac = goalG > 0 ? Math.min(1, grams / goalG) : 0
  const left = Math.max(0, goalG - Math.round(grams))
  return (
    <div className="flex flex-col items-center text-center min-w-0">
      {/* MFP'de makro etiketi kendi RENGINDE yazilir — halkayla eslesir */}
      <span className="text-[13px] font-semibold mb-2 truncate w-full" style={{ color }}>
        {label}
      </span>
      <div className="relative" style={{ width: 78, height: 78 }}>
        <svg width="78" height="78" viewBox="0 0 78 78" className="-rotate-90">
          <circle cx="39" cy="39" r={R} fill="none" strokeWidth="6" className="stroke-slate-100 dark:stroke-[#151724]" />
          {goalG > 0 && (
            <circle
              cx="39"
              cy="39"
              r={R}
              fill="none"
              stroke={color}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${C * frac} ${C}`}
              style={{ transition: 'stroke-dasharray .4s ease' }}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[18px] leading-none font-semibold text-slate-900 dark:text-[#e0e1e6] tabular-nums">
            {Math.round(grams)}
          </span>
          {goalG > 0 && <span className="text-[11px] text-slate-500 leading-none mt-1">/{goalG}g</span>}
        </div>
      </div>
      <span className="text-[12px] text-slate-500 mt-2">{goalG > 0 ? `${left}gr. kaldı` : `${Math.round(grams)} g`}</span>
    </div>
  )
}

// ADIM + EGZERSİZ — MFP'de kontrol panelinin altinda YAN YANA iki kucuk kart.
// Adim Health Connect'ten otomatik gelir ve kalori butcesine KARISMAZ;
// egzersiz ise butceye eklenir. MFP'deki ayrimin aynisi.
function StepExerciseRow({ exercises, stepGoal }: { exercises: Exercise[]; stepGoal?: number }) {
  const today = todayStr()
  const todays = exercises.filter((e) => e.dateStr === today)
  const dayRow = useLiveQuery(() => getStepsRow(today), [today], undefined)

  const steps = dayRow?.count || todays.reduce((s, e) => s + (e.steps || 0), 0)
  const goal = stepGoal && stepGoal > 0 ? stepGoal : 10000
  const pct = Math.min(100, Math.round((steps / goal) * 100))

  const exKcal = todays.reduce((s, e) => s + (e.kcal || 0), 0)
  const minutes = todays.reduce((s, e) => s + (e.minutes || 0), 0)
  const hh = Math.floor(minutes / 60)
  const mm = minutes % 60

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="card p-4">
        <p className="text-[17px] font-bold text-slate-900 dark:text-[#e0e1e6] leading-tight">Adım</p>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[20px] leading-none">👟</span>
          <span className="text-[22px] font-bold text-slate-900 dark:text-[#e0e1e6] tabular-nums leading-none">
            {steps.toLocaleString('tr-TR')}
          </span>
        </div>
        <p className="text-[13px] text-slate-500 mt-2 truncate">Hedef: {goal.toLocaleString('tr-TR')} adım</p>
        <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-[#151724] mt-2 overflow-hidden">
          <div className="h-full rounded-full bg-[#f54b72] transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <Link to="/egzersiz" className="card p-4 block active:scale-[0.99] transition">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[17px] font-bold text-slate-900 dark:text-[#e0e1e6] leading-tight">Egzersiz</p>
          <span className="text-[20px] leading-none text-slate-400 -mt-0.5">+</span>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[18px] leading-none">🔥</span>
          <span className="text-[17px] font-semibold text-slate-700 dark:text-[#e0e1e6] tabular-nums">{exKcal} kal</span>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[18px] leading-none">🕐</span>
          <span className="text-[17px] font-semibold text-slate-700 dark:text-[#e0e1e6] tabular-nums">
            {hh}:{String(mm).padStart(2, '0')} sa.
          </span>
        </div>
      </Link>
    </div>
  )
}

// KRIZ ANI: "Canim cekiyor!" — koc aninda devreye girer; sonuc kaydedilir.
function CrisisSOS({ entries, exercises, settings }: { entries: DietEntry[]; exercises: Exercise[]; settings?: DietSettings }) {
  const today = todayStr()
  const [open, setOpen] = useState(false)
  const [chat, setChat] = useState<{ role: 'user' | 'assistant'; text: string }[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<'' | 'resisted' | 'ate'>('')
  const waterMl = useLiveQuery(() => getWaterMlDay(today), [today], 0) ?? 0
  const checkins = useLiveQuery(() => listCheckinsDay(today), [today], [])

  const hasKey = !!settings?.apiKey

  async function ask(question?: string) {
    const q = (question ?? input).trim()
    if (!q || !hasKey) return
    const history = [...chat, { role: 'user' as const, text: q }]
    setChat(history)
    setInput('')
    setBusy(true)
    try {
      const answer = await cravingHelp({
        apiKey: settings!.apiKey!,
        context: buildDaySummary(entries, exercises, today, waterMl, checkins ?? []),
        history,
        model: settings?.model,
        userName: settings?.userName,
        goal: settings?.goal,
        dietPlan: settings?.dietPlan,
        dietitianNotes: settings?.dietitianNotes,
        health: await buildHealthContext(settings)
      })
      setChat([...history, { role: 'assistant', text: answer }])
    } catch (err) {
      setChat([...history, { role: 'assistant', text: err instanceof Error ? err.message : 'Cevap alınamadı.' }])
    } finally {
      setBusy(false)
    }
  }

  async function finish(outcome: 'resisted' | 'ate') {
    const what = chat.find((m) => m.role === 'user')?.text
    await addCraving(outcome, what)
    setDone(outcome)
    setTimeout(() => {
      setOpen(false)
      setChat([])
      setDone('')
    }, 2600)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl bg-rose-600 text-white font-semibold text-[16px] py-3.5 active:scale-[0.98] transition"
      >
        🆘 Canım çekiyor!
      </button>
    )
  }

  return (
    <div className="card p-4 space-y-2.5 bg-rose-50 border-rose-200">
      <div className="flex items-center justify-between">
        <p className="font-extrabold text-rose-700">🆘 Kriz anı — buradayım!</p>
        <button
          onClick={() => {
            setOpen(false)
            setChat([])
          }}
          className="text-xs text-slate-400"
        >
          kapat ✕
        </button>
      </div>

      {done ? (
        <p className="text-sm font-bold text-center py-3 text-rose-800">
          {done === 'resisted' ? '🎉 Direndin! Bu bir zaferdi, kaydettim. +10 moral' : '🤝 Olsun, kaydettim. Bir sonrakinde sen kazanacaksın.'}
        </p>
      ) : (
        <>
          {!hasKey ? (
            <p className="text-xs text-slate-500">
              Koçun devreye girmesi için{' '}
              <Link to="/ayarlar" className="underline font-semibold">
                Ayarlar
              </Link>
              ’dan API anahtarı ekle.
            </p>
          ) : (
            <>
              {chat.length === 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {['🍫 Tatlı çekiyor', '🍟 Tuzlu/çıtır çekiyor', '🍞 Çok acıktım', '😤 Canım sıkkın, yemek istiyorum'].map((t) => (
                    <button
                      key={t}
                      onClick={() => ask(t)}
                      disabled={busy}
                      className="text-xs font-semibold rounded-full px-3 py-1.5 bg-white text-rose-700 border border-rose-200"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
              {chat.length > 0 && (
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {chat.map((m, i) => (
                    <div
                      key={i}
                      className={`text-sm rounded-xl px-3 py-2 ${
                        m.role === 'user' ? 'bg-rose-600 text-white ml-8' : 'bg-white text-slate-800 mr-8'
                      }`}
                    >
                      {m.text}
                    </div>
                  ))}
                  {busy && <p className="text-xs text-slate-400 mr-8">koç yazıyor…</p>}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  className="field-input flex-1"
                  placeholder="Ne çekiyor? örn. baklava…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && ask()}
                />
                <button onClick={() => ask()} disabled={busy || !input.trim()} className="btn bg-rose-600 text-white px-4">
                  Yaz
                </button>
              </div>
            </>
          )}
          {chat.length > 0 && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button onClick={() => finish('resisted')} className="btn bg-emerald-600 text-white py-2.5">
                💪 Direndim!
              </button>
              <button onClick={() => finish('ate')} className="btn bg-slate-200 text-slate-700 py-2.5">
                😋 Yine de yedim
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// His emojisi (1-10 moral puanina gore)
function moodEmoji(m?: number): string {
  return m == null ? '💬' : m >= 8 ? '😄' : m >= 6 ? '🙂' : m >= 4 ? '😐' : '😔'
}

// Gun ici "nasilsin?" — GUNDE ISTEDIGIN KADAR kayit (saatli). Yemek oncesi/
// sonrasi fark etmez; koc saatlere bakarak ogunlerle bag kurar.
function MoodCheckIn() {
  const today = todayStr()
  const list = useLiveQuery(() => listCheckinsDay(today), [today], []) ?? []
  const [mood, setMood] = useState<number | null>(null)
  const [hunger, setHunger] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [flash, setFlash] = useState('')

  async function save() {
    if (mood == null && hunger == null) return
    await addCheckin(mood ?? undefined, note.trim() || undefined, hunger ?? undefined)
    setMood(null)
    setHunger(null)
    setNote('')
    setFlash('Kaydedildi 👍')
    setTimeout(() => setFlash(''), 3000)
  }

  const last = list[list.length - 1]

  return (
    <div className="card p-4 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="section-title">{moodEmoji(last?.mood)} Şu an nasılsın?</span>
        {list.length > 0 && <span className="text-xs font-semibold text-slate-500">{list.length} kayıt bugün</span>}
      </div>

      {/* Bugunun his/aclik zaman cizelgesi */}
      {list.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {list.map((c) => (
            <span key={c.id} className="chip bg-violet-50 text-violet-800 border border-violet-100">
              {new Date(c.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}{' '}
              {c.mood != null && <>{moodEmoji(c.mood)} {c.mood}</>}
              {c.hunger != null && <span className="ml-1">🍽️ {c.hunger}</span>}
              <button onClick={() => void deleteCheckin(c.id!)} className="ml-0.5 text-violet-300">
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Moral / ruh hali */}
      <div>
        <p className="text-xs font-semibold text-slate-500 mb-1">😊 Moralin (nasıl hissediyorsun?)</p>
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => setMood(mood === n ? null : n)}
              className={`w-7 h-7 rounded-full text-xs font-bold ${
                mood === n ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-slate-400 mt-0.5">1: kötü · 10: harika</p>
      </div>

      {/* Aclik — moralden AYRI boyut */}
      <div>
        <p className="text-xs font-semibold text-slate-500 mb-1">🍽️ Açlığın (şu an ne kadar açsın?)</p>
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => setHunger(hunger === n ? null : n)}
              className={`w-7 h-7 rounded-full text-xs font-bold ${
                hunger === n ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-slate-400 mt-0.5">1: tok · 10: çok aç</p>
      </div>

      {(mood != null || hunger != null) && (
        <div className="space-y-1.5">
          <textarea
            className="field-input min-h-[48px]"
            placeholder="İstersen not ekle: örn. öğleden 2 saat sonra acıktım, enerjim düştü"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button onClick={save} className="btn-primary w-full py-2">
            Kaydet{mood != null ? ` · moral ${mood}` : ''}{hunger != null ? ` · açlık ${hunger}` : ''}
          </button>
        </div>
      )}
      {flash && <p className="text-xs font-semibold text-violet-700">{flash}</p>}
    </div>
  )
}

// Gunluk su takibi (ml). Pratik +ml butonlari; hedef cubugu.
function WaterCard({ goalMl }: { goalMl: number }) {
  const today = todayStr()
  const rows = useLiveQuery(() => listWater(), [], [])
  const add = (d: number) => void addWaterMl(today, d)

  // Son 7 gunun ml'i (Samsung tarzi mini cubuk + gun seridi)
  const mlOf = (d: string) => {
    const r = (rows ?? []).find((x) => x.dateStr === d)
    return r ? (r.ml != null ? r.ml : (r.glasses || 0) * 200) : 0
  }
  const series = Array.from({ length: 7 }, (_, i) => {
    const d = todayStr(new Date(Date.now() - (6 - i) * 86_400_000))
    return { d, ml: mlOf(d), day: new Date(d + 'T00:00:00').getDate() }
  })
  const ml = mlOf(today)
  const pct = goalMl > 0 ? Math.min(100, Math.round((ml / goalMl) * 100)) : 0
  const reached = ml >= goalMl
  const maxMl = Math.max(goalMl, ...series.map((s) => s.ml), 1)

  return (
    <div className="card p-4 bg-sky-50 border-sky-100">
      <div className="flex items-start justify-between gap-3">
        {/* Buyuk rakam */}
        <div className="min-w-0">
          <span className="section-title text-sky-700">💧 Su</span>
          <p className="mt-1 leading-none">
            <span className="text-5xl font-extrabold text-sky-700">{ml}</span>
            <span className="text-lg font-bold text-sky-400"> ml</span>
          </p>
          <p className="text-xs text-slate-400 mt-1.5">
            / {goalMl} ml hedef{reached ? ' · tamam 🎉' : ''}
          </p>
        </div>
        {/* 7 gunluk mini cubuk grafik + gun seridi */}
        <div className="flex-shrink-0">
          <div className="flex items-end gap-1.5 h-14">
            {series.map((s, i) => {
              const h = Math.max(5, Math.round((s.ml / maxMl) * 56))
              const isToday = i === 6
              return (
                <div
                  key={s.d}
                  className={`w-2.5 rounded-full transition-all ${isToday ? 'bg-sky-500' : s.ml > 0 ? 'bg-sky-300' : 'bg-sky-200 dark:bg-white/10'}`}
                  style={{ height: `${h}px` }}
                />
              )
            })}
          </div>
          <div className="flex gap-1.5 mt-1.5">
            {series.map((s, i) => (
              <span key={s.d} className={`w-2.5 text-center text-[9px] ${i === 6 ? 'text-sky-600 font-bold' : 'text-slate-400'}`}>
                {s.day}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Ilerleme cubugu */}
      <div className="h-2 w-full bg-sky-100 dark:bg-white/10 rounded-full overflow-hidden mt-3">
        <div className={`h-full rounded-full transition-all ${reached ? 'bg-emerald-500' : 'bg-sky-500'}`} style={{ width: `${pct}%` }} />
      </div>

      {/* Hizli ekleme */}
      <div className="grid grid-cols-3 gap-2 mt-3">
        <button onClick={() => add(200)} className="btn bg-white text-sky-700 border border-sky-200 py-2.5 flex-col gap-0 leading-tight">
          <span className="text-base">🥛 +200</span>
          <span className="text-[10px] text-slate-400">bardak</span>
        </button>
        <button onClick={() => add(330)} className="btn bg-white text-sky-700 border border-sky-200 py-2.5 flex-col gap-0 leading-tight">
          <span className="text-base">🧴 +330</span>
          <span className="text-[10px] text-slate-400">şişe</span>
        </button>
        <button onClick={() => add(500)} className="btn bg-white text-sky-700 border border-sky-200 py-2.5 flex-col gap-0 leading-tight">
          <span className="text-base">🍶 +500</span>
          <span className="text-[10px] text-slate-400">büyük</span>
        </button>
      </div>
      {ml > 0 && (
        <button onClick={() => add(-200)} className="w-full text-center text-xs text-slate-400 underline mt-2">
          geri al (−200 ml)
        </button>
      )}
    </div>
  )
}

// Bugunun kompakt ozetini (yemekler, kararlar, spor) metne dokup sohbete baglam verir
function buildDaySummary(entries: DietEntry[], exercises: Exercise[], today: string, waterMl = 0, checkins: CheckIn[] = []): string {
  const meals = entries.filter((e) => e.dateStr === today).sort((a, b) => a.createdAt - b.createdAt)
  const exs = exercises.filter((e) => e.dateStr === today)
  const lines: string[] = []
  const adh = dayAdherence(entries, today)
  if (adh != null) lines.push(`Diyet başarısı: %${adh}.`)
  const ate = meals.filter((e) => e.decision === 'ate')
  const resisted = meals.filter((e) => e.decision === 'resisted').length
  const kcalIn = ate.reduce((s, e) => s + (e.estimatedCalories || 0), 0)
  lines.push(`${resisted} vazgeçiş, ${ate.length} yenen öğün, ~${kcalIn} kcal alındı.`)
  const TR: Record<string, string> = { resisted: 'vazgeçti', ate: 'yedi', none: 'karar yok' }
  for (const e of meals) {
    const t = new Date(e.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    const extra = [e.alsoMeal, e.alsoMeal2].filter(Boolean).map((m) => '+' + mealLabel(m as MealType)).join('')
    const mt = e.mealType ? mealLabel(e.mealType) + (extra ? extra + ' (birleşik)' : '') + ' ' : ''
    lines.push(`- ${t} ${mt}${e.foodName} (~${e.estimatedCalories} kcal) — ${TR[e.decision] ?? ''}`)
  }
  if (exs.length) {
    const burn = exs.reduce((s, e) => s + (e.kcal || 0), 0)
    lines.push(`Spor: ${exs.map((e) => e.text + (e.minutes ? ` (${e.minutes} dk)` : '')).join(', ')}${burn ? ` — ~${burn} kcal yakıldı` : ''}.`)
  }
  if (waterMl > 0) lines.push(`Su: ${waterMl} ml içildi.`)
  if (checkins.length) {
    const parts = checkins.map((c) => {
      const t = new Date(c.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
      return `${t}${c.mood != null ? ` moral ${c.mood}/10` : ''}${c.note ? ` ("${c.note}")` : ''}`
    })
    lines.push(`Gün içi hisler (saatli): ${parts.join(' · ')} — öğün/spor saatleriyle karşılaştırıp bağ kurabilirsin.`)
  }
  return lines.join('\n')
}

// TEK KOC SOHBETI: menu ("oglen ne var"), yarin plani, Z raporu, gun analizi,
// beslenme sorulari — hepsi bu tek kutudan. Buton yok, yazip sorarsin.
function CoachChat({
  entries,
  exercises,
  settings
}: {
  entries: DietEntry[]
  exercises: Exercise[]
  settings?: DietSettings
}) {
  const today = todayStr()
  const [chat, setChat] = useState<{ role: 'user' | 'assistant'; text: string }[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const waterMl = useLiveQuery(() => getWaterMlDay(today), [today], 0) ?? 0
  const checkins = useLiveQuery(() => listCheckinsDay(today), [today], [])

  const hasKey = !!settings?.apiKey

  async function ask() {
    const q = input.trim()
    if (!q || !hasKey) return
    const history = [...chat, { role: 'user' as const, text: q }]
    setChat(history)
    setInput('')
    setBusy(true)
    try {
      const pendingShopping = (await listShopping())
        .filter((i) => !i.done)
        .map((i) => i.text)
        .join(', ')
      const answer = await coachChat({
        apiKey: settings!.apiKey!,
        daySummary: buildDaySummary(entries, exercises, today, waterMl, checkins ?? []),
        shoppingList: pendingShopping || undefined,
        history,
        model: settings?.model,
        userName: settings?.userName,
        goal: settings?.goal,
        dietPlan: settings?.dietPlan,
        dietitianNotes: settings?.dietitianNotes,
        health: await buildHealthContext(settings)
      })
      // Koç bugüne özel bir plan/not tespit ettiyse [[NOT: ...]] işaretiyle
      // döner: onu günün notu olarak kaydet, gösterilen metinden çıkar.
      let shown = answer
      const m = answer.match(/\[\[\s*NOT:\s*([\s\S]*?)\]\]/i)
      if (m) {
        shown = answer.replace(m[0], '').trim()
        const noteText = m[1].trim()
        const clear = /^(sil|iptal|yok|kaldır|temizle)$/i.test(noteText)
        await setDayNote(today, clear ? '' : noteText)
        shown += clear
          ? '\n\n📝 (Bugünün notu temizlendi)'
          : `\n\n📝 (Bugünün notuna işlendi — tüm gün buna göre değerlendireceğim)`
      }
      setChat([...history, { role: 'assistant', text: shown }])
    } catch (err) {
      setChat([...history, { role: 'assistant', text: err instanceof Error ? err.message : 'Cevap alınamadı.' }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="section-title">Koçuna Sor</p>
        <Link to="/menu" className="text-xs text-brand-700 underline">
          Menüm →
        </Link>
      </div>
      {!hasKey ? (
        <p className="text-xs text-slate-500">
          Sohbet için{' '}
          <Link to="/ayarlar" className="underline font-semibold">
            Ayarlar
          </Link>
          ’dan API anahtarı ekle.
        </p>
      ) : (
        <>
          {chat.length > 0 && (
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {chat.map((m, i) => (
                <div
                  key={i}
                  className={`text-sm rounded-xl px-3 py-2 whitespace-pre-wrap ${
                    m.role === 'user' ? 'bg-brand-600 text-white ml-8' : 'bg-slate-50 text-slate-800 mr-8'
                  }`}
                >
                  {m.text}
                </div>
              ))}
              {busy && <p className="text-xs text-slate-400 mr-8">koç yazıyor…</p>}
            </div>
          )}
          <div className="flex gap-2">
            <input
              className="field-input flex-1"
              placeholder="örn. Öğlen ne var? · Z raporu kes · Yarını planla"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && ask()}
            />
            <button onClick={() => ask()} disabled={busy || !input.trim()} className="btn-primary px-4">
              Sor
            </button>
          </div>
          {chat.length === 0 && (
            <p className="text-[11px] text-slate-400">
              Menü, plan, Z raporu, gün analizi — ne istersen yaz.
            </p>
          )}
        </>
      )}
    </div>
  )
}

// DISARIDA/RESTORAN: menu fotograf(lar)ini yukle, yapay zeka diyetine en
// uygun secenekleri cikarsin; menu olmadan da sohbet edilebilir. Ana sayfada
// degil; "Dışarıda" sayfasinda kullanilir (Dining.tsx export eder).
export function RestaurantMenu({ settings }: { settings?: DietSettings }) {
  const [open, setOpen] = useState(false)
  const [imgs, setImgs] = useState<string[]>([]) // eklenen menu fotograflari (data URL)
  const [sent, setSent] = useState(false) // ekler bir kez gonderildi mi (token tasarrufu)
  const [chat, setChat] = useState<{ role: 'user' | 'assistant'; text: string }[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [link, setLink] = useState('') // kare koddan/elle girilen menu linki
  const [menuDoc, setMenuDoc] = useState<{ pdfDataUrl?: string; text?: string } | null>(null) // linkten cozulen menu
  const [linkMsg, setLinkMsg] = useState('') // link durum mesaji
  const fileRef = useRef<HTMLInputElement>(null)
  const hasKey = !!settings?.apiKey

  // Menu fotografi ekle: APK'da native cok-secim, web'de <input multiple>
  async function addImages() {
    if (Capacitor.isNativePlatform()) {
      try {
        const { Camera } = await import('@capacitor/camera')
        const res = await Camera.pickImages({ quality: 80, limit: 8 })
        const urls = await Promise.all(
          res.photos.map((p) => urlToResizedDataUrl(p.webPath || (p as { path?: string }).path || '', 1400, 0.8))
        )
        const ok = urls.filter((u): u is string => !!u)
        if (ok.length) setImgs((prev) => [...prev, ...ok].slice(0, 8))
      } catch {
        /* iptal/izin — sessiz gec */
      }
      return
    }
    fileRef.current?.click()
  }

  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!files.length) return
    const urls = await Promise.all(files.map((f) => fileToResizedDataUrl(f, 1400, 0.8).catch(() => null)))
    const ok = urls.filter((u): u is string => !!u)
    if (ok.length) setImgs((prev) => [...prev, ...ok].slice(0, 8))
  }

  function removeImg(i: number) {
    setImgs((prev) => prev.filter((_, idx) => idx !== i))
  }

  // Kare kodu (QR) tara -> link alani doldurulur ve otomatik cozulur (APK)
  async function scanQr() {
    setLinkMsg('')
    try {
      const code = await nativeScan() // ML Kit QR de okur; web'de null doner
      if (code) {
        setLink(code)
        await resolveLink(code)
      } else {
        setLinkMsg('Kare kod okunamadı. Linki elle de yapıştırabilirsin.')
      }
    } catch {
      setLinkMsg('Tarayıcı açılamadı. Linki elle yapıştır.')
    }
  }

  // Menu linkini coz: web sitesi/PDF indirilir, icerigi menuDoc'a alinir
  async function resolveLink(urlArg?: string) {
    const url = (urlArg ?? link).trim()
    if (!url) return
    setLinkMsg('Menü linki açılıyor…')
    setBusy(true)
    try {
      const res = await fetchMenuContent(url)
      if (res.kind === 'pdf') {
        setMenuDoc({ pdfDataUrl: res.pdfDataUrl })
        setLinkMsg('Menü (PDF) alındı ✓ — “Diyetime uygun ne var?”a dokun.')
      } else if (res.kind === 'text') {
        setMenuDoc({ text: res.text })
        setLinkMsg('Menü içeriği alındı ✓ — “Diyetime uygun ne var?”a dokun.')
      } else {
        setMenuDoc(null)
        setLinkMsg(res.note || 'Menü okunamadı. Linki açıp ekran görüntüsünü fotoğraf olarak ekleyebilirsin.')
      }
    } catch {
      setMenuDoc(null)
      setLinkMsg('Menü okunamadı. Ekran görüntüsünü fotoğraf olarak ekleyebilirsin.')
    } finally {
      setBusy(false)
    }
  }

  const hasAttach = imgs.length > 0 || !!menuDoc

  async function send(preset?: string) {
    if (!hasKey || busy) return
    const q = (preset ?? input).trim()
    // Ilk turda menu eki (foto/PDF/site) varsa soru bos olsa bile analiz iste
    const firstWithAttach = !sent && hasAttach
    if (!q && !firstWithAttach) return
    const userText = q || 'Bu menüden diyetime en uygun ne var? Öncelik sırasıyla öner.'
    const history = [...chat, { role: 'user' as const, text: userText }]
    setChat(history)
    setInput('')
    setBusy(true)
    try {
      const answer = await menuChat({
        apiKey: settings!.apiKey!,
        // Ekler yalnizca ilk turda gonderilir (token tasarrufu)
        images: firstWithAttach && imgs.length ? imgs : undefined,
        pdfDataUrl: firstWithAttach ? menuDoc?.pdfDataUrl : undefined,
        menuText: firstWithAttach ? menuDoc?.text : undefined,
        history,
        model: settings?.model,
        userName: settings?.userName,
        goal: settings?.goal,
        dietPlan: settings?.dietPlan,
        dietitianNotes: settings?.dietitianNotes,
        health: await buildHealthContext(settings)
      })
      setChat([...history, { role: 'assistant', text: answer }])
      if (firstWithAttach) {
        setSent(true) // menu artik "goruldu", tekrar gonderme
        setLinkMsg('')
      }
    } catch (err) {
      setChat([...history, { role: 'assistant', text: err instanceof Error ? err.message : 'Cevap alınamadı.' }])
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setImgs([])
    setSent(false)
    setChat([])
    setInput('')
    setLink('')
    setMenuDoc(null)
    setLinkMsg('')
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="card p-3 w-full flex items-center gap-3 text-left hover:bg-slate-50 transition"
      >
        <span className="text-2xl">🍽️</span>
        <div className="flex-1">
          <p className="text-sm font-bold text-slate-800">Dışarıda mısın? Menüyü yükle</p>
          <p className="text-xs text-slate-500">Menüyü fotoğrafla ya da kare kodu (QR) okut; diyetine uygununu birlikte seçelim.</p>
        </div>
        <span className="text-slate-400">→</span>
      </button>
    )
  }

  return (
    <div className="card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="section-title">Dışarıda / Restoran</p>
        <button onClick={() => setOpen(false)} className="text-xs text-slate-400">kapat</button>
      </div>

      {!hasKey ? (
        <p className="text-xs text-slate-500">
          Bunun için{' '}
          <Link to="/ayarlar" className="underline font-semibold">Ayarlar</Link>’dan API anahtarı ekle.
        </p>
      ) : (
        <>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onPickFiles} />

          {/* Eklenen menu fotograflari */}
          {imgs.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {imgs.map((src, i) => (
                <div key={i} className="relative">
                  <img src={src} alt={`menü ${i + 1}`} className="w-16 h-16 rounded-lg object-cover border border-slate-200" />
                  {!sent && (
                    <button
                      onClick={() => removeImg(i)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 text-white text-xs leading-none"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Sohbet akisi */}
          {chat.length > 0 && (
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {chat.map((m, i) => (
                <div
                  key={i}
                  className={`text-sm rounded-xl px-3 py-2 whitespace-pre-wrap ${
                    m.role === 'user' ? 'bg-brand-600 text-white ml-8' : 'bg-slate-50 text-slate-800 mr-8'
                  }`}
                >
                  {m.text}
                </div>
              ))}
              {busy && <p className="text-xs text-slate-400 mr-8">koç bakıyor…</p>}
            </div>
          )}

          {/* Aksiyonlar: foto ekle + kare kod/link */}
          {!sent && (
            <>
              <button onClick={addImages} disabled={busy} className="btn bg-slate-100 text-slate-700 hover:bg-slate-200 w-full">
                📷 {imgs.length ? 'Fotoğraf ekle' : 'Menü fotoğrafı ekle'}
              </button>

              {/* Kare kod (QR) / menu linki */}
              <div className="rounded-xl bg-slate-50 p-2 space-y-1.5">
                <p className="text-[11px] font-semibold text-slate-500">🔗 Menüde kare kod (QR) mı var?</p>
                <div className="flex gap-2">
                  {Capacitor.isNativePlatform() && (
                    <button onClick={scanQr} disabled={busy} className="btn bg-slate-200 text-slate-700 hover:bg-slate-300 px-3 whitespace-nowrap">
                      📷 Tara
                    </button>
                  )}
                  <input
                    className="field-input flex-1"
                    placeholder="menü linkini yapıştır…"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && resolveLink()}
                  />
                  <button onClick={() => resolveLink()} disabled={busy || !link.trim()} className="btn-primary px-3">
                    Çöz
                  </button>
                </div>
                {menuDoc && <p className="text-[11px] text-emerald-700 font-semibold">✓ Menü {menuDoc.pdfDataUrl ? '(PDF)' : 'içeriği'} eklendi.</p>}
                {linkMsg && <p className="text-[11px] text-slate-500">{linkMsg}</p>}
              </div>
            </>
          )}

          {hasAttach && !sent && (
            <button onClick={() => send()} disabled={busy} className="btn-primary w-full">
              🍽️ Diyetime uygun ne var?
            </button>
          )}

          {/* Yazili soru / takip */}
          <div className="flex gap-2">
            <input
              className="field-input flex-1"
              placeholder={hasAttach ? 'İstersen bir not ekle (örn. tatlı da var mı?)' : 'Nerede olduğunu yaz, öneri isteyeyim…'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
            />
            <button onClick={() => send()} disabled={busy || (!input.trim() && !(hasAttach && !sent))} className="btn-primary px-4">
              Sor
            </button>
          </div>

          {chat.length > 0 && (
            <button onClick={reset} className="w-full text-center text-xs text-slate-400 py-1">
              Yeni menü / baştan
            </button>
          )}
          {chat.length === 0 && (
            <p className="text-[11px] text-slate-400">
              Birden fazla sayfa ekleyebilirsin; koç diyetine en uygununu önerir.
            </p>
          )}
        </>
      )}
    </div>
  )
}

// Tek makro satiri: ad, gram ve kalori payi cubugu
// Yarim saat gecmis ama tokluk puani verilmemis "yedim" ogunleri sorar
// Girilmeyen (foto/veri yok) ve saati gecmis TAKIP EDILEN ogunler icin tek satir
// kirmizi uyari. Ogun listesi DEGIL; sadece atlanan ogunu hatirlatan kucuk cizgi.
// Ogun girilince (birlesik dahil) kaybolur. Ogun listesi streak.ts'ten paylasilir.
function MissedMealsAlert({ entries, tracked }: { entries: DietEntry[]; tracked: MealType[] }) {
  const today = todayStr()
  const todays = entries.filter((e) => e.dateStr === today)
  const covered = new Set<MealType>()
  for (const e of todays) for (const m of [e.mealType, e.alsoMeal, e.alsoMeal2]) if (m) covered.add(m)
  const nowH = new Date().getHours()
  const trackedSet = new Set(tracked)

  const missed = TRACKED_MEALS.filter((m) => trackedSet.has(m.meal) && !covered.has(m.meal) && nowH >= m.overdueHour)
  if (missed.length === 0) return null

  return (
    <div className="card p-3 bg-rose-50 border border-rose-200 flex items-center gap-3">
      <span className="relative flex h-3 w-3 flex-shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500" />
      </span>
      <p className="text-sm text-rose-800 leading-snug">
        <span className="font-bold">Girmediğin öğün:</span> {missed.map((m) => mealLabel(m.meal)).join(', ')}
        <span className="text-rose-500"> — girmezsen başarısız sayılır.</span>
      </p>
    </div>
  )
}

// Sıradaki öğün: TÜM öğünler (ara öğünler dahil) içinde saati gelmemiş ve henüz
// girilmemiş İLK öğünü ana sayfada net gösterir + ne kadar kaldığını yazar.
// Karta dokununca o öğünü eklemeye başlar. Bugünküler bittiyse yarının ilki.
function NextMeal({ entries, settings, onPick }: { entries: DietEntry[]; settings?: DietSettings; onPick: (m: MealType) => void }) {
  const today = todayStr()
  const todays = entries.filter((e) => e.dateStr === today)
  const covered = new Set<MealType>()
  for (const e of todays) for (const m of [e.mealType, e.alsoMeal, e.alsoMeal2]) if (m) covered.add(m)

  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()

  // HANGİ ÖĞÜNLER VAR? Tek kaynak: Hatırlatıcılar > "Öğünlerim".
  // Bildirim anahtarına BAKMIYORUZ — bildirim istemediğin öğün de yenir.
  // Saatler yine hatırlatıcı satırlarından gelir (kullanıcı orada ayarlıyor).
  const mine = new Set(activeMealTypes(settings))
  const meals = mergeReminders(settings?.reminders)
    .filter((r) => mine.has(r.id as MealType))
    .map((r) => {
      const [h, m] = r.time.split(':').map(Number)
      return { meal: r.id as MealType, time: r.time, min: (h || 0) * 60 + (m || 0) }
    })
    .sort((a, b) => a.min - b.min)

  if (meals.length === 0) return null

  // Bugün: saati gelmemiş ve girilmemiş ilk öğün
  let next = meals.find((x) => x.min >= nowMin && !covered.has(x.meal))
  let tomorrow = false
  if (!next) {
    next = meals[0] // bugünküler bitti → yarının ilki
    tomorrow = true
  }

  // Ne kadar kaldı?
  const diff = (tomorrow ? next.min + 1440 : next.min) - nowMin
  const hh = Math.floor(diff / 60)
  const mm = diff % 60
  const left = tomorrow
    ? `yarın ${next.time}`
    : diff <= 0
      ? 'vakti geldi'
      : hh > 0
        ? `${hh} sa ${mm} dk sonra`
        : `${mm} dk sonra`

  const chosen = next.meal
  const planText = settings?.dietPlanMeals?.[chosen]?.trim()
  return (
    <button onClick={() => onPick(chosen)} className="card p-5 w-full text-left active:scale-[0.995] transition">
      {/* Ust satir: etiket + saat. Emoji ogun simgesi olarak kucuk ve yardimci. */}
      <div className="flex items-center justify-between gap-3">
        <span className="section-title">Sıradaki öğün</span>
        <span className="text-[12px] text-slate-500 tabular-nums">
          {next.time}
          {tomorrow ? ' · yarın' : ''}
        </span>
      </div>

      <div className="flex items-center gap-3 mt-2.5">
        <span className="text-[28px] leading-none">{mealEmoji(chosen)}</span>
        <div className="min-w-0">
          <p className="text-[22px] font-bold text-slate-900 leading-tight tracking-tight">{mealLabel(chosen)}</p>
          <p className="text-[13px] text-slate-500 mt-0.5">{left}</p>
        </div>
      </div>

      {/* Diyet listende bu ogunde ne var */}
      {planText ? (
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-[#2f3240]">
          <p className="stat-label mb-1.5">Listende bu öğün</p>
          <p className="text-[15px] text-slate-800 leading-relaxed">{planText}</p>
        </div>
      ) : (
        <p className="mt-4 pt-4 border-t border-slate-100 dark:border-[#2f3240] text-[13px] text-slate-500 leading-relaxed">
          {settings?.dietPlan?.trim()
            ? 'Diyet listen öğünlere bölünüyor; birazdan bu öğünde ne olduğu burada görünecek.'
            : 'Diyet listeni yükle (Menüm) — her öğünde ne yeneceği burada görünsün.'}
        </p>
      )}

      <span className="btn-primary w-full mt-4">Bu öğünü ekle</span>
    </button>
  )
}

// Aksam kontrolu: bugun "sonra karar ver" denmis ogunleri sorar
function PendingCheckIn({ entries }: { entries: DietEntry[] }) {
  const today = todayStr()
  const pending = entries.filter((e) => e.decision === 'none' && e.dateStr === today)
  if (pending.length === 0) return null

  async function decide(id: number, decision: Decision) {
    await dietDb.entries.update(id, { decision })
  }

  return (
    <div className="card p-4 bg-amber-50 border-amber-200 space-y-2.5">
      <p className="font-bold text-amber-800 text-sm">🌙 Akşam kontrolü — bunları yedin mi?</p>
      {pending.map((e) => (
        <div key={e.id} className="bg-white rounded-xl p-2 flex items-center gap-2">
          {e.photo && <img src={e.photo} alt={e.foodName} className="w-11 h-11 rounded-lg object-cover flex-shrink-0" />}
          <p className="text-sm font-semibold text-slate-700 flex-1 min-w-0 truncate">{e.foodName}</p>
          <button
            onClick={() => decide(e.id!, 'resisted')}
            className="text-xs font-bold bg-emerald-600 text-white rounded-lg px-2.5 py-2"
          >
            Yemedim 💪
          </button>
          <button
            onClick={() => decide(e.id!, 'ate')}
            className="text-xs font-bold bg-slate-200 text-slate-700 rounded-lg px-2.5 py-2"
          >
            Yedim
          </button>
        </div>
      ))}
    </div>
  )
}

// Renkli, okunakli sonuc karti — yemegin saglik durumuna gore renklenir
function ResultCard({ analysis }: { analysis: FoodAnalysis }) {
  const t = healthTheme(analysis)
  return (
    <div className="card overflow-hidden border-0 shadow-md">
      {/* Renkli ust bant */}
      <div className={`${t.band} text-white px-4 py-3`}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl font-extrabold leading-tight">{analysis.foodName}</h2>
          <span className="text-3xl">{t.emoji}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {analysis.dietScore > 0 && (
            <span className="text-xs font-bold bg-white/30 rounded-full px-2.5 py-1">⭐ Diyet puanı {analysis.dietScore}/10</span>
          )}
          <span className="text-xs font-bold bg-white/25 rounded-full px-2.5 py-1">🔥 ~{analysis.estimatedCalories} kcal</span>
          {(analysis.protein ?? 0) + (analysis.carb ?? 0) + (analysis.fat ?? 0) > 0 && (
            <span className="text-xs font-bold bg-white/25 rounded-full px-2.5 py-1">
              P {analysis.protein}g · K {analysis.carb}g · Y {analysis.fat}g
            </span>
          )}
          <span className="text-xs font-bold bg-white/25 rounded-full px-2.5 py-1">{t.label}</span>
          <span className="text-xs font-bold bg-white/25 rounded-full px-2.5 py-1">
            {analysis.riskLevel.toUpperCase()} RİSK
          </span>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Diyet listesine uyum (yalnizca liste yuklendiyse, yani >= 0) */}
        {analysis.compliancePercent >= 0 && <ComplianceBar analysis={analysis} />}

        {/* Makroyu listeye yaklastirmak icin somut duzeltme (ekle/azalt/az ye) */}
        {analysis.macroFix?.trim() && (
          <div className="bg-sky-50 rounded-xl p-3 border border-sky-100">
            <p className="text-[13px] font-semibold text-sky-700 mb-1">
              🎯 Listene yaklaştırmak için
            </p>
            <p className="text-sm text-sky-900 leading-snug">{analysis.macroFix}</p>
          </div>
        )}

        {/* Puani neden tam vermedi — nereden kirdi */}
        {analysis.dietScore > 0 && analysis.dietScore < 10 && analysis.scoreReason?.trim() && (
          <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
            <p className="text-[13px] font-semibold text-amber-700 mb-1">
              📉 Puanı neden {analysis.dietScore}/10 verdim
            </p>
            <p className="text-sm text-amber-900 leading-snug">{analysis.scoreReason}</p>
          </div>
        )}

        {/* Ozet karar */}
        <p className={`text-base font-semibold ${t.text} ${t.soft} rounded-xl p-3 leading-snug`}>“{analysis.verdict}”</p>

        {/* Zararlari */}
        {analysis.harms.length > 0 && (
          <div className="bg-rose-50 rounded-xl p-3">
            <p className="text-[13px] font-semibold text-rose-600 mb-1.5">⊘ Zararları</p>
            <ul className="space-y-1.5">
              {analysis.harms.map((h, i) => (
                <li key={i} className="text-sm text-rose-900 flex gap-2 leading-snug">
                  <span className="text-rose-400 mt-0.5">•</span>
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Motive edici sozler */}
        {analysis.motivations.length > 0 && (
          <div className="bg-emerald-50 rounded-xl p-3">
            <p className="text-[13px] font-semibold text-emerald-700 mb-1.5">💚 Sana bir söz</p>
            <ul className="space-y-1.5">
              {analysis.motivations.map((m, i) => (
                <li key={i} className="text-sm text-emerald-900 flex gap-2 leading-snug">
                  <span className="mt-0.5">›</span>
                  <span>{m}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Kontrollu kacamak: cok canı cektiyse makul bir miktar oner */}
        {analysis.cravingPortion?.trim() && (
          <div className="bg-violet-50 rounded-xl p-3 border border-violet-100">
            <p className="text-[13px] font-semibold text-violet-700 mb-1.5">🍫 Çok mu canın çekti?</p>
            <p className="text-sm text-violet-900 leading-snug">
              İllaki yiyeceksen bu kadarı diyetini bozmaz:{' '}
              <span className="font-extrabold">{analysis.cravingPortion}</span>
            </p>
            {analysis.cravingNote && <p className="text-sm text-violet-700 mt-1 leading-snug">{analysis.cravingNote}</p>}
          </div>
        )}

        {/* Daha saglikli alternatif */}
        {analysis.healthierAlternative && (
          <div className="bg-sky-50 rounded-xl p-3">
            <p className="text-[13px] font-semibold text-sky-700 mb-1">🥗 Daha iyisi</p>
            <p className="text-sm text-sky-900 leading-snug">{analysis.healthierAlternative}</p>
          </div>
        )}

        {/* Afiyet olsun / uyari notu */}
        <p className={`text-center text-sm font-semibold ${t.text}`}>
          {analysis.healthy ? 'Afiyet olsun! 🍽️' : 'Karar senin — sen bundan güçlüsün 💪'}
        </p>
      </div>
    </div>
  )
}

// Diyet listesine uyum yuzdesini renkli bir cubukla gosterir
function ComplianceBar({ analysis }: { analysis: FoodAnalysis }) {
  const pct = Math.max(0, Math.min(100, analysis.compliancePercent))
  const color =
    pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500'
  const textColor =
    pct >= 80 ? 'text-emerald-700' : pct >= 50 ? 'text-amber-700' : 'text-rose-700'
  const label = pct >= 80 ? 'Listene uygun 👍' : pct >= 50 ? 'Kısmen uyuyor' : 'Listene aykırı'

  return (
    <div className="bg-slate-50 rounded-xl p-3 space-y-2">
      <div className="flex items-end justify-between">
        <span className="section-title">Diyet listene uyum</span>
        <span className={`text-2xl font-extrabold ${textColor}`}>%{pct}</span>
      </div>
      <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <p className={`text-sm font-semibold ${textColor}`}>{label}</p>
      {analysis.complianceNote && <p className="text-sm text-slate-600">{analysis.complianceNote}</p>}
    </div>
  )
}

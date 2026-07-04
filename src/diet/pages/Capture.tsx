import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { useLiveQuery } from 'dexie-react-hooks'
import DietHeader from '../DietHeader'
import { dietDb, readDietSettings, listExercises, listMeasurements, getWaterMlDay, addWaterMl, listWater, listCheckinsDay, addCheckin, deleteCheckin, addCraving, listShopping } from '../db'
import { analyzeFood, analyzeFoodByText, chatAboutFood, coachChat, cravingHelp, menuChat } from '../ai'
import { computeStats, todayStr, dayAdherence } from '../streak'
import { quoteOfDay } from '../lib/quotes'
import { scheduleSatietyReminder, scheduleSugarReminder } from '../lib/notify'
import { fileToResizedDataUrl, urlToResizedDataUrl } from '../../lib/image'
import { MEAL_OPTIONS, guessMeal, mealLabel } from '../lib/meals'
import { isBeverage } from '../lib/food'
import { buildHealthContext } from '../lib/context'
import { fetchMenuContent } from '../lib/webmenu'
import { nativeScan } from '../lib/barcode'
import type { Decision, DietEntry, FoodAnalysis, MealType, Measurement, Exercise, DietSettings, CheckIn } from '../types'

type Phase = 'idle' | 'analyzing' | 'result' | 'saved'

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
      band: 'from-emerald-500 to-emerald-600',
      soft: 'bg-emerald-50',
      text: 'text-emerald-700',
      chip: 'bg-emerald-100 text-emerald-800',
      emoji: '✅',
      label: 'Sağlıklı seçim'
    }
  }
  if (a.riskLevel === 'orta') {
    return {
      band: 'from-amber-400 to-amber-500',
      soft: 'bg-amber-50',
      text: 'text-amber-700',
      chip: 'bg-amber-100 text-amber-800',
      emoji: '⚠️',
      label: 'Dikkatli ol'
    }
  }
  return {
    band: 'from-rose-500 to-rose-600',
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
  const [note, setNote] = useState('') // kullanici duzeltmesi
  const [editing, setEditing] = useState(false) // duzeltme kutusu acik mi
  const [textMode, setTextMode] = useState(false) // fotografsiz, yazarak ekleme
  const [textNote, setTextNote] = useState('') // yazarak ekleme metni
  const [chat, setChat] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]) // ogun sohbeti
  const [chatInput, setChatInput] = useState('')
  const [chatBusy, setChatBusy] = useState(false)
  const [customWhen, setCustomWhen] = useState(false) // gecmis tarih/saate kaydet
  const [whenStr, setWhenStr] = useState('') // datetime-local degeri (gecmis ogun)

  const hasKey = !!settings?.apiKey

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
          resultType: CameraResultType.DataUrl,
          source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos
        })
        if (!photo.dataUrl) return
        setNote('')
        setEditing(false)
        setMealType(guessMeal())
        setPhoto(photo.dataUrl)
        await analyze(photo.dataUrl, '')
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
    setMealType(guessMeal()) // saate gore varsayilan ogun
    try {
      const dataUrl = await fileToResizedDataUrl(file, 800, 0.8)
      setPhoto(dataUrl)
      await analyze(dataUrl, '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fotoğraf okunamadı.')
      setPhase('idle')
    }
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
    setMealType(guessMeal())
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

  // Kullanici "yanlis tanidi" deyip aciklama yazinca SADECE METINDEN incele
  // (fotograf tekrar gonderilmez -> cok daha az token harcar)
  async function reanalyze() {
    if (!note.trim()) return
    setEditing(false)
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
      createdAt,
      dateStr
    })
    setSavedDecision(decision)
    setPhase('saved')
    // Yedi ise ~30 dk sonra tokluk hatirlatmasi (APK'da bildirim).
    // Gecmise islenen ogunde hatirlatma anlamsiz — yalnizca "su an" kayitlarda.
    // Iceceklerde "doydun mu?" anlamsiz — tokluk hatirlatmasini atla.
    if (decision === 'ate' && Date.now() - createdAt < 60_000) {
      if (!isBeverage(analysis.foodName)) void scheduleSatietyReminder(30)
      // Ogunden 2 saat sonra tok seker olcum hatirlatmasi (acikse; icecekler de sekeri etkiler)
      if (settings?.sugarPostMealReminderEnabled) void scheduleSugarReminder(120)
    }
  }

  function reset() {
    setPhase('idle')
    setPhoto('')
    setAnalysis(null)
    setSavedDecision('none')
    setError('')
    setNote('')
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

      <div className="p-3 space-y-4">
        {/* Seri kartim */}
        <div className="card p-4 bg-gradient-to-br from-emerald-500 to-emerald-700 text-white border-0">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-emerald-50 text-xs uppercase tracking-wide">Diyet serin</p>
              <p className="text-4xl font-extrabold mt-1">
                {stats.streak} <span className="text-lg font-semibold">gün</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-emerald-50 text-xs uppercase tracking-wide">Puan</p>
              <p className="text-2xl font-extrabold mt-1">⭐ {stats.points}</p>
            </div>
          </div>
          <p className="text-emerald-50 text-sm mt-1">
            {stats.streak === 0
              ? 'Bugün temiz bir başlangıç yap! 💪'
              : `${stats.streak} gündür diyetini bozmadın. Devam! 🔥`}
          </p>
        </div>

        {/* Kilo hedefi & gidisat (motivasyon) */}
        <WeightGoal measurements={measurements ?? []} target={settings?.targetWeight} start={settings?.startWeight} height={settings?.heightCm} />

        {/* Bugunku diyet basari yuzdesi */}
        <DailyScore entries={entries ?? []} />

        {/* Kriz ani: canim cekiyor! */}
        <CrisisSOS entries={entries ?? []} exercises={exercises ?? []} settings={settings} />

        {/* Gunluk motivasyon sozu */}
        <div className="card p-3 bg-amber-50 border-amber-100 text-amber-900 text-sm font-medium text-center">
          “{quoteOfDay(todayStr())}”
        </div>

        {/* Bugunku kalori takibi */}
        <CalorieCard entries={entries ?? []} goal={settings?.calorieGoal} />

        {/* Bugun yapilan spor + yaklasik yakilan kalori */}
        <ExerciseToday exercises={exercises ?? []} measurements={measurements ?? []} />

        {/* Su takibi (ml) */}
        <WaterCard goalMl={settings?.waterGoal ? settings.waterGoal * 200 : 2500} />

        {/* Bugun nasilsin? (moral/his) */}
        <MoodCheckIn />

        {/* TEK yapay zeka sohbeti: menu, yarin plani, Z raporu, gun analizi */}
        <CoachChat entries={entries ?? []} exercises={exercises ?? []} settings={settings} />

        {/* Disarida/restoranda: menu fotograflarini yukle, uygununu bul */}
        <RestaurantMenu settings={settings} />

        {/* Yarim saat gecmis, henuz tokluk puani verilmemis ogunler */}
        <SatietyPrompt entries={entries ?? []} />

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

        {/* Bos durum: cek butonu */}
        {phase === 'idle' && (
          <div className="card p-6 text-center space-y-4">
            <div className="text-6xl">📸</div>
            <p className="text-slate-600 text-sm">
              Yemeğini yemeden önce fotoğrafını çek. Yapay zeka onu tanıyıp diyetin için doğru kararı vermene
              yardım etsin.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => pickPhoto('camera')} disabled={!hasKey} className="btn-primary">
                📷 Fotoğraf Çek
              </button>
              <button
                onClick={() => pickPhoto('gallery')}
                disabled={!hasKey}
                className="btn bg-slate-200 text-slate-700 hover:bg-slate-300"
              >
                🖼️ Galeriden Seç
              </button>
            </div>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPick} />
            <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
            <Link to="/barkod" className="btn-ghost w-full block">
              🏷️ Barkod ile Ekle
            </Link>

            {/* Fotografsiz: yazarak ekle */}
            {!textMode ? (
              <button onClick={() => setTextMode(true)} disabled={!hasKey} className="btn-ghost w-full">
                ✍️ Yazarak Ekle (fotoğrafsız)
              </button>
            ) : (
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
              Barkod: paketli ürün (token gerekmez). Yazarak ekle: fotoğraf çekmeden, yazdığına göre değerlendirir.
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
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Bu yemek ne? Ne kadar?</p>
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
                  Çorba kaşığı, su bardağı, porsiyon, dilim, avuç gibi yazabilirsin — hesaplar. Fotoğraf kayıtta kalır.
                </p>
              </div>
            )}

            {/* Hangi ogun? — saate gore varsayilan secili gelir */}
            <div className="card p-3 space-y-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Hangi öğün?</p>
              <div className="flex flex-wrap gap-1.5">
                {MEAL_OPTIONS.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setMealType(m.value)}
                    className={`text-sm font-semibold rounded-full px-3 py-1.5 ${
                      mealType === m.value ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {m.emoji} {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Ne zaman yedim? — varsayilan "şimdi"; gecmis ogunu de girebilirsin */}
            <div className="card p-3 space-y-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">⏰ Ne zaman?</p>
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
                    Dün unuttuğun öğünü doğru tarih ve saate kaydedebilirsin.
                  </p>
                </div>
              )}
            </div>

            {/* Bu ogun hakkinda sohbet/soru (sadece metin -> az token) */}
            <div className="card p-3 space-y-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">💬 Öğün hakkında</p>
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
      <div className="flex items-center justify-between">
        <span className="section-title">🎯 Kilo hedefin</span>
        <div className="flex items-center gap-2">
          {bmi != null && <span className={`chip ${bmiCls}`}>BMI {bmi} · {bmiCat}</span>}
          <span className="text-xs font-semibold text-slate-500">{base} → {target} kg</span>
        </div>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <p className="text-3xl font-extrabold text-slate-800">{current}<span className="text-base font-bold text-slate-400"> kg</span></p>
          <p className="text-xs text-slate-500 mt-0.5">
            {lost > 0 ? `Başlangıçtan beri ${lost} kg verdin 🎉` : lost < 0 ? `Başlangıca göre ${Math.abs(lost)} kg arttı` : 'Henüz değişim yok'}
          </p>
        </div>
        <div className="text-right">
          {reached ? (
            <span className="chip bg-brand-100 text-brand-800">Hedefe ulaştın! 🏆</span>
          ) : (
            <>
              <p className="text-2xl font-extrabold text-brand-600">{remaining} kg</p>
              <p className="text-xs text-slate-500">hedefe kaldı</p>
            </>
          )}
        </div>
      </div>

      <div>
        <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-brand-500 to-brand-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-[11px] text-slate-400 mt-1 text-right">%{pct} tamamlandı</p>
      </div>
    </div>
  )
}

// Bugunku diyet basari yuzdesi: o gunku kararlarin ortalamasi (renkli, mesajli)
function DailyScore({ entries }: { entries: DietEntry[] }) {
  const pct = dayAdherence(entries, todayStr())
  if (pct == null) return null // bugun karar verilmis kayit yoksa gosterme

  const theme =
    pct >= 80
      ? { bar: 'bg-emerald-500', text: 'text-emerald-700', soft: 'bg-emerald-50 border-emerald-100', msg: 'Harika gidiyorsun! 🌟' }
      : pct >= 50
        ? { bar: 'bg-amber-500', text: 'text-amber-700', soft: 'bg-amber-50 border-amber-100', msg: 'Fena değil, biraz daha dikkat. 💪' }
        : { bar: 'bg-rose-500', text: 'text-rose-700', soft: 'bg-rose-50 border-rose-100', msg: 'Bugün zor geçti, yarın telafi. 🌅' }

  return (
    <div className={`card p-4 border ${theme.soft}`}>
      <div className="flex items-end justify-between">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Bugünkü diyet başarın</span>
        <span className={`text-3xl font-extrabold ${theme.text}`}>%{pct}</span>
      </div>
      <div className="h-2.5 w-full bg-white rounded-full overflow-hidden mt-2 border border-slate-100">
        <div className={`h-full ${theme.bar} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <p className={`text-sm font-semibold mt-2 ${theme.text}`}>{theme.msg}</p>
    </div>
  )
}

// Bugun YENEN ogunlerin kalori HALKASI + makro (protein/karb/yag) dagilimi.
function CalorieCard({ entries, goal }: { entries: DietEntry[]; goal?: number }) {
  const today = todayStr()
  const todays = entries.filter((e) => e.dateStr === today && e.decision === 'ate')
  const kcal = todays.reduce((s, e) => s + (e.estimatedCalories || 0), 0)
  const protein = todays.reduce((s, e) => s + (e.protein || 0), 0)
  const carb = todays.reduce((s, e) => s + (e.carb || 0), 0)
  const fat = todays.reduce((s, e) => s + (e.fat || 0), 0)

  const target = goal && goal > 0 ? goal : 0
  const frac = target ? Math.min(1, kcal / target) : 0
  const over = target > 0 && kcal > target
  const ringColor = over ? '#e11d48' : frac >= 0.8 ? '#f59e0b' : '#059669'

  // Halka (SVG)
  const R = 50
  const C = 2 * Math.PI * R
  const dash = target ? C * frac : 0

  // Makro kalori paylari (P/C 4 kcal, F 9 kcal) -> cubuk orani
  const macroKcal = protein * 4 + carb * 4 + fat * 9
  const share = (g: number, perG: number) => (macroKcal > 0 ? Math.round(((g * perG) / macroKcal) * 100) : 0)

  return (
    <div className="card p-4">
      <div className="flex items-center gap-4">
        {/* Kalori halkasi */}
        <div className="relative flex-shrink-0" style={{ width: 120, height: 120 }}>
          <svg width="120" height="120" className="-rotate-90">
            <circle cx="60" cy="60" r={R} fill="none" strokeWidth="12" className="stroke-slate-100 dark:stroke-[#273248]" />
            {target > 0 && (
              <circle
                cx="60"
                cy="60"
                r={R}
                fill="none"
                stroke={ringColor}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${dash} ${C}`}
              />
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-[28px] leading-none font-extrabold ${over ? 'text-rose-600' : 'text-slate-800'}`}>{kcal}</span>
            <span className="text-[11px] text-slate-400 mt-1">{target > 0 ? `/ ${target} kcal` : 'kcal bugün'}</span>
          </div>
        </div>

        {/* Makrolar */}
        <div className="flex-1 min-w-0 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="section-title">🍽️ Bugün</span>
            {target > 0 && (
              <span className={`text-xs font-semibold ${over ? 'text-rose-600' : 'text-emerald-700'}`}>
                {over ? `+${kcal - target} kcal` : `${target - kcal} kcal kaldı`}
              </span>
            )}
          </div>
          <MacroBar label="Protein" grams={protein} pct={share(protein, 4)} color="bg-rose-500" />
          <MacroBar label="Karbonhidrat" grams={carb} pct={share(carb, 4)} color="bg-sky-500" />
          <MacroBar label="Yağ" grams={fat} pct={share(fat, 9)} color="bg-amber-500" />
          {kcal > 0 && macroKcal < kcal * 0.5 && (
            <p className="text-[11px] text-slate-400 leading-tight">
              Bazı öğünler makro bilgisi olmadan eklenmiş; yeni eklediklerinde dolacak.
            </p>
          )}
        </div>
      </div>
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
        className="w-full rounded-2xl bg-gradient-to-r from-rose-500 to-orange-500 text-white font-extrabold text-lg py-3.5 shadow-md active:scale-[0.98] transition"
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
  const [note, setNote] = useState('')
  const [flash, setFlash] = useState('')

  async function save() {
    if (mood == null) return
    await addCheckin(mood, note.trim() || undefined)
    setMood(null)
    setNote('')
    setFlash('Kaydedildi 👍 Gün içinde istediğin kadar ekleyebilirsin.')
    setTimeout(() => setFlash(''), 3000)
  }

  return (
    <div className="card p-4 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="section-title">{moodEmoji(list[list.length - 1]?.mood)} Şu an nasılsın?</span>
        {list.length > 0 && <span className="text-xs font-semibold text-slate-500">{list.length} kayıt bugün</span>}
      </div>

      {/* Bugunun his zaman cizelgesi */}
      {list.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {list.map((c) => (
            <span key={c.id} className="chip bg-violet-50 text-violet-800 border border-violet-100">
              {new Date(c.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}{' '}
              {moodEmoji(c.mood)} {c.mood ?? ''}
              <button onClick={() => void deleteCheckin(c.id!)} className="ml-0.5 text-violet-300">
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            onClick={() => setMood(n)}
            className={`w-7 h-7 rounded-full text-xs font-bold ${
              mood === n ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-slate-400">1: kötü · 10: harika — yemekten önce/sonra, ne zaman istersen işaretle.</p>

      {mood != null && (
        <div className="space-y-1.5">
          <textarea
            className="field-input min-h-[48px]"
            placeholder="İstersen bir not ekle: örn. öğle yemeğinden sonra enerjim yerinde"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button onClick={save} className="btn-primary w-full py-2">
            {moodEmoji(mood)} {mood}/10 olarak kaydet
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

// Bugun yapilan egzersizler + kiloya gore YAKLASIK yakilan kalori (token yok).
// Tahmin: kcal ≈ MET(5, orta tempo) × kilo(kg) × süre(saat).
function ExerciseToday({ exercises, measurements }: { exercises: Exercise[]; measurements: Measurement[] }) {
  const today = todayStr()
  const todays = exercises.filter((e) => e.dateStr === today)
  if (todays.length === 0) return null

  const weights = measurements.filter((m) => typeof m.weight === 'number').sort((a, b) => a.createdAt - b.createdAt)
  const weight = weights.length ? (weights[weights.length - 1].weight as number) : 75
  const MET = 5
  const totalMin = todays.reduce((s, e) => s + (e.minutes ?? 0), 0)
  // Once yapay zeka tahmini (e.kcal), yoksa kabaca MET x kilo x sure
  const kcal = Math.round(
    todays.reduce((s, e) => s + (e.kcal != null ? e.kcal : e.minutes ? MET * weight * (e.minutes / 60) : 0), 0)
  )

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <span className="section-title">🏃 Bugün spor</span>
        {kcal > 0 && <span className="chip bg-indigo-100 text-indigo-800">≈ {kcal} kcal yaktın</span>}
      </div>
      <div className="mt-2.5 space-y-1.5">
        {todays.map((e) => (
          <div key={e.id} className="flex items-center gap-2 text-sm">
            <span className="text-lg flex-shrink-0">💪</span>
            <span className="flex-1 min-w-0 text-slate-700 break-words">{e.text}</span>
            {e.minutes ? <span className="text-xs text-slate-400 flex-shrink-0">{e.minutes} dk</span> : null}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mt-2.5">
        <p className="text-[11px] text-slate-400">
          {totalMin > 0 ? `Toplam ${totalMin} dk · ` : ''}yakılan kalori yaklaşıktır (kilona göre).
        </p>
        <Link to="/egzersiz" className="text-xs text-brand-700 underline flex-shrink-0">
          Egzersiz →
        </Link>
      </div>
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
    const mt = e.mealType ? mealLabel(e.mealType) + ' ' : ''
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
      setChat([...history, { role: 'assistant', text: answer }])
    } catch (err) {
      setChat([...history, { role: 'assistant', text: err instanceof Error ? err.message : 'Cevap alınamadı.' }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="section-title">💬 Koçuna Sor</p>
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
              Menünü, yarının planını, Z raporunu, günün analizini — ne istersen yaz. Koç tüm verilerini bilerek cevaplar.
            </p>
          )}
        </>
      )}
    </div>
  )
}

// DISARIDA/RESTORAN: menu fotograf(lar)ini yukle, yapay zeka diyetine en
// uygun secenekleri cikarsin; menu olmadan da sohbet edilebilir.
function RestaurantMenu({ settings }: { settings?: DietSettings }) {
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
        <p className="section-title">🍽️ Dışarıda / Restoran</p>
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
              Birden fazla menü sayfası ekleyebilirsin. Koç, diyet listeni ve sağlık verilerini bilerek en uygun seçeneği önerir.
            </p>
          )}
        </>
      )}
    </div>
  )
}

// Tek makro satiri: ad, gram ve kalori payi cubugu
function MacroBar({ label, grams, pct, color }: { label: string; grams: number; pct: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-0.5">
        <span className="text-slate-500">{label}</span>
        <span className="font-bold text-slate-700">{grams} g</span>
      </div>
      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// Yarim saat gecmis ama tokluk puani verilmemis "yedim" ogunleri sorar
function SatietyPrompt({ entries }: { entries: DietEntry[] }) {
  const now = Date.now()
  const pending = entries
    .filter(
      (e) =>
        e.decision === 'ate' &&
        e.satiety == null &&
        !isBeverage(e.foodName) &&
        now - e.createdAt >= 30 * 60_000 &&
        now - e.createdAt < 2 * 86_400_000
    )
    .sort((a, b) => b.createdAt - a.createdAt)
  if (pending.length === 0) return null

  async function set(id: number, v: number) {
    await dietDb.entries.update(id, { satiety: v })
  }

  return (
    <div className="card p-4 bg-sky-50 border-sky-200 space-y-2.5">
      <p className="font-bold text-sky-800 text-sm">🍽️ Doydun mu? — son öğünlerinin tokluğunu puanla</p>
      {pending.map((e) => (
        <div key={e.id} className="bg-white rounded-xl p-2 space-y-1.5">
          <div className="flex items-center gap-2">
            {e.photo && <img src={e.photo} alt={e.foodName} className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />}
            <p className="text-sm font-semibold text-slate-700 flex-1 min-w-0 truncate">{e.foodName}</p>
          </div>
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => set(e.id!, n)}
                className="w-7 h-7 rounded-full text-xs font-bold bg-slate-100 text-slate-600 active:bg-sky-600 active:text-white"
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      ))}
      <p className="text-[11px] text-sky-700/70">1: hâlâ açım · 10: fazlasıyla tok</p>
    </div>
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
      <div className={`bg-gradient-to-br ${t.band} text-white px-4 py-3`}>
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

        {/* Puani neden tam vermedi — nereden kirdi */}
        {analysis.dietScore > 0 && analysis.dietScore < 10 && analysis.scoreReason?.trim() && (
          <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-1">
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
            <p className="text-xs font-bold text-rose-600 uppercase tracking-wide mb-1.5">⊘ Zararları</p>
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
            <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-1.5">💚 Sana bir söz</p>
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
            <p className="text-xs font-bold text-violet-700 uppercase tracking-wide mb-1.5">🍫 Çok mu canın çekti?</p>
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
            <p className="text-xs font-bold text-sky-700 uppercase tracking-wide mb-1">🥗 Daha iyisi</p>
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
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Diyet listene uyum</span>
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

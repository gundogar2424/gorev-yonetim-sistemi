import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { useLiveQuery } from 'dexie-react-hooks'
import DietHeader from '../DietHeader'
import { dietDb, readDietSettings, listExercises, listMeasurements, getWaterMlDay, addWaterMl, getCheckinDay, saveCheckinDay } from '../db'
import { analyzeFood, analyzeFoodByText, chatAboutFood, chatAboutDay } from '../ai'
import { computeStats, todayStr, dayAdherence } from '../streak'
import { quoteOfDay } from '../lib/quotes'
import MenuAsk from '../components/MenuAsk'
import { scheduleSatietyReminder } from '../lib/notify'
import { fileToResizedDataUrl } from '../../lib/image'
import { MEAL_OPTIONS, guessMeal, mealLabel } from '../lib/meals'
import type { Decision, DietEntry, FoodAnalysis, MealType, Measurement, Exercise, DietSettings } from '../types'

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
        note: noteArg || undefined,
        body: bodyContext(settings, measurements)
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
        body: bodyContext(settings, measurements)
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
        body: bodyContext(settings, measurements)
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
    if (decision === 'ate' && Date.now() - createdAt < 60_000) void scheduleSatietyReminder(30)
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
        dietPlan: settings?.dietPlan
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

        {/* Menune sor (oglen ne var? siradaki ogun?) */}
        <MenuAsk />

        {/* Yarim saat gecmis, henuz tokluk puani verilmemis ogunler */}
        <SatietyPrompt entries={entries ?? []} />

        {/* Aksam kontrolu: bugun karar verilmemis ogunler */}
        <PendingCheckIn entries={entries ?? []} />

        {/* Gun sonu degerlendirme sohbeti (Z raporu) */}
        <DayReview entries={entries ?? []} exercises={exercises ?? []} measurements={measurements ?? []} settings={settings} />

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
            <circle cx="60" cy="60" r={R} fill="none" stroke="#f1f5f9" strokeWidth="12" />
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
            <span className={`text-2xl font-extrabold ${over ? 'text-rose-600' : 'text-slate-800'}`}>{kcal}</span>
            <span className="text-[11px] text-slate-400">{target > 0 ? `/ ${target} kcal` : 'kcal bugün'}</span>
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

// Gun ici "nasilsin?" — genel moral/his 1-10 + kisa not (gunluk). AI dikkate alir.
function MoodCheckIn() {
  const today = todayStr()
  const c = useLiveQuery(() => getCheckinDay(today), [today], undefined)
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState('')

  const mood = c?.mood
  const emoji = mood == null ? '💬' : mood >= 8 ? '😄' : mood >= 6 ? '🙂' : mood >= 4 ? '😐' : '😔'

  return (
    <div className="card p-4 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="section-title">{emoji} Bugün nasılsın?</span>
        {mood != null && <span className="text-xs font-semibold text-slate-500">moral {mood}/10</span>}
      </div>
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            onClick={() => void saveCheckinDay(today, { mood: n })}
            className={`w-7 h-7 rounded-full text-xs font-bold ${
              mood === n ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-slate-400">1: kötü hissediyorum · 10: harika</p>

      {c?.note && !noteOpen && (
        <p className="text-sm text-slate-700 bg-slate-50 rounded-xl p-2.5">“{c.note}”</p>
      )}
      {!noteOpen ? (
        <button
          onClick={() => {
            setNote(c?.note ?? '')
            setNoteOpen(true)
          }}
          className="text-xs text-violet-700 underline"
        >
          {c?.note ? '✏️ Notu düzenle' : '+ Nasıl hissettiğini yaz (isteğe bağlı)'}
        </button>
      ) : (
        <div className="space-y-1.5">
          <textarea
            className="field-input min-h-[56px]"
            autoFocus
            placeholder="örn. Enerjim iyi ama akşama doğru tatlı krizi geldi"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setNoteOpen(false)} className="btn bg-slate-200 text-slate-700 py-2">
              Vazgeç
            </button>
            <button
              onClick={async () => {
                await saveCheckinDay(today, { note: note.trim() })
                setNoteOpen(false)
              }}
              className="btn-primary py-2"
            >
              Kaydet
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Gunluk su takibi (ml). Pratik +ml butonlari; hedef cubugu.
function WaterCard({ goalMl }: { goalMl: number }) {
  const today = todayStr()
  const ml = useLiveQuery(() => getWaterMlDay(today), [today], 0) ?? 0
  const pct = goalMl > 0 ? Math.min(100, Math.round((ml / goalMl) * 100)) : 0
  const reached = ml >= goalMl
  const add = (d: number) => void addWaterMl(today, d)

  return (
    <div className="card p-4 bg-sky-50 border-sky-100">
      <div className="flex items-end justify-between">
        <div>
          <span className="section-title text-sky-700">💧 Su</span>
          <p className="text-3xl font-extrabold text-sky-700 mt-0.5">
            {ml}
            <span className="text-base font-bold text-sky-400"> ml</span>
            <span className="text-sm font-semibold text-slate-400"> / {goalMl}</span>
          </p>
        </div>
        {ml > 0 && (
          <button onClick={() => add(-200)} className="text-xs text-slate-400 underline pb-1">
            geri al
          </button>
        )}
      </div>
      <div className="h-2.5 w-full bg-sky-100 rounded-full overflow-hidden mt-2">
        <div className={`h-full rounded-full transition-all ${reached ? 'bg-emerald-500' : 'bg-sky-500'}`} style={{ width: `${pct}%` }} />
      </div>
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
      {reached && <p className="text-xs font-semibold text-emerald-700 mt-2">Günlük su hedefine ulaştın! 💧🎉</p>}
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
function buildDaySummary(entries: DietEntry[], exercises: Exercise[], today: string, waterMl = 0, mood?: number, moodNote?: string): string {
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
  if (mood != null || moodNote) {
    lines.push(`Kişinin bugünkü hâli: ${mood != null ? `moral ${mood}/10` : ''}${moodNote ? `${mood != null ? ' — ' : ''}"${moodNote}"` : ''}.`)
  }
  return lines.join('\n')
}

// Gun sonu "Z raporu" + sohbet: bugun nasil gecti, niye boyle oldu diye konusulur
function DayReview({
  entries,
  exercises,
  measurements,
  settings
}: {
  entries: DietEntry[]
  exercises: Exercise[]
  measurements: Measurement[]
  settings?: DietSettings
}) {
  const today = todayStr()
  const hasActivity =
    entries.some((e) => e.dateStr === today) || exercises.some((e) => e.dateStr === today)
  const [chat, setChat] = useState<{ role: 'user' | 'assistant'; text: string }[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const waterMl = useLiveQuery(() => getWaterMlDay(today), [today], 0) ?? 0
  const checkin = useLiveQuery(() => getCheckinDay(today), [today], undefined)

  if (!hasActivity) return null // bugun hic kayit yoksa gosterme
  void measurements // (ileride kullanilabilir)

  const hasKey = !!settings?.apiKey

  async function ask(question?: string) {
    const q = (question ?? input).trim()
    if (!q || !hasKey) return
    const history = [...chat, { role: 'user' as const, text: q }]
    setChat(history)
    setInput('')
    setBusy(true)
    try {
      const answer = await chatAboutDay({
        apiKey: settings!.apiKey!,
        daySummary: buildDaySummary(entries, exercises, today, waterMl, checkin?.mood, checkin?.note),
        history,
        model: settings?.model,
        userName: settings?.userName,
        goal: settings?.goal,
        dietPlan: settings?.dietPlan
      })
      setChat([...history, { role: 'assistant', text: answer }])
    } catch (err) {
      setChat([...history, { role: 'assistant', text: err instanceof Error ? err.message : 'Cevap alınamadı.' }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card p-3 space-y-2 bg-indigo-50 border-indigo-100">
      <p className="text-xs font-bold text-indigo-700 uppercase tracking-wide">🌙 Günü değerlendir</p>
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
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {chat.map((m, i) => (
                <div
                  key={i}
                  className={`text-sm rounded-xl px-3 py-2 ${
                    m.role === 'user' ? 'bg-indigo-600 text-white ml-8' : 'bg-white text-slate-800 mr-8'
                  }`}
                >
                  {m.text}
                </div>
              ))}
              {busy && <p className="text-xs text-slate-400 mr-8">yazıyor…</p>}
            </div>
          )}
          {chat.length === 0 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => ask('Bugün nasıl geçti? Kısaca değerlendir.')}
                disabled={busy}
                className="text-xs font-semibold rounded-full px-3 py-1.5 bg-indigo-600 text-white"
              >
                Bugün nasıl geçti?
              </button>
              <button
                onClick={() => ask('Yarın için bana somut bir öneri ver.')}
                disabled={busy}
                className="text-xs font-semibold rounded-full px-3 py-1.5 bg-white text-indigo-700 border border-indigo-200"
              >
                Yarın ne yapayım?
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <input
              className="field-input flex-1"
              placeholder="örn. Bugün niye çok acıktım?"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && ask()}
            />
            <button onClick={() => ask()} disabled={busy || !input.trim()} className="btn bg-indigo-600 text-white px-4">
              Sor
            </button>
          </div>
          <p className="text-[11px] text-indigo-700/70">Bugünkü öğün ve sporlarına bakarak konuşur (küçük token).</p>
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

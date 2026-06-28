import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import DietHeader from '../DietHeader'
import { dietDb, readDietSettings, listExercises } from '../db'
import { analyzeFood } from '../ai'
import { computeStats, todayStr, dayAdherence } from '../streak'
import { quoteOfDay } from '../lib/quotes'
import { fileToResizedDataUrl } from '../../lib/image'
import { MEAL_OPTIONS, guessMeal } from '../lib/meals'
import type { Decision, DietEntry, FoodAnalysis, MealType } from '../types'

type Phase = 'idle' | 'analyzing' | 'result' | 'saved'

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

export default function Capture() {
  const settings = useLiveQuery(() => readDietSettings(), [], undefined)
  const entries = useLiveQuery(() => dietDb.entries.toArray(), [], [])
  const exercises = useLiveQuery(() => listExercises(), [], [])
  const stats = computeStats(entries ?? [], exercises ?? [])

  const fileRef = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [photo, setPhoto] = useState<string>('')
  const [analysis, setAnalysis] = useState<FoodAnalysis | null>(null)
  const [error, setError] = useState('')
  const [savedDecision, setSavedDecision] = useState<Decision>('none')
  const [mealType, setMealType] = useState<MealType>(guessMeal())
  const [note, setNote] = useState('') // kullanici duzeltmesi
  const [editing, setEditing] = useState(false) // duzeltme kutusu acik mi

  const hasKey = !!settings?.apiKey

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (fileRef.current) fileRef.current.value = ''
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
        note: noteArg || undefined
      })
      setAnalysis(result)
      setPhase('result')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu.')
      setPhase('idle')
    }
  }

  // Kullanici "yanlis tanidi" deyip aciklama yazinca ayni fotografi tekrar incele
  async function reanalyze() {
    if (!photo || !note.trim()) return
    setEditing(false)
    await analyze(photo, note)
  }

  async function decide(decision: Decision) {
    if (!analysis) return
    await dietDb.entries.add({
      ...analysis,
      photo,
      decision,
      mealType,
      createdAt: Date.now(),
      dateStr: todayStr()
    })
    setSavedDecision(decision)
    setPhase('saved')
  }

  function reset() {
    setPhase('idle')
    setPhoto('')
    setAnalysis(null)
    setSavedDecision('none')
    setError('')
    setNote('')
    setEditing(false)
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

        {/* Bugunku diyet basari yuzdesi */}
        <DailyScore entries={entries ?? []} />

        {/* Gunluk motivasyon sozu */}
        <div className="card p-3 bg-amber-50 border-amber-100 text-amber-900 text-sm font-medium text-center">
          “{quoteOfDay(todayStr())}”
        </div>

        {/* Bugunku kalori takibi */}
        <CalorieCard entries={entries ?? []} goal={settings?.calorieGoal} />

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
            <button onClick={() => fileRef.current?.click()} disabled={!hasKey} className="btn-primary w-full">
              📷 Fotoğraf Çek / Galeriden Seç
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
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
                ✏️ Yanlış mı tanıdı? Ne olduğunu yaz, düzelteyim
              </button>
            ) : (
              <div className="card p-3 space-y-2 border-emerald-200">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Bu yemek aslında ne? Ne kadar?</p>
                <textarea
                  className="field-input min-h-[64px]"
                  autoFocus
                  placeholder="örn. Bamya yemeği, 1 porsiyon (~250 g), zeytinyağlı + 1 dilim esmer ekmek"
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
                <p className="text-[11px] text-slate-400">Yazdığını esas alır; fotoğrafla çelişse bile seni dinler.</p>
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

            {/* Karar butonlari */}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => decide('resisted')} className="btn-primary py-3">
                💪 Vazgeçtim
              </button>
              <button
                onClick={() => decide('ate')}
                className="btn py-3 bg-slate-200 text-slate-700 hover:bg-slate-300"
              >
                😋 Yine de yedim
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

// Bugun YENEN ogunlerin toplam tahmini kalorisi; hedef girildiyse ona gore renk
function CalorieCard({ entries, goal }: { entries: DietEntry[]; goal?: number }) {
  const today = todayStr()
  const kcal = entries
    .filter((e) => e.dateStr === today && e.decision === 'ate')
    .reduce((s, e) => s + (e.estimatedCalories || 0), 0)
  const target = goal && goal > 0 ? goal : 0
  const pct = target ? Math.min(100, Math.round((kcal / target) * 100)) : 0
  const over = target > 0 && kcal > target
  const barColor = !target ? 'bg-slate-300' : over ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'

  return (
    <div className="card p-3 bg-orange-50 border-orange-100 flex flex-col">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-orange-700 uppercase tracking-wide">🔥 Kalori</span>
        {target > 0 && <span className="text-xs text-orange-600">/{target}</span>}
      </div>
      <p className={`text-3xl font-extrabold mt-1 ${over ? 'text-rose-600' : 'text-orange-700'}`}>{kcal}</p>
      {target > 0 ? (
        <>
          <div className="h-2 w-full bg-orange-100 rounded-full overflow-hidden mt-1">
            <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
          </div>
          <p className={`text-xs font-semibold mt-2 ${over ? 'text-rose-600' : 'text-orange-700'}`}>
            {over ? `Hedefi ${kcal - target} kcal aştın` : `${target - kcal} kcal kaldı`}
          </p>
        </>
      ) : (
        <p className="text-xs text-orange-600/80 mt-auto pt-2">
          Bugün alınan kalori. Hedef için Ayarlar.
        </p>
      )}
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
          <span className="text-xs font-bold bg-white/25 rounded-full px-2.5 py-1">🔥 ~{analysis.estimatedCalories} kcal</span>
          <span className="text-xs font-bold bg-white/25 rounded-full px-2.5 py-1">{t.label}</span>
          <span className="text-xs font-bold bg-white/25 rounded-full px-2.5 py-1">
            {analysis.riskLevel.toUpperCase()} RİSK
          </span>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Diyet listesine uyum (yalnizca liste yuklendiyse, yani >= 0) */}
        {analysis.compliancePercent >= 0 && <ComplianceBar analysis={analysis} />}

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

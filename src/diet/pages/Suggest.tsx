import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import DietHeader from '../DietHeader'
import { dietDb, readDietSettings } from '../db'
import { buildHealthContext } from '../lib/context'
import { suggestMeal } from '../ai'
import { fileToResizedDataUrl } from '../../lib/image'
import { guessMeal, mealLabel, MEAL_OPTIONS } from '../lib/meals'
import { todayStr } from '../streak'
import type { MealAdvice, MealSuggestion, MealType } from '../types'

type Phase = 'idle' | 'thinking' | 'result'

export default function Suggest() {
  const settings = useLiveQuery(() => readDietSettings(), [], undefined)
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [photo, setPhoto] = useState('')
  const [advice, setAdvice] = useState<MealAdvice | null>(null)
  const [error, setError] = useState('')

  const hasKey = !!settings?.apiKey

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    setAdvice(null)
    try {
      const dataUrl = await fileToResizedDataUrl(file, 900, 0.8)
      setPhoto(dataUrl)
      setPhase('thinking')
      const res = await suggestMeal({
        apiKey: settings!.apiKey!,
        photoDataUrl: dataUrl,
        model: settings?.model,
        userName: settings?.userName,
        goal: settings?.goal,
        dietPlan: settings?.dietPlan,
        dietitianNotes: settings?.dietitianNotes,
        health: await buildHealthContext(settings)
      })
      setAdvice(res)
      setPhase('result')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu.')
      setPhase('idle')
    }
  }

  function reset() {
    setPhase('idle')
    setPhoto('')
    setAdvice(null)
    setError('')
  }

  return (
    <div>
      <DietHeader title="Ne Yesem?" subtitle="Elindeki ürünlerden diyetine uygun öğün" />

      <div className="p-3 space-y-4">
        {!hasKey && (
          <div className="card p-4 bg-amber-50 border-amber-200 text-amber-800 text-sm">
            <p className="font-semibold mb-1">⚙️ Kurulum gerekli</p>
            <p>
              Bu özellik yapay zeka kullanır. <Link to="/ayarlar" className="underline font-semibold">Ayarlar</Link>{' '}
              bölümünden API anahtarını ekle.
            </p>
          </div>
        )}

        {error && <div className="card p-3 bg-rose-50 border-rose-200 text-rose-700 text-sm">{error}</div>}

        {phase === 'idle' && (
          <div className="card p-6 text-center space-y-4">
            <div className="text-6xl">🧊🥚🥦</div>
            <p className="text-slate-600 text-sm">
              Elindeki ürünleri fotoğrafla; yapay zeka{' '}
              <span className="font-semibold">diyetine uygun</span>, gramajlı öğünler önersin — kalori ve makro ile.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => cameraRef.current?.click()} disabled={!hasKey} className="btn-primary">
                📷 Fotoğraf Çek
              </button>
              <button
                onClick={() => galleryRef.current?.click()}
                disabled={!hasKey}
                className="btn bg-slate-200 text-slate-700 hover:bg-slate-300"
              >
                🖼️ Galeriden Seç
              </button>
            </div>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPick} />
            <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
            {!settings?.dietPlan?.trim() && (
              <p className="text-[11px] text-slate-400">
                İpucu: Ayarlar'a diyet listeni eklersen öneriler listene göre kişiselleşir.
              </p>
            )}
          </div>
        )}

        {phase === 'thinking' && (
          <div className="card p-4 space-y-3 text-center">
            {photo && <img src={photo} alt="Ürünler" className="w-full rounded-xl max-h-72 object-cover" />}
            <div className="flex items-center justify-center gap-2 text-emerald-700 py-2">
              <span className="animate-spin h-5 w-5 border-2 border-emerald-600 border-t-transparent rounded-full" />
              <span className="font-semibold">Öğünler hazırlanıyor…</span>
            </div>
          </div>
        )}

        {phase === 'result' && advice && (
          <div className="space-y-3">
            {photo && <img src={photo} alt="Ürünler" className="w-full rounded-2xl max-h-56 object-cover shadow" />}

            {/* Taninan urunler */}
            {advice.foodsDetected.length > 0 && (
              <div className="card p-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Tanınan ürünler</p>
                <div className="flex flex-wrap gap-1.5">
                  {advice.foodsDetected.map((f, i) => (
                    <span key={i} className="text-xs font-semibold bg-slate-100 text-slate-700 rounded-full px-2.5 py-1">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {advice.suggestions.length === 0 && (
              <div className="card p-4 text-center text-slate-600 text-sm">
                Bu fotoğraftan uygun bir öğün çıkaramadım. Ürünleri daha net çekip tekrar dene.
              </div>
            )}

            {advice.suggestions.map((s, i) => (
              <SuggestionCard key={i} s={s} index={i} />
            ))}

            {advice.tip && (
              <div className="card p-3 bg-emerald-50 border-emerald-100 text-emerald-900 text-sm">💡 {advice.tip}</div>
            )}

            <button onClick={reset} className="btn-primary w-full">
              Yeni Fotoğraf
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const PALETTE = ['from-emerald-500 to-emerald-600', 'from-indigo-500 to-violet-600', 'from-orange-400 to-orange-500']

function SuggestionCard({ s, index }: { s: MealSuggestion; index: number }) {
  const band = PALETTE[index % PALETTE.length]
  const [added, setAdded] = useState(false)
  const [mealType, setMealType] = useState<MealType>(guessMeal())
  const [picking, setPicking] = useState(false)

  // Bu oneriyi "yedim" olarak gunluge isle (kalori + makrolar)
  async function eat(mt: MealType) {
    const detail = s.items.map((it) => `${it.name} ${it.grams}g`).join(', ')
    await dietDb.entries.add({
      foodFound: true,
      foodName: detail ? `${s.title} (${detail})` : s.title,
      healthy: true,
      riskLevel: 'düşük',
      estimatedCalories: s.calories,
      protein: s.protein,
      carb: s.carb,
      fat: s.fat,
      dietScore: 0,
      scoreReason: '',
      harms: [],
      motivations: [],
      healthierAlternative: '',
      verdict: s.reason || `Ne Yesem önerisi: ${s.title}`,
      compliancePercent: -1,
      complianceNote: '',
      cravingPortion: '',
      cravingNote: '',
      photo: '',
      decision: 'ate',
      mealType: mt,
      createdAt: Date.now(),
      dateStr: todayStr()
    })
    setPicking(false)
    setAdded(true)
  }

  return (
    <div className="card overflow-hidden border-0 shadow-md">
      <div className={`bg-gradient-to-br ${band} text-white px-4 py-3`}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-extrabold leading-tight">{s.title}</h3>
          <span className="text-sm font-bold bg-white/25 rounded-full px-2.5 py-1 whitespace-nowrap">🔥 {s.calories} kcal</span>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Gramajli urunler */}
        <ul className="space-y-1.5">
          {s.items.map((it, i) => (
            <li key={i} className="flex items-center justify-between text-sm">
              <span className="text-slate-700">{it.name}</span>
              <span className="font-bold text-slate-900">{it.grams} g</span>
            </li>
          ))}
        </ul>

        {/* Makrolar */}
        <div className="grid grid-cols-3 gap-2">
          <Macro label="Protein" value={s.protein} cls="bg-rose-50 text-rose-700" />
          <Macro label="Karbonhidrat" value={s.carb} cls="bg-amber-50 text-amber-700" />
          <Macro label="Yağ" value={s.fat} cls="bg-sky-50 text-sky-700" />
        </div>

        {s.reason && <p className="text-sm text-slate-600 leading-snug bg-slate-50 rounded-xl p-2.5">{s.reason}</p>}

        {/* Bunu yedim -> gunluge isle */}
        {added ? (
          <p className="text-sm font-bold text-emerald-700 text-center">✓ Günlüğe eklendi ({mealLabel(mealType)})</p>
        ) : !picking ? (
          <button onClick={() => setPicking(true)} className="btn-primary w-full">
            😋 Bunu yedim (günlüğe ekle)
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Hangi öğün?</p>
            <div className="flex flex-wrap gap-1.5">
              {MEAL_OPTIONS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => {
                    setMealType(m.value)
                    void eat(m.value)
                  }}
                  className={`text-sm font-semibold rounded-full px-3 py-1.5 ${
                    mealType === m.value ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {m.emoji} {m.label}
                </button>
              ))}
            </div>
            <button onClick={() => setPicking(false)} className="text-xs text-slate-400 underline">
              vazgeç
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function Macro({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className={`rounded-xl p-2 text-center ${cls}`}>
      <p className="text-lg font-extrabold leading-none">{value}<span className="text-xs font-bold">g</span></p>
      <p className="text-[10px] font-semibold uppercase tracking-wide mt-0.5">{label}</p>
    </div>
  )
}

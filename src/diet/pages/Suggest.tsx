import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Capacitor } from '@capacitor/core'
import DietHeader from '../DietHeader'
import { dietDb, readDietSettings } from '../db'
import { buildHealthContext } from '../lib/context'
import { suggestMeal, pantryClarifyChat } from '../ai'
import { fileToResizedDataUrl, urlToResizedDataUrl } from '../../lib/image'
import { guessMeal, mealLabel, MEAL_OPTIONS } from '../lib/meals'
import { todayStr } from '../streak'
import type { MealAdvice, MealSuggestion, MealType } from '../types'

type Phase = 'idle' | 'converse' | 'thinking' | 'result'
const MAX_PHOTOS = 6

export default function Suggest() {
  const settings = useLiveQuery(() => readDietSettings(), [], undefined)
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [photos, setPhotos] = useState<string[]>([])
  const [advice, setAdvice] = useState<MealAdvice | null>(null)
  const [error, setError] = useState('')
  // Oneri ONCESI urun netlestirme sohbeti (koc gordugunu soyler, kullanici duzeltir)
  const [clarifyChat, setClarifyChat] = useState<{ role: 'user' | 'assistant'; text: string }[]>([])
  const [clarifyInput, setClarifyInput] = useState('')
  const [clarifyBusy, setClarifyBusy] = useState(false)

  const hasKey = !!settings?.apiKey

  // Tek foto cek (kamera). Her cekim listeye eklenir — birden fazla cekilebilir.
  function shoot() {
    cameraRef.current?.click()
  }

  // Galeriden sec: APK'da native cok-secim, web'de <input multiple>
  async function pickGallery() {
    if (Capacitor.isNativePlatform()) {
      try {
        const { Camera } = await import('@capacitor/camera')
        const res = await Camera.pickImages({ quality: 80, limit: MAX_PHOTOS })
        const urls = await Promise.all(
          res.photos.map((p) => urlToResizedDataUrl(p.webPath || (p as { path?: string }).path || '', 1000, 0.8))
        )
        addPhotos(urls.filter((u): u is string => !!u))
      } catch {
        /* iptal/izin — sessiz gec */
      }
      return
    }
    galleryRef.current?.click()
  }

  function addPhotos(urls: string[]) {
    if (!urls.length) return
    setError('')
    setPhotos((prev) => [...prev, ...urls].slice(0, MAX_PHOTOS))
  }

  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!files.length) return
    const urls = await Promise.all(files.map((f) => fileToResizedDataUrl(f, 1000, 0.8).catch(() => null)))
    addPhotos(urls.filter((u): u is string => !!u))
  }

  function removePhoto(i: number) {
    setPhotos((prev) => prev.filter((_, idx) => idx !== i))
  }

  // Önce KOÇ ürünleri doğrulasın: gördüklerini söyler, kullanıcı düzeltir.
  async function startConverse() {
    if (!photos.length || !hasKey) return
    setError('')
    setClarifyChat([])
    setClarifyInput('')
    setPhase('converse')
    setClarifyBusy(true)
    try {
      const reply = await pantryClarifyChat({
        apiKey: settings!.apiKey!,
        photoDataUrls: photos,
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
      setPhase('idle')
    } finally {
      setClarifyBusy(false)
    }
  }

  async function sendClarify() {
    const q = clarifyInput.trim()
    if (!q || clarifyBusy) return
    const hist = [...clarifyChat, { role: 'user' as const, text: q }]
    setClarifyChat(hist)
    setClarifyInput('')
    setClarifyBusy(true)
    try {
      const reply = await pantryClarifyChat({
        apiKey: settings!.apiKey!,
        photoDataUrls: photos,
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

  // Öneri üret. note = doğrulanan ürün listesi (sohbetten). Boş da olabilir.
  async function runSuggest(note?: string) {
    if (!photos.length) return
    setError('')
    setAdvice(null)
    setPhase('thinking')
    try {
      const res = await suggestMeal({
        apiKey: settings!.apiKey!,
        photoDataUrls: photos,
        note,
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
      setPhase(clarifyChat.length ? 'converse' : 'idle')
    }
  }

  function finalizeSuggest() {
    const transcript = clarifyChat.map((m) => `${m.role === 'assistant' ? 'Koç' : 'Ben'}: ${m.text}`).join('\n')
    void runSuggest(transcript || undefined)
  }

  function reset() {
    setPhase('idle')
    setPhotos([])
    setAdvice(null)
    setError('')
    setClarifyChat([])
    setClarifyInput('')
    setClarifyBusy(false)
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
              Elindeki ürünleri, masayı ya da farklı yemekleri fotoğrafla; yapay zeka{' '}
              <span className="font-semibold">diyetine uygun</span>, gramajlı öğünler önersin — kalori ve makro ile.
              <span className="block text-[11px] text-slate-400 mt-1">Birden fazla fotoğraf ekleyebilirsin.</span>
            </p>

            {/* Eklenen fotograflarin kucuk onizlemesi */}
            {photos.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2">
                {photos.map((p, i) => (
                  <div key={i} className="relative">
                    <img src={p} alt={`Foto ${i + 1}`} className="h-20 w-20 rounded-xl object-cover" />
                    <button
                      onClick={() => removePhoto(i)}
                      className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-slate-800/80 text-white text-xs leading-none flex items-center justify-center"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button onClick={shoot} disabled={!hasKey || photos.length >= MAX_PHOTOS} className="btn bg-slate-200 text-slate-700 hover:bg-slate-300 disabled:opacity-50">
                📷 Fotoğraf Çek
              </button>
              <button
                onClick={pickGallery}
                disabled={!hasKey || photos.length >= MAX_PHOTOS}
                className="btn bg-slate-200 text-slate-700 hover:bg-slate-300 disabled:opacity-50"
              >
                🖼️ Galeriden Seç
              </button>
            </div>

            {photos.length > 0 && (
              <button onClick={startConverse} disabled={!hasKey} className="btn-primary w-full">
                ✨ Devam ({photos.length} foto)
              </button>
            )}

            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPickFiles} />
            <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={onPickFiles} />
            {!settings?.dietPlan?.trim() && (
              <p className="text-[11px] text-slate-400">
                İpucu: Ayarlar'a diyet listeni eklersen öneriler listene göre kişiselleşir.
              </p>
            )}
          </div>
        )}

        {/* Öneri ÖNCESİ: koç gördüğü ürünleri söyler, kullanıcı doğrular/düzeltir */}
        {phase === 'converse' && (
          <div className="card p-4 space-y-3">
            {photos.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {photos.map((p, i) => (
                  <img key={i} src={p} alt={`Foto ${i + 1}`} className="h-16 w-16 rounded-lg object-cover" />
                ))}
              </div>
            )}

            <div className="space-y-2">
              {clarifyChat.map((m, i) => (
                <div
                  key={i}
                  className={`text-sm rounded-2xl px-3 py-2 whitespace-pre-wrap leading-relaxed ${
                    m.role === 'assistant'
                      ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-500/10'
                      : 'bg-slate-100 text-slate-700 ml-6'
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
            </div>

            <div className="flex items-center gap-2">
              <input
                className="field-input flex-1"
                placeholder="Düzelt / ekle: örn. o gördüğün balık, bir de yoğurt var"
                value={clarifyInput}
                onChange={(e) => setClarifyInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void sendClarify()
                }}
              />
              <button onClick={sendClarify} disabled={!clarifyInput.trim() || clarifyBusy} className="btn-primary px-3 py-2 disabled:opacity-50">
                Gönder
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={reset} className="btn bg-slate-200 text-slate-700 hover:bg-slate-300 py-2.5">
                Vazgeç
              </button>
              <button onClick={finalizeSuggest} disabled={clarifyBusy} className="btn-primary py-2.5 disabled:opacity-50">
                ✓ Doğru — öner
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Koç gördüklerini doğrula/düzelt; hazır olunca “Doğru — öner”. İstersen direkt de basabilirsin.
            </p>
          </div>
        )}

        {phase === 'thinking' && (
          <div className="card p-4 space-y-3 text-center">
            {photos.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2">
                {photos.map((p, i) => (
                  <img key={i} src={p} alt={`Foto ${i + 1}`} className="h-24 w-24 rounded-xl object-cover" />
                ))}
              </div>
            )}
            <div className="flex items-center justify-center gap-2 text-emerald-700 py-2">
              <span className="animate-spin h-5 w-5 border-2 border-emerald-600 border-t-transparent rounded-full" />
              <span className="font-semibold">Öğünler hazırlanıyor…</span>
            </div>
          </div>
        )}

        {phase === 'result' && advice && (
          <div className="space-y-3">
            {photos.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {photos.map((p, i) => (
                  <img key={i} src={p} alt={`Foto ${i + 1}`} className="h-24 w-24 rounded-xl object-cover shadow" />
                ))}
              </div>
            )}

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
  const [changing, setChanging] = useState(false)
  const [err, setErr] = useState('')

  // Bu oneriyi "yedim" olarak gunluge isle (kalori + makrolar). TEK DOKUNUS:
  // tahmini ogune ekler; sonra istersen ogunu degistirirsin. Hata olursa gosterir.
  async function eat(mt: MealType) {
    try {
      const detail = (s.items ?? []).map((it) => `${it.name} ${it.grams}g`).join(', ')
      await dietDb.entries.add({
        foodFound: true,
        foodName: detail ? `${s.title} (${detail})` : s.title,
        healthy: true,
        riskLevel: 'düşük',
        estimatedCalories: s.calories || 0,
        protein: s.protein || 0,
        carb: s.carb || 0,
        fat: s.fat || 0,
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
      setMealType(mt)
      setChanging(false)
      setErr('')
      setAdded(true)
    } catch {
      setErr('Günlüğe eklenemedi, lütfen tekrar dene.')
    }
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

        {/* Bunu yedim -> TEK DOKUNUSLA gunluge isle (tahmini ogune), sonra degistirilebilir */}
        {added ? (
          <div className="text-center space-y-1.5">
            <p className="text-sm font-bold text-emerald-700">✓ Günlüğe eklendi ({mealLabel(mealType)})</p>
            {!changing ? (
              <button onClick={() => setChanging(true)} className="text-xs text-slate-400 underline">
                öğünü değiştir
              </button>
            ) : (
              <div className="flex flex-wrap gap-1.5 justify-center">
                {MEAL_OPTIONS.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => void eat(m.value)}
                    className={`text-sm font-semibold rounded-full px-3 py-1.5 ${
                      mealType === m.value ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {m.emoji} {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <button onClick={() => void eat(mealType)} className="btn-primary w-full">
            😋 Bunu yedim (günlüğe ekle)
          </button>
        )}
        {err && <p className="text-xs text-rose-600 text-center mt-1">{err}</p>}
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

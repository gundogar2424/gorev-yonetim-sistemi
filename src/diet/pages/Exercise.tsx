import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import DietHeader from '../DietHeader'
import { listExercises, addExercise, deleteExercise, readDietSettings, listMeasurements, setActivityDay, getStepsRow } from '../db'
import { buildHealthContext } from '../lib/context'
import { estimateExerciseKcal, extractActivityFromPhoto } from '../ai'
import type { ActivityScan } from '../ai'
import { fileToResizedDataUrl } from '../../lib/image'
import { exercisePoints, exerciseBadges, todayStr } from '../streak'
import type { DietSettings, Exercise } from '../types'

export default function ExercisePage() {
  const exercises = useLiveQuery(() => listExercises(), [], [])
  const settings = useLiveQuery(() => readDietSettings(), [], undefined)
  const measurements = useLiveQuery(() => listMeasurements(), [], [])
  const [text, setText] = useState('')
  const [minutes, setMinutes] = useState('')
  // Samsung Health / saat verileri (elle, hepsi istege bagli)
  const [kcalIn, setKcalIn] = useState('')
  const [steps, setSteps] = useState('')
  const [avgHr, setAvgHr] = useState('')
  const [cadence, setCadence] = useState('')
  const [distanceKm, setDistanceKm] = useState('')
  const [flash, setFlash] = useState('')
  const [busy, setBusy] = useState(false)

  const list = exercises ?? []
  const totalPoints = list.reduce((sum, e) => sum + exercisePoints(e), 0)
  const totalMinutes = list.reduce((sum, e) => sum + (e.minutes ?? 0), 0)
  const { earned, locked } = exerciseBadges(list.length)

  // Haftalik hedef (son 7 gun, bugun dahil)
  const weekStart = todayStr(new Date(Date.now() - 6 * 86_400_000))
  const weekCount = list.filter((e) => e.dateStr >= weekStart).length
  const weekGoal = settings?.weeklyExerciseGoal && settings.weeklyExerciseGoal > 0 ? settings.weeklyExerciseGoal : 0
  const weekPct = weekGoal ? Math.min(100, Math.round((weekCount / weekGoal) * 100)) : 0

  // "12,5" / "7.360" gibi girdileri sayiya cevir (nokta/virgul/bosluk toleransli)
  function num(s: string): number | undefined {
    const c = s.replace(/\./g, '').replace(',', '.').replace(/\s/g, '').trim()
    if (!c) return undefined
    const v = Number(c)
    return Number.isFinite(v) ? v : undefined
  }
  function numDec(s: string): number | undefined {
    const c = s.replace(',', '.').replace(/\s/g, '').trim()
    if (!c) return undefined
    const v = Number(c)
    return Number.isFinite(v) ? v : undefined
  }

  async function save() {
    const t = text.trim()
    if (!t) return
    const m = minutes.trim() ? Math.max(0, Math.round(Number(minutes))) : undefined
    const mins = Number.isFinite(m as number) ? m : undefined

    const extra = {
      steps: num(steps),
      avgHr: num(avgHr),
      cadence: num(cadence),
      distanceKm: numDec(distanceKm)
    }

    // Kaloriyi ELLE girdiyse (saatten) onu kullan; yoksa yapay zeka tahmin etsin
    let kcal = num(kcalIn)
    if (kcal == null && settings?.apiKey) {
      setBusy(true)
      try {
        const weights = (measurements ?? [])
          .filter((x) => typeof x.weight === 'number')
          .sort((a, b) => a.createdAt - b.createdAt)
        const weightKg = weights.length ? (weights[weights.length - 1].weight as number) : undefined
        const res = await estimateExerciseKcal({ apiKey: settings.apiKey, text: t, minutes: mins, weightKg, model: settings?.model, health: await buildHealthContext(settings) })
        kcal = res.kcal
      } catch {
        // tahmin basarisiz olsa da egzersizi yine de kaydet
      } finally {
        setBusy(false)
      }
    }

    await addExercise(t, mins, kcal, extra)
    const gained = exercisePoints({ text: t, minutes: mins, createdAt: 0, dateStr: '' } as Exercise)
    setText('')
    setMinutes('')
    setKcalIn('')
    setSteps('')
    setAvgHr('')
    setCadence('')
    setDistanceKm('')
    setFlash(`Kaydedildi! +${gained} puan${kcal ? ` · ~${kcal} kcal 🔥` : ''} 💪`)
    setTimeout(() => setFlash(''), 4000)
  }

  async function remove(id: number) {
    if (!confirm('Bu egzersizi silmek istiyor musunuz?')) return
    await deleteExercise(id)
  }

  return (
    <div>
      <DietHeader title="Egzersiz" subtitle="Yaptığın egzersizi yaz, puan kazan" />

      <div className="p-3 space-y-4">
        {/* Ozet kart */}
        <div className="card p-4 bg-gradient-to-br from-indigo-500 to-violet-600 text-white border-0">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-indigo-50 text-xs uppercase tracking-wide">Egzersiz puanı</p>
              <p className="text-4xl font-extrabold mt-1">⭐ {totalPoints}</p>
            </div>
            <div className="text-right">
              <p className="text-indigo-50 text-xs uppercase tracking-wide">Toplam</p>
              <p className="text-lg font-bold mt-1">{list.length} egzersiz</p>
              <p className="text-indigo-100 text-sm">{totalMinutes} dk</p>
            </div>
          </div>
        </div>

        {/* Haftalik hedef (Ayarlar'dan girilirse gosterilir) */}
        {weekGoal > 0 && (
          <section className="card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide">🎯 Haftalık Hedef</h3>
              <span className={`text-sm font-bold ${weekCount >= weekGoal ? 'text-emerald-600' : 'text-slate-600'}`}>
                {weekCount}/{weekGoal}
              </span>
            </div>
            <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${weekCount >= weekGoal ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                style={{ width: `${weekPct}%` }}
              />
            </div>
            <p className="text-xs text-slate-500">
              {weekCount >= weekGoal
                ? 'Bu haftanın hedefini tamamladın! 🎉'
                : `Bu hafta hedefe ${weekGoal - weekCount} egzersiz kaldı.`}
            </p>
          </section>
        )}

        {/* Fotoğraftan oku (Samsung Health ekran görüntüleri) */}
        <PhotoScanCard settings={settings} />

        {/* Yeni egzersiz ekle */}
        <section className="card p-4 space-y-3">
          <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide">➕ Egzersiz Ekle (elle)</h3>
          <textarea
            className="field-input min-h-[72px]"
            placeholder="Ne yaptın? Örn. 30 dk tempolu yürüyüş, 20 şınav…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {/* Saat/Samsung Health verileri — hepsi isteğe bağlı, ne varsa gir */}
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-xs text-slate-500">⏱️ Süre (dk)</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                className="field-input"
                placeholder="60"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-500">🔥 Kalori (kcal)</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                className="field-input"
                placeholder="611"
                value={kcalIn}
                onChange={(e) => setKcalIn(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-500">👟 Adım</span>
              <input
                type="text"
                inputMode="numeric"
                className="field-input"
                placeholder="7360"
                value={steps}
                onChange={(e) => setSteps(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-500">❤️ Ort. nabız (bpm)</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                className="field-input"
                placeholder="112"
                value={avgHr}
                onChange={(e) => setAvgHr(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-500">🦶 Tempo (adım/dk)</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                className="field-input"
                placeholder="135"
                value={cadence}
                onChange={(e) => setCadence(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-500">📏 Mesafe (km)</span>
              <input
                type="text"
                inputMode="decimal"
                className="field-input"
                placeholder="4,2"
                value={distanceKm}
                onChange={(e) => setDistanceKm(e.target.value)}
              />
            </label>
          </div>
          <button onClick={save} disabled={!text.trim() || busy} className="btn-primary w-full">
            {busy ? 'Hesaplanıyor…' : 'Ekle'}
          </button>
          {flash && <p className="text-sm font-semibold text-emerald-700">{flash}</p>}
          <p className="text-xs text-slate-400">
            Sadece egzersiz adı yeter; saatteki değerleri (kalori, adım, nabız…) girersen aynen kaydedilir.
            {settings?.apiKey ? ' Kalori boşsa yapay zeka tahmin eder (küçük token).' : ''}
          </p>
        </section>

        {/* Egzersiz rozetleri */}
        <section className="card p-4 space-y-3">
          <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide">🏅 Egzersiz Rozetleri</h3>
          {earned.length === 0 && <p className="text-sm text-slate-500">Henüz rozet yok. İlk egzersizini ekle! 👟</p>}
          {earned.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {earned.map((b) => (
                <div key={b.count} className="bg-indigo-50 rounded-xl p-2 text-center">
                  <div className="text-2xl">{b.emoji}</div>
                  <p className="text-xs font-bold text-indigo-800">{b.name}</p>
                  <p className="text-[10px] text-slate-500 leading-tight">{b.desc}</p>
                </div>
              ))}
            </div>
          )}
          {locked.length > 0 && (
            <div className="grid grid-cols-3 gap-2 opacity-50">
              {locked.map((b) => (
                <div key={b.count} className="bg-slate-50 rounded-xl p-2 text-center">
                  <div className="text-2xl grayscale">{b.emoji}</div>
                  <p className="text-xs font-bold text-slate-600">{b.name}</p>
                  <p className="text-[10px] text-slate-400 leading-tight">{b.count} egzersiz</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Egzersiz gecmisi */}
        <section className="space-y-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide px-1">Geçmiş</h3>
          {list.length === 0 && (
            <div className="card p-6 text-center text-slate-500 text-sm">
              <div className="text-5xl mb-2">🏃</div>
              Henüz egzersiz yok. Yukarıdan ilkini ekle.
            </div>
          )}
          {list.map((ex) => (
            <div key={ex.id} className="card p-3 flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center text-2xl flex-shrink-0">
                💪
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 break-words">{ex.text}</p>
                <p className="text-xs text-slate-500">
                  {formatDate(ex.dateStr)}
                  {ex.minutes ? ` · ${ex.minutes} dk` : ''}
                  {ex.kcal ? ` · 🔥 ${ex.kcal} kcal` : ''} · +{exercisePoints(ex)} puan
                </p>
                {(ex.steps || ex.avgHr || ex.cadence || ex.distanceKm) && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    {[
                      ex.distanceKm ? `📏 ${ex.distanceKm} km` : '',
                      ex.steps ? `👟 ${ex.steps.toLocaleString('tr-TR')} adım` : '',
                      ex.avgHr ? `❤️ ${ex.avgHr} bpm` : '',
                      ex.cadence ? `🦶 ${ex.cadence} adım/dk` : ''
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}
              </div>
              <button onClick={() => remove(ex.id!)} className="text-slate-300 hover:text-rose-500 text-sm px-1">
                🗑️
              </button>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}

function formatDate(dateStr: string): string {
  const today = todayStr()
  const yesterday = new Date(Date.now() - 86_400_000).toLocaleDateString('en-CA')
  if (dateStr === today) return 'Bugün'
  if (dateStr === yesterday) return 'Dün'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long'
  })
}

const trNum = (n?: number | null) => (n != null ? n.toLocaleString('tr-TR') : '')

// Fotoğraftan (Samsung Health ekran görüntüsü) veri okuma kartı.
// İki foto: GÜNLÜK toplam adım + EGZERSİZ (yürüyüş). Egzersiz adımı günlükten düşülür.
type Slot = { url?: string; scan?: ActivityScan; busy: boolean; err?: string }
const emptySlot: Slot = { busy: false }

function PhotoScanCard({ settings }: { settings: DietSettings | undefined }) {
  const [daily, setDaily] = useState<Slot>(emptySlot)
  const [ex, setEx] = useState<Slot>(emptySlot)
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState('')
  const dailyInput = useRef<HTMLInputElement>(null)
  const exInput = useRef<HTMLInputElement>(null)

  const hasKey = !!settings?.apiKey?.trim()

  async function pick(kind: 'daily' | 'ex', file?: File) {
    if (!file) return
    const set = kind === 'daily' ? setDaily : setEx
    if (!hasKey) {
      set({ busy: false, err: 'Fotoğraf okumak için Ayarlar’dan yapay zeka anahtarı gerekli.' })
      return
    }
    let url = ''
    try {
      url = await fileToResizedDataUrl(file, 1400, 0.85)
    } catch {
      set({ busy: false, err: 'Resim okunamadı.' })
      return
    }
    set({ url, busy: true })
    try {
      const scan = await extractActivityFromPhoto({ apiKey: settings!.apiKey!, dataUrl: url, model: settings?.model })
      set({ url, scan, busy: false })
    } catch (e) {
      set({ url, busy: false, err: e instanceof Error ? e.message : 'Fotoğraf okunamadı.' })
    }
  }

  const dSteps = daily.scan?.steps ?? undefined
  const eSteps = ex.scan?.steps ?? undefined
  const netSteps = dSteps != null ? Math.max(0, dSteps - (eSteps ?? 0)) : undefined
  const canSave = (!!daily.scan || !!ex.scan) && !daily.busy && !ex.busy

  async function save() {
    setSaving(true)
    try {
      const today = new Date().toLocaleDateString('en-CA')
      // 1) Egzersiz kaydı (yürüyüş vb.)
      if (ex.scan) {
        const s = ex.scan
        await addExercise(s.activityName || 'Yürüyüş', s.minutes ?? undefined, s.kcal ?? undefined, {
          steps: s.steps ?? undefined,
          avgHr: s.avgHr ?? undefined,
          cadence: s.cadence ?? undefined,
          distanceKm: s.distanceKm ?? undefined
        })
      }
      // 2) Günlük adım (egzersiz düşülmüş) + günün yakılan kalori/mesafesi
      if (daily.scan) {
        const cur = await getStepsRow(today)
        await setActivityDay(today, {
          count: netSteps ?? cur?.count,
          activeMin: cur?.activeMin,
          activeKcal: cur?.activeKcal,
          burnedKcal: daily.scan.kcal ?? cur?.burnedKcal,
          distanceKm: daily.scan.distanceKm ?? cur?.distanceKm
        })
      }
      setDaily(emptySlot)
      setEx(emptySlot)
      const bits = [
        ex.scan ? 'egzersiz eklendi' : '',
        daily.scan ? `günlük adım ${trNum(netSteps ?? dSteps)}` : ''
      ].filter(Boolean)
      setFlash(`Kaydedildi! ${bits.join(' · ')} ✅`)
      setTimeout(() => setFlash(''), 5000)
    } finally {
      setSaving(false)
    }
  }

  const scanLine = (s?: ActivityScan) =>
    s
      ? [
          s.minutes ? `⏱️ ${s.minutes} dk` : '',
          s.steps ? `👟 ${trNum(s.steps)} adım` : '',
          s.kcal ? `🔥 ${trNum(s.kcal)} kcal` : '',
          s.avgHr ? `❤️ ${s.avgHr} bpm` : '',
          s.cadence ? `🦶 ${s.cadence} adım/dk` : '',
          s.distanceKm ? `📏 ${s.distanceKm} km` : ''
        ]
          .filter(Boolean)
          .join(' · ')
      : ''

  return (
    <section className="card p-4 space-y-3">
      <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide">📷 Fotoğraftan Oku (Samsung Health)</h3>
      <p className="text-xs text-slate-500 leading-relaxed">
        İki ekran görüntüsü yükle: <b>günlük toplam adım</b> ve (varsa) <b>egzersiz/yürüyüş</b>. Yapay zeka değerleri kendi
        okur; egzersiz adımı günlük toplamdan düşülür (çift saymayalım).
      </p>

      {!hasKey && (
        <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2">
          ⚠️ Fotoğraf okumak için Ayarlar’dan yapay zeka anahtarını girmen gerekiyor.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        {/* GÜNLÜK ADIM */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-600">👟 Günlük toplam adım</p>
          <input
            ref={dailyInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void pick('daily', e.target.files?.[0])}
          />
          <button onClick={() => dailyInput.current?.click()} disabled={!hasKey || daily.busy} className="btn-ghost w-full text-sm">
            {daily.busy ? 'Okunuyor…' : daily.url ? 'Değiştir' : 'Fotoğraf seç'}
          </button>
          {daily.url && <img src={daily.url} alt="Günlük adım" className="w-full rounded-lg max-h-32 object-cover" />}
          {daily.scan && <p className="text-[11px] text-slate-600 leading-snug">{scanLine(daily.scan) || 'Değer okunamadı'}</p>}
          {daily.err && <p className="text-[11px] text-rose-600">{daily.err}</p>}
        </div>

        {/* EGZERSİZ */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-600">🚶 Egzersiz (yürüyüş)</p>
          <input
            ref={exInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void pick('ex', e.target.files?.[0])}
          />
          <button onClick={() => exInput.current?.click()} disabled={!hasKey || ex.busy} className="btn-ghost w-full text-sm">
            {ex.busy ? 'Okunuyor…' : ex.url ? 'Değiştir' : 'Fotoğraf seç'}
          </button>
          {ex.url && <img src={ex.url} alt="Egzersiz" className="w-full rounded-lg max-h-32 object-cover" />}
          {ex.scan && <p className="text-[11px] text-slate-600 leading-snug">{scanLine(ex.scan) || 'Değer okunamadı'}</p>}
          {ex.err && <p className="text-[11px] text-rose-600">{ex.err}</p>}
        </div>
      </div>

      {/* Çıkarım özeti: günlük − egzersiz */}
      {dSteps != null && eSteps != null && (
        <div className="bg-indigo-50 rounded-lg p-2.5 text-sm text-indigo-900">
          <b>{trNum(dSteps)}</b> günlük − <b>{trNum(eSteps)}</b> egzersiz = <b>{trNum(netSteps)}</b> adım (egzersiz dışı hareket)
        </div>
      )}

      <button onClick={save} disabled={!canSave || saving} className="btn-primary w-full">
        {saving ? 'Kaydediliyor…' : 'Kaydet'}
      </button>
      {flash && <p className="text-sm font-semibold text-emerald-700">{flash}</p>}
    </section>
  )
}

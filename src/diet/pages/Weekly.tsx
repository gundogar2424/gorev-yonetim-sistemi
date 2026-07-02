import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import DietHeader from '../DietHeader'
import { dietDb, listExercises, listMeasurements, readDietSettings } from '../db'
import { computeWeekly, todayStr, dayAdherence, type WeeklySummary } from '../streak'
import { mealLabel } from '../lib/meals'
import { weeklyCoachSummary } from '../ai'
import { buildHealthContext } from '../lib/context'
import { shareTextSmart } from '../lib/share'
import type { DietEntry } from '../types'

export default function Weekly() {
  const entries = useLiveQuery(() => dietDb.entries.toArray(), [], [])
  const exercises = useLiveQuery(() => listExercises(), [], [])
  const measurements = useLiveQuery(() => listMeasurements(), [], [])
  const settings = useLiveQuery(() => readDietSettings(), [], undefined)
  const [days, setDays] = useState(7)

  const s = computeWeekly(entries ?? [], exercises ?? [], [], measurements ?? [], [], [], days)

  return (
    <div>
      <DietHeader title="Özet Rapor" subtitle="Son günlerin genel durumu" />

      <div className="p-3 space-y-4">
        {/* Donem secimi */}
        <div className="flex gap-2">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`flex-1 py-2 rounded-xl text-sm font-bold transition ${
                days === d ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
              }`}
            >
              Son {d} gün
            </button>
          ))}
        </div>

        {/* Haftalik koc ozeti (yapay zeka) */}
        <CoachSummary
          entries={entries ?? []}
          days={days}
          s={s}
          apiKey={settings?.apiKey}
          model={settings?.model}
          userName={settings?.userName}
          goal={settings?.goal}
          dietitianNotes={settings?.dietitianNotes}
        />

        {/* Puan vurgu */}
        <div className="card p-4 bg-gradient-to-br from-amber-400 to-orange-500 text-white border-0 text-center">
          <p className="text-orange-50 text-xs uppercase tracking-wide">Bu dönemde kazanılan puan</p>
          <p className="text-5xl font-extrabold mt-1">⭐ {s.points}</p>
        </div>

        {/* Karneler */}
        <div className="grid grid-cols-2 gap-3">
          <Tile emoji="💪" value={s.resisted} label="Vazgeçiş" accent="text-emerald-600" />
          <Tile emoji="😋" value={s.ate} label="Yenen öğün" accent="text-rose-500" />
          <Tile emoji="⚠️" value={s.broke} label="Diyet bozma" accent="text-rose-600" />
          <Tile emoji="🔥" value={s.kcalAte} label="Alınan kalori" accent="text-orange-600" />
          <Tile emoji="🏃" value={s.exerciseCount} label={`Egzersiz (${s.exerciseMinutes} dk)`} accent="text-indigo-600" />
        </div>

        {/* Kilo degisimi */}
        <div className="card p-4 flex items-center justify-between">
          <div>
            <p className="font-bold text-slate-700 text-sm">⚖️ Kilo değişimi</p>
            <p className="text-xs text-slate-500">Dönem içindeki ilk ve son tartı arasında</p>
          </div>
          {s.weightChange == null ? (
            <span className="text-sm text-slate-400">Yeterli tartı yok</span>
          ) : (
            <span
              className={`text-2xl font-extrabold ${
                s.weightChange < 0 ? 'text-emerald-600' : s.weightChange > 0 ? 'text-rose-500' : 'text-slate-500'
              }`}
            >
              {s.weightChange > 0 ? '+' : ''}
              {s.weightChange} kg
            </span>
          )}
        </div>

        <p className="text-center text-xs text-slate-400">
          Rakamlar son {days} günü (bugün dahil) kapsar. Tüm hesap cihazında yapılır, internet/token harcamaz.
        </p>
      </div>
    </div>
  )
}

// Son N gunun verisini kompakt bir metne dokup yapay zekadan haftalik
// degerlendirme ister. Sonucu gosterir; diyetisyene de gonderilebilir.
function CoachSummary({
  entries,
  days,
  s,
  apiKey,
  model,
  userName,
  goal,
  dietitianNotes
}: {
  entries: DietEntry[]
  days: number
  s: WeeklySummary
  apiKey?: string
  model?: string
  userName?: string
  goal?: string
  dietitianNotes?: string
}) {
  const [busy, setBusy] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  function buildData(): string {
    const lines: string[] = []
    lines.push(`Vazgeçiş: ${s.resisted}, yenen öğün: ${s.ate}, diyet bozma: ${s.broke}.`)
    lines.push(`Toplam alınan kalori ~${s.kcalAte} kcal (günlük ort ~${Math.round(s.kcalAte / days)} kcal).`)
    lines.push(`Egzersiz: ${s.exerciseCount} kez, ${s.exerciseMinutes} dk.`)
    if (s.weightChange != null) lines.push(`Kilo değişimi: ${s.weightChange > 0 ? '+' : ''}${s.weightChange} kg.`)

    // Gunluk basari (son N gun)
    const adh: string[] = []
    for (let i = days - 1; i >= 0; i--) {
      const d = todayStr(new Date(Date.now() - i * 86_400_000))
      const pct = dayAdherence(entries, d)
      if (pct != null) adh.push(`${d.slice(5)}: %${pct}`)
    }
    if (adh.length) lines.push(`Günlük diyet başarısı: ${adh.join(', ')}.`)

    // Toklugu dusuk ogunler (porsiyon yetersiz olabilir) -> ogun turune gore
    const start = todayStr(new Date(Date.now() - (days - 1) * 86_400_000))
    const low = entries.filter((e) => e.dateStr >= start && e.decision === 'ate' && e.satiety != null && e.satiety <= 4)
    if (low.length) {
      const byMeal = new Map<string, number>()
      for (const e of low) {
        const k = e.mealType ? mealLabel(e.mealType) : 'Diğer'
        byMeal.set(k, (byMeal.get(k) ?? 0) + 1)
      }
      lines.push(
        `Tokluğu düşük (≤4/10) öğünler: ${Array.from(byMeal.entries()).map(([k, n]) => `${k} x${n}`).join(', ')}.`
      )
    }
    return lines.join('\n')
  }

  async function generate() {
    if (!apiKey) return
    setError('')
    setText('')
    setBusy(true)
    try {
      const health = await buildHealthContext(await readDietSettings())
      const res = await weeklyCoachSummary({ apiKey, data: buildData(), days, model, userName, goal, dietitianNotes, health })
      setText(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Özet alınamadı.')
    } finally {
      setBusy(false)
    }
  }

  async function send() {
    const res = await shareTextSmart(`🗓️ Haftalık değerlendirme (son ${days} gün)\n\n${text}`)
    if (res === 'shared') setMsg('Paylaşım menüsü açıldı.')
    else if (res === 'copied') setMsg('Panoya kopyalandı.')
    else if (res !== 'cancelled') setMsg('Gönderilemedi.')
    setTimeout(() => setMsg(''), 3500)
  }

  return (
    <section className="card p-3 space-y-2 bg-brand-50 border-brand-100">
      <h3 className="font-bold text-brand-800 text-sm uppercase tracking-wide">🤖 Haftalık Koç Değerlendirmesi</h3>
      {!apiKey ? (
        <p className="text-xs text-slate-500">
          Yapay zeka değerlendirmesi için{' '}
          <Link to="/ayarlar" className="underline font-semibold">
            Ayarlar
          </Link>
          ’dan API anahtarı ekle.
        </p>
      ) : (
        <>
          <p className="text-xs text-slate-500">
            Son {days} gününe bakıp neyi iyi yaptığını, nelere dikkat etmen gerektiğini ve birkaç öneriyi özetler.
          </p>
          <button onClick={generate} disabled={busy} className="btn-primary w-full">
            {busy ? 'Değerlendiriyorum…' : '🪄 Haftamı değerlendir'}
          </button>
          <p className="text-[11px] text-slate-400">Bu özellik token kullanır (küçük, tek seferlik).</p>
        </>
      )}
      {error && <p className="text-xs text-rose-600 font-semibold">{error}</p>}
      {text && (
        <div className="space-y-2">
          <p className="text-sm text-slate-800 bg-white rounded-xl p-3 leading-snug whitespace-pre-wrap">{text}</p>
          <button onClick={send} className="btn bg-slate-200 text-slate-700 hover:bg-slate-300 w-full">
            📤 Diyetisyene gönder
          </button>
          {msg && <p className="text-xs text-brand-700 font-semibold">{msg}</p>}
        </div>
      )}
    </section>
  )
}

function Tile({ emoji, value, label, accent }: { emoji: string; value: number; label: string; accent: string }) {
  return (
    <div className="card p-3 text-center">
      <div className="text-2xl">{emoji}</div>
      <p className={`text-2xl font-extrabold ${accent}`}>{value}</p>
      <p className="text-xs text-slate-500 leading-tight">{label}</p>
    </div>
  )
}

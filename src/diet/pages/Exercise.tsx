import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import DietHeader from '../DietHeader'
import { listExercises, addExercise, deleteExercise, readDietSettings, listMeasurements } from '../db'
import { estimateExerciseKcal } from '../ai'
import { exercisePoints, exerciseBadges, todayStr } from '../streak'
import type { Exercise } from '../types'

export default function ExercisePage() {
  const exercises = useLiveQuery(() => listExercises(), [], [])
  const settings = useLiveQuery(() => readDietSettings(), [], undefined)
  const measurements = useLiveQuery(() => listMeasurements(), [], [])
  const [text, setText] = useState('')
  const [minutes, setMinutes] = useState('')
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

  async function save() {
    const t = text.trim()
    if (!t) return
    const m = minutes.trim() ? Math.max(0, Math.round(Number(minutes))) : undefined
    const mins = Number.isFinite(m as number) ? m : undefined

    // Yapay zeka ile yaklasik yakilan kaloriyi tahmin et (anahtar varsa)
    let kcal: number | undefined
    if (settings?.apiKey) {
      setBusy(true)
      try {
        const weights = (measurements ?? [])
          .filter((x) => typeof x.weight === 'number')
          .sort((a, b) => a.createdAt - b.createdAt)
        const weightKg = weights.length ? (weights[weights.length - 1].weight as number) : undefined
        const res = await estimateExerciseKcal({ apiKey: settings.apiKey, text: t, minutes: mins, weightKg, model: settings?.model })
        kcal = res.kcal
      } catch {
        // tahmin basarisiz olsa da egzersizi yine de kaydet
      } finally {
        setBusy(false)
      }
    }

    await addExercise(t, mins, kcal)
    const gained = exercisePoints({ text: t, minutes: mins, createdAt: 0, dateStr: '' } as Exercise)
    setText('')
    setMinutes('')
    setFlash(`Kaydedildi! +${gained} puan${kcal ? ` · ~${kcal} kcal yakıldı 🔥` : ''} 💪`)
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

        {/* Yeni egzersiz ekle */}
        <section className="card p-4 space-y-3">
          <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide">➕ Egzersiz Ekle</h3>
          <textarea
            className="field-input min-h-[72px]"
            placeholder="Ne yaptın? Örn. 30 dk tempolu yürüyüş, 20 şınav…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              className="field-input w-28"
              placeholder="dk"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
            <span className="text-sm text-slate-400 flex-1">Süre (dakika, isteğe bağlı)</span>
            <button onClick={save} disabled={!text.trim() || busy} className="btn-primary px-5">
              {busy ? 'Hesaplanıyor…' : 'Ekle'}
            </button>
          </div>
          {flash && <p className="text-sm font-semibold text-emerald-700">{flash}</p>}
          <p className="text-xs text-slate-400">
            Her egzersiz +8 puan, süre uzadıkça +12'ye kadar bonus puan kazandırır.
            {settings?.apiKey ? ' Yakılan kaloriyi yapay zeka tahmin eder (küçük token).' : ''}
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
                  {ex.kcal ? ` · ~${ex.kcal} kcal` : ''} · +{exercisePoints(ex)} puan
                </p>
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

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import DietHeader from '../DietHeader'
import { dietDb, listExercises, listWater, listMeasurements, listSteps } from '../db'
import { computeWeekly } from '../streak'

export default function Weekly() {
  const entries = useLiveQuery(() => dietDb.entries.toArray(), [], [])
  const exercises = useLiveQuery(() => listExercises(), [], [])
  const waters = useLiveQuery(() => listWater(), [], [])
  const measurements = useLiveQuery(() => listMeasurements(), [], [])
  const steps = useLiveQuery(() => listSteps(), [], [])
  const [days, setDays] = useState(7)

  const s = computeWeekly(entries ?? [], exercises ?? [], waters ?? [], measurements ?? [], steps ?? [], days)

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
          <Tile emoji="💧" value={s.waterAvg} label="Günlük su (ort.)" accent="text-sky-600" />
          <Tile emoji="👟" value={s.stepsAvg} label="Günlük adım (ort.)" accent="text-teal-600" />
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

function Tile({ emoji, value, label, accent }: { emoji: string; value: number; label: string; accent: string }) {
  return (
    <div className="card p-3 text-center">
      <div className="text-2xl">{emoji}</div>
      <p className={`text-2xl font-extrabold ${accent}`}>{value}</p>
      <p className="text-xs text-slate-500 leading-tight">{label}</p>
    </div>
  )
}

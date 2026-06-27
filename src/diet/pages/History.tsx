import { useLiveQuery } from 'dexie-react-hooks'
import DietHeader from '../DietHeader'
import { dietDb } from '../db'
import { computeStats } from '../streak'
import type { DietEntry } from '../types'

const DECISION_LABEL: Record<string, { text: string; cls: string }> = {
  resisted: { text: '💪 Vazgeçti', cls: 'bg-emerald-100 text-emerald-800' },
  ate: { text: '😋 Yedi', cls: 'bg-rose-100 text-rose-800' },
  none: { text: '— Karar yok', cls: 'bg-slate-100 text-slate-500' }
}

export default function History() {
  // En yeni en ustte
  const entries = useLiveQuery(() => dietDb.entries.orderBy('createdAt').reverse().toArray(), [], [])
  const stats = computeStats(entries ?? [])

  async function remove(id: number) {
    if (!confirm('Bu kaydı silmek istiyor musunuz?')) return
    await dietDb.entries.delete(id)
  }

  // Tarihe gore grupla
  const groups = groupByDate(entries ?? [])

  return (
    <div>
      <DietHeader title="Geçmiş" subtitle="Kararlarının kaydı" />

      <div className="p-3 space-y-4">
        {/* Ozet istatistikler */}
        <div className="grid grid-cols-3 gap-2">
          <Stat value={stats.streak} label="Gün seri" accent="text-emerald-600" />
          <Stat value={stats.totalResisted} label="Vazgeçiş" accent="text-emerald-600" />
          <Stat value={stats.totalAte} label="Yedim" accent="text-rose-500" />
        </div>

        {(entries?.length ?? 0) === 0 && (
          <div className="card p-6 text-center text-slate-500 text-sm">
            <div className="text-5xl mb-2">🍽️</div>
            Henüz kayıt yok. İlk yemeğinin fotoğrafını çekerek başla.
          </div>
        )}

        {groups.map(([date, items]) => (
          <section key={date} className="space-y-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide px-1">{formatDate(date)}</h3>
            {items.map((e) => {
              const d = DECISION_LABEL[e.decision] ?? DECISION_LABEL.none
              return (
                <div key={e.id} className="card p-3 flex gap-3 items-center">
                  {e.photo ? (
                    <img src={e.photo} alt={e.foodName} className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center text-2xl">🍽️</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-800 truncate">{e.foodName}</p>
                    </div>
                    <p className="text-xs text-slate-500">
                      ~{e.estimatedCalories} kcal · {new Date(e.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <span className={`inline-block mt-1 text-xs font-bold px-2 py-0.5 rounded-full ${d.cls}`}>
                      {d.text}
                    </span>
                  </div>
                  <button onClick={() => remove(e.id!)} className="text-slate-300 hover:text-rose-500 text-sm px-1">
                    🗑️
                  </button>
                </div>
              )
            })}
          </section>
        ))}
      </div>
    </div>
  )
}

function Stat({ value, label, accent }: { value: number; label: string; accent: string }) {
  return (
    <div className="card p-3 text-center">
      <p className={`text-2xl font-extrabold ${accent}`}>{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  )
}

function groupByDate(entries: DietEntry[]): [string, DietEntry[]][] {
  const map = new Map<string, DietEntry[]>()
  for (const e of entries) {
    const arr = map.get(e.dateStr) ?? []
    arr.push(e)
    map.set(e.dateStr, arr)
  }
  // entries zaten createdAt'e gore tersten geldigi icin tarihler de dogru sirada
  return Array.from(map.entries())
}

function formatDate(dateStr: string): string {
  const today = new Date().toLocaleDateString('en-CA')
  const yesterday = new Date(Date.now() - 86_400_000).toLocaleDateString('en-CA')
  if (dateStr === today) return 'Bugün'
  if (dateStr === yesterday) return 'Dün'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

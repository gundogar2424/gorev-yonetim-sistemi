import { useState } from 'react'
import EftHeader from '../EftHeader'
import { byIssue, deleteSession, lastDaysActivity, readSessions, stats } from '../lib/store'
import { fmtMinutes, fmtShort } from '../lib/date'
import { sudsColor } from '../components/SudsPicker'
import { emojiFor } from '../lib/content'

export default function HistoryPage() {
  const [tick, setTick] = useState(0)
  const all = readSessions()
  const list = all.slice().reverse()
  const st = stats(all)
  const gunler = lastDaysActivity(7)
  const enCok = Math.max(1, ...gunler.map((g) => g.count))
  const konular = byIssue(all).slice(0, 5)
  const [acik, setAcik] = useState<string | null>(null)

  function sil(id: string) {
    if (!window.confirm('Bu seans silinsin mi?')) return
    deleteSession(id)
    setTick(tick + 1)
  }

  return (
    <div>
      <EftHeader title="Geçmiş" subtitle="Seansların ve ilerlemen" />
      <div className="px-4 space-y-4">
        {all.length === 0 ? (
          <div className="eft-card text-center py-8">
            <div className="text-[40px] mb-2">🌱</div>
            <p className="text-[16px] text-slate-600 dark:text-[#d5e6e4]">Henüz seans yok. İlk seansını yaptığında burada göreceksin.</p>
          </div>
        ) : (
          <>
            <section className="grid grid-cols-3 gap-2">
              <Stat deger={String(st.count)} etiket="seans" />
              <Stat deger={`${st.avgDrop >= 0 ? '−' : '+'}${Math.abs(st.avgDrop).toFixed(1)}`} etiket="ort. düşüş" />
              <Stat deger={`${st.minutes}`} etiket="dakika" />
            </section>

            <section className="eft-card">
              <h3 className="eft-label mb-3">Son 7 gün</h3>
              <div className="flex items-end gap-2">
                {gunler.map((g) => (
                  <div key={g.key} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full h-16 flex items-end">
                      <div
                        className={`w-full rounded-t-lg ${g.count ? 'bg-eft-500' : 'bg-slate-100 dark:bg-[#1e3231]'}`}
                        style={{ height: `${g.count ? Math.max(14, (g.count / enCok) * 100) : 6}%` }}
                      />
                    </div>
                    <span className="text-[12px] text-slate-500 dark:text-[#7f9896]">{g.label}</span>
                  </div>
                ))}
              </div>
            </section>

            {konular.length > 0 && (
              <section className="eft-card">
                <h3 className="eft-label mb-2">En çok çalıştığın konular</h3>
                <ul className="space-y-2">
                  {konular.map((k) => (
                    <li key={k.issueId + k.issue} className="flex items-center gap-3">
                      <span className="text-[22px] w-8 text-center">{emojiFor(k.issueId)}</span>
                      <span className="flex-1 min-w-0 text-[15px] font-semibold text-slate-800 dark:text-[#e8f2f1] truncate">{k.issue}</span>
                      <span className="text-[13px] text-slate-500 dark:text-[#7f9896] tabular-nums">
                        {k.count} seans · ort. −{Math.max(0, k.avgDrop).toFixed(1)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="eft-card">
              <h3 className="eft-label mb-2">Tüm seanslar</h3>
              <ul className="divide-y divide-slate-100 dark:divide-[#2b4442]">
                {list.map((s) => {
                  const on = acik === s.id
                  return (
                    <li key={s.id} className="py-2.5">
                      <button className="w-full flex items-center gap-3 text-left" onClick={() => setAcik(on ? null : s.id)}>
                        <span className="text-[22px] w-8 text-center flex-shrink-0">{emojiFor(s.issueId)}</span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-[15px] font-semibold text-slate-800 dark:text-[#e8f2f1] truncate">{s.issue}</span>
                          <span className="block text-[13px] text-slate-500 dark:text-[#7f9896]">
                            {fmtShort(s.t)} · {s.rounds} tur · {fmtMinutes(s.ms)}
                          </span>
                        </span>
                        <span className="flex items-center gap-1.5 text-[16px] font-bold tabular-nums">
                          <span style={{ color: sudsColor(s.before) }}>{s.before}</span>
                          <span className="text-slate-300 dark:text-[#5f7a78]">→</span>
                          <span style={{ color: sudsColor(s.after) }}>{s.after}</span>
                        </span>
                      </button>
                      {on && (
                        <div className="mt-2 pl-11 eft-pop">
                          <div className="h-2 rounded-full bg-slate-100 dark:bg-[#1e3231] overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${(s.after / 10) * 100}%`, backgroundColor: sudsColor(s.after) }} />
                          </div>
                          {s.note && <p className="mt-2 text-[14px] text-slate-700 dark:text-[#d5e6e4] whitespace-pre-wrap">{s.note}</p>}
                          <button className="mt-2 text-[14px] font-semibold text-rose-600" onClick={() => sil(s.id)}>
                            Bu seansı sil
                          </button>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          </>
        )}
      </div>
    </div>
  )
}

function Stat({ deger, etiket }: { deger: string; etiket: string }) {
  return (
    <div className="eft-card text-center py-3">
      <div className="text-[24px] font-bold text-slate-900 dark:text-[#e8f2f1] tabular-nums leading-tight">{deger}</div>
      <div className="text-[12px] text-slate-500 dark:text-[#7f9896]">{etiket}</div>
    </div>
  )
}

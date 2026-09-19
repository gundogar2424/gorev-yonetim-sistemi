import { useState } from 'react'
import SesHeader from '../SesHeader'
import LineChart from '../components/LineChart'
import { findExercise } from '../lib/content'
import { findDExercise } from '../lib/diksiyon'
import { bestMpt, deleteMpt, deleteSession, lastDaysActivity, readMpt, readSessions, sessionKind, stats, streakDays } from '../lib/store'
import { fmtDay, fmtMinutes, fmtShort } from '../lib/date'

export default function ProgressPage() {
  const [, bump] = useState(0)
  const sessions = readSessions()
  const st = stats(sessions)
  const nSes = sessions.filter((s) => sessionKind(s) === 'ses').length
  const nDik = sessions.length - nSes
  const seri = streakDays()
  const gunler = lastDaysActivity(7)
  const maxG = Math.max(1, ...gunler.map((g) => g.count))
  const mpt = readMpt()
  const mptSon = mpt.slice(-20)
  const best = bestMpt()
  const [sekme, setSekme] = useState<'seans' | 'olcum'>('seans')

  return (
    <div>
      <SesHeader title="İlerleme" subtitle="Seanslar ve ses ölçümleri" />
      <div className="px-4 space-y-4 pb-6">
        <div className="grid grid-cols-3 gap-2">
          <Kutu deger={String(seri)} etiket="gün seri" />
          <Kutu deger={String(st.count)} etiket={`seans (${nSes} ses · ${nDik} diksiyon)`} />
          <Kutu deger={String(st.minutes)} etiket="dakika" />
        </div>

        <section className="ses-card">
          <h3 className="ses-label mb-3">Son 7 gün</h3>
          <div className="flex items-end justify-between gap-2 h-24">
            {gunler.map((g) => (
              <div key={g.key} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full rounded-t-lg bg-ses-500/90 transition-all" style={{ height: `${(g.count / maxG) * 72}px`, minHeight: g.count ? 8 : 2, opacity: g.count ? 1 : 0.25 }} />
                <span className="text-[12px] text-slate-500 dark:text-[#a3908a]">{g.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="ses-card">
          <div className="flex items-center justify-between mb-1">
            <h3 className="ses-label">En uzun "A" (sn)</h3>
            {best > 0 && <span className="ses-pill">rekor {best.toFixed(1).replace('.', ',')} sn</span>}
          </div>
          {mptSon.length >= 2 ? (
            <div className="text-slate-700 dark:text-[#d8c8bf]">
              <LineChart values={mptSon.map((r) => r.sec)} labels={mptSon.map((r) => fmtDay(r.d))} ref={10} />
              <p className="text-[12px] text-slate-500 dark:text-[#a3908a] mt-1">Kesik çizgi: 10 sn (bunun üstü hedef). Süre zamanla uzuyorsa kapanma iyileşiyor demektir.</p>
            </div>
          ) : (
            <p className="text-[14px] text-slate-500 dark:text-[#a3908a]">Grafik için en az 2 ölçüm gerekir. Ana sayfadan "Ölç" ile ölçüm yap.</p>
          )}
        </section>

        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ['seans', 'Seanslar'],
              ['olcum', 'Ölçümler']
            ] as const
          ).map(([v, l]) => (
            <button key={v} onClick={() => setSekme(v)} className={`min-h-[48px] rounded-2xl text-[15px] font-semibold transition ${sekme === v ? 'bg-ses-600 text-white' : 'bg-slate-100 dark:bg-[#352820] text-slate-700 dark:text-[#f5ece4]'}`}>
              {l}
            </button>
          ))}
        </div>

        {sekme === 'seans' ? (
          sessions.length === 0 ? (
            <p className="text-[15px] text-slate-500 dark:text-[#a3908a] text-center py-6">Henüz seans yok.</p>
          ) : (
            <ul className="space-y-2">
              {[...sessions].reverse().map((s) => (
                <li key={s.id} className="ses-card">
                  <div className="flex items-center justify-between">
                    <span className="text-[15px] font-semibold text-slate-800 dark:text-[#f5ece4]">
                      {sessionKind(s) === 'diksiyon' ? '🗣️ Diksiyon' : '🎤 Ses'} · {fmtShort(s.t)}
                    </span>
                    <span className="text-[14px] text-slate-500 dark:text-[#a3908a]">{fmtMinutes(s.ms)}</span>
                  </div>
                  <div className="text-[14px] text-slate-600 dark:text-[#d8c8bf] mt-1">
                    {s.done
                      .map((d) => {
                        const e = sessionKind(s) === 'diksiyon' ? findDExercise(d.id) : findExercise(d.id)
                        return `${e?.emoji ?? ''} ${e?.name ?? d.id}${d.mpt ? ` (${d.mpt.toFixed(1).replace('.', ',')} sn)` : ''}`
                      })
                      .join(' · ')}
                  </div>
                  {s.note && <div className="text-[14px] italic text-slate-500 dark:text-[#a3908a] mt-1">“{s.note}”</div>}
                  <button
                    className="text-[13px] text-rose-500 mt-2"
                    onClick={() => {
                      if (confirm('Bu seans silinsin mi?')) {
                        deleteSession(s.id)
                        bump((x) => x + 1)
                      }
                    }}
                  >
                    Sil
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : mpt.length === 0 ? (
          <p className="text-[15px] text-slate-500 dark:text-[#a3908a] text-center py-6">Henüz ölçüm yok.</p>
        ) : (
          <ul className="ses-card divide-y divide-slate-100 dark:divide-[#4a3a30]">
            {[...mpt].reverse().map((r) => (
              <li key={r.id} className="py-2 flex items-center justify-between text-[15px]">
                <span className="text-slate-500 dark:text-[#a3908a]">
                  {fmtShort(r.t)}
                  {r.manual ? ' · elle' : ''}
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-semibold tabular-nums text-slate-800 dark:text-[#f5ece4]">{r.sec.toFixed(1).replace('.', ',')} sn</span>
                  <button
                    className="text-[13px] text-rose-500"
                    onClick={() => {
                      if (confirm('Bu ölçüm silinsin mi?')) {
                        deleteMpt(r.id)
                        bump((x) => x + 1)
                      }
                    }}
                  >
                    Sil
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function Kutu({ deger, etiket }: { deger: string; etiket: string }) {
  return (
    <div className="ses-card text-center py-3">
      <div className="text-[26px] font-bold text-slate-900 dark:text-[#f5ece4] tabular-nums leading-none">{deger}</div>
      <div className="text-[12px] text-slate-500 dark:text-[#a3908a] mt-1">{etiket}</div>
    </div>
  )
}

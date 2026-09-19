import { useState } from 'react'
import SesHeader from '../SesHeader'
import LineChart from '../components/LineChart'
import { findExercise } from '../lib/content'
import { findDExercise } from '../lib/diksiyon'
import { bestMpt, deleteMpt, deleteSession, lastDaysActivity, readMpt, readSessions, sessionAccuracy, sessionKind, sessionRating, stats, streakDays } from '../lib/store'
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
  const acSon = mpt.filter((r) => r.ac).slice(-20)
  const best = bestMpt()
  const [sekme, setSekme] = useState<'seans' | 'olcum'>('seans')
  const accSeries = sessions.map((x) => ({ d: x.d, v: sessionAccuracy(x) })).filter((x): x is { d: string; v: number } => x.v != null).slice(-20)
  const ratSeries = sessions.map((x) => ({ d: x.d, v: sessionRating(x) })).filter((x): x is { d: string; v: number } => x.v != null).slice(-20)

  return (
    <div>
      <SesHeader title="İlerleme" subtitle="Seanslar ve ses ölçümleri" />
      <div className="px-4 space-y-5 pb-6">
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
                <span className="text-[14px] text-slate-700 dark:text-[#d8c8bf]">{g.label}</span>
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
              <p className="text-[14px] text-slate-700 dark:text-[#d8c8bf] mt-1">Kesik çizgi: 10 sn (bunun üstü hedef). Süre zamanla uzuyorsa kapanma iyileşiyor demektir.</p>
            </div>
          ) : (
            <p className="text-[16px] text-slate-700 dark:text-[#d8c8bf]">Grafik için en az 2 ölçüm gerekir. Ana sayfadan "Ölç" ile ölçüm yap.</p>
          )}
        </section>

        <section className="ses-card">
          <div className="flex items-center justify-between mb-1">
            <h3 className="ses-label">Ses kalitesi · HNR (dB)</h3>
            {acSon.length > 0 && (
              <span className="ses-pill">
                son {String(acSon[acSon.length - 1].ac!.hnr).replace('.', ',')} dB · jitter %{String(acSon[acSon.length - 1].ac!.jitter).replace('.', ',')} · shimmer %{String(acSon[acSon.length - 1].ac!.shimmer).replace('.', ',')}
              </span>
            )}
          </div>
          {acSon.length >= 2 ? (
            <div className="text-slate-700 dark:text-[#d8c8bf]">
              <LineChart values={acSon.map((r) => r.ac!.hnr)} labels={acSon.map((r) => fmtDay(r.d))} ref={18} />
              <p className="text-[14px] text-slate-700 dark:text-[#d8c8bf] mt-1">Harmonik/gürültü oranı: yükseldikçe ses daha tok, daha az nefesli. Kesik çizgi: 18 dB. Telefon mikrofonu; kendi geçmişinle karşılaştır.</p>
            </div>
          ) : (
            <p className="text-[16px] text-slate-700 dark:text-[#d8c8bf]">Grafik için mikrofonla en az 2 "A" ölçümü gerekir.</p>
          )}
        </section>

        <section className="ses-card">
          <div className="flex items-center justify-between mb-1">
            <h3 className="ses-label">Diksiyon doğruluğu (%)</h3>
            {accSeries.length > 0 && <span className="ses-pill">son %{accSeries[accSeries.length - 1].v}</span>}
          </div>
          {accSeries.length >= 2 ? (
            <div className="text-slate-700 dark:text-[#d8c8bf]">
              <LineChart values={accSeries.map((r) => r.v)} labels={accSeries.map((r) => fmtDay(r.d))} ref={85} />
              <p className="text-[14px] text-slate-700 dark:text-[#d8c8bf] mt-1">Konuşma tanıma ile seans ortalaması. Kesik çizgi: %85 (hedef).</p>
            </div>
          ) : (
            <p className="text-[16px] text-slate-700 dark:text-[#d8c8bf]">Grafik için puanlamalı en az 2 diksiyon seansı gerekir.</p>
          )}
        </section>

        <section className="ses-card">
          <div className="flex items-center justify-between mb-1">
            <h3 className="ses-label">Öz değerlendirme (1-5)</h3>
            {ratSeries.length > 0 && <span className="ses-pill">son {ratSeries[ratSeries.length - 1].v}</span>}
          </div>
          {ratSeries.length >= 2 ? (
            <div className="text-slate-700 dark:text-[#d8c8bf]">
              <LineChart values={ratSeries.map((r) => r.v)} labels={ratSeries.map((r) => fmtDay(r.d))} />
            </div>
          ) : (
            <p className="text-[16px] text-slate-700 dark:text-[#d8c8bf]">Seans sonlarında verdiğin puanlar burada birikir.</p>
          )}
        </section>

        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ['seans', 'Seanslar'],
              ['olcum', 'Ölçümler']
            ] as const
          ).map(([v, l]) => (
            <button key={v} onClick={() => setSekme(v)} className={`min-h-[54px] rounded-2xl text-[17px] font-semibold transition ${sekme === v ? 'bg-ses-600 text-white' : 'bg-slate-100 dark:bg-[#352820] text-slate-700 dark:text-[#f5ece4]'}`}>
              {l}
            </button>
          ))}
        </div>

        {sekme === 'seans' ? (
          sessions.length === 0 ? (
            <p className="text-[17px] text-slate-700 dark:text-[#d8c8bf] text-center py-6">Henüz seans yok.</p>
          ) : (
            <ul className="space-y-2">
              {[...sessions].reverse().map((s) => (
                <li key={s.id} className="ses-card">
                  <div className="flex items-center justify-between">
                    <span className="text-[17px] font-semibold text-slate-800 dark:text-[#f5ece4]">
                      {sessionKind(s) === 'diksiyon' ? '🗣️ Diksiyon' : '🎤 Ses'} · {fmtShort(s.t)}
                    </span>
                    <span className="text-[16px] text-slate-700 dark:text-[#d8c8bf]">{fmtMinutes(s.ms)}</span>
                  </div>
                  <div className="text-[16px] text-slate-700 dark:text-[#e2d5cd] mt-1">
                    {s.done
                      .map((d) => {
                        const e = sessionKind(s) === 'diksiyon' ? findDExercise(d.id) : findExercise(d.id)
                        return `${e?.emoji ?? ''} ${e?.name ?? d.id}${d.mpt ? ` (${d.mpt.toFixed(1).replace('.', ',')} sn)` : ''}`
                      })
                      .join(' · ')}
                  </div>
                  {(sessionAccuracy(s) != null || sessionRating(s) != null) && (
                    <div className="flex gap-2 mt-2">
                      {sessionAccuracy(s) != null && <span className="ses-pill">doğruluk %{sessionAccuracy(s)}</span>}
                      {sessionRating(s) != null && <span className="ses-pill">★ {sessionRating(s)}</span>}
                    </div>
                  )}
                  {s.note && <div className="text-[16px] italic text-slate-700 dark:text-[#d8c8bf] mt-1">“{s.note}”</div>}
                  {s.feedback && <div className="text-[15px] text-slate-700 dark:text-[#e2d5cd] mt-2 whitespace-pre-wrap rounded-2xl bg-ses-50 dark:bg-[#352820] p-2">🤖 {s.feedback}</div>}
                  <button
                    className="text-[15px] text-rose-500 mt-2"
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
          <p className="text-[17px] text-slate-700 dark:text-[#d8c8bf] text-center py-6">Henüz ölçüm yok.</p>
        ) : (
          <ul className="ses-card divide-y divide-slate-100 dark:divide-[#4a3a30]">
            {[...mpt].reverse().map((r) => (
              <li key={r.id} className="py-2 flex items-center justify-between text-[17px]">
                <span className="text-slate-700 dark:text-[#d8c8bf]">
                  {fmtShort(r.t)}
                  {r.manual ? ' · elle' : ''}
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-right">
                    <span className="block font-semibold tabular-nums text-slate-800 dark:text-[#f5ece4]">{r.sec.toFixed(1).replace('.', ',')} sn</span>
                    {r.ac && <span className="block text-[14px] text-slate-700 dark:text-[#d8c8bf] tabular-nums">{r.ac.f0} Hz · HNR {String(r.ac.hnr).replace('.', ',')} · j %{String(r.ac.jitter).replace('.', ',')} · s %{String(r.ac.shimmer).replace('.', ',')}</span>}
                  </span>
                  <button
                    className="text-[15px] text-rose-500"
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
      <div className="text-[28px] font-bold text-slate-900 dark:text-[#f5ece4] tabular-nums leading-none">{deger}</div>
      <div className="text-[14px] text-slate-700 dark:text-[#d8c8bf] mt-1">{etiket}</div>
    </div>
  )
}

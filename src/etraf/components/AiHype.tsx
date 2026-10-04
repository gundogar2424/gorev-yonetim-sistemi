import { useState } from 'react'
import { Link } from 'react-router-dom'
import { analyzeHype, getCachedHype, saveCachedHype, TREND_TEXT, type HypeAnalysis } from '../lib/ai'
import { getSettings } from '../lib/store'
import type { Place } from '../lib/types'

function ago(ts: number): string {
  const d = Math.floor((Date.now() - ts) / 864e5)
  if (d < 1) return 'bugün'
  return `${d} gün önce`
}

export default function AiHype({ place, onResult }: { place: Place; onResult: (a: HypeAnalysis) => void }) {
  const [analysis, setAnalysis] = useState<HypeAnalysis | null>(() => getCachedHype(place))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const key = getSettings().claudeKey

  async function run() {
    setBusy(true)
    setError(null)
    try {
      const a = await analyzeHype(key, place)
      saveCachedHype(place, a)
      setAnalysis(a)
      onResult(a)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const box = 'mt-4 rounded-2xl border border-violet-200 dark:border-[#3a2f4d] bg-violet-50/60 dark:bg-[#211c29] p-4'

  if (!key) {
    return (
      <div className={box}>
        <p className="text-[14px] font-semibold text-violet-900 dark:text-violet-200">🤖 Yapay zekâ hype yorumu</p>
        <p className="mt-1 text-[13px] text-slate-600 dark:text-[#cfc5bd]">
          Claude bu mekânı Instagram, TikTok, Ekşi Sözlük, blog ve haberlerde arayıp ne kadar konuşulduğunu yorumlar.{' '}
          <Link to="/ayarlar" className="font-semibold text-violet-700 dark:text-violet-300 underline">
            Ayarlar'dan Claude API anahtarı
          </Link>{' '}
          ekleyince açılır.
        </p>
      </div>
    )
  }

  return (
    <div className={box}>
      <div className="flex items-center gap-2">
        <p className="flex-1 text-[14px] font-semibold text-violet-900 dark:text-violet-200">
          🤖 Yapay zekâ hype yorumu
        </p>
        {analysis && !busy && (
          <button onClick={run} className="text-[13px] font-semibold text-violet-700 dark:text-violet-300">
            ↻ Yenile
          </button>
        )}
      </div>

      {busy && (
        <div className="mt-3 flex items-center gap-2.5 text-[14px] text-slate-600 dark:text-[#cfc5bd]">
          <span className="inline-block w-5 h-5 border-2 border-violet-300 border-t-violet-700 rounded-full animate-spin" />
          Sosyal medya ve web taranıyor… (30-90 sn)
        </div>
      )}

      {error && !busy && <p className="mt-2 text-[13px] text-rose-600 dark:text-rose-300">{error}</p>}

      {!analysis && !busy && (
        <>
          <p className="mt-1 text-[13px] text-slate-600 dark:text-[#cfc5bd]">
            Instagram, TikTok, Ekşi Sözlük, blog ve haberlerde ne konuşulduğuna bakar. Her yorum birkaç web araması
            yapar (yaklaşık 0,10-0,30 $); sonuç 7 gün saklanır.
          </p>
          <button
            onClick={run}
            className="mt-3 w-full h-11 rounded-xl bg-violet-700 text-white text-[15px] font-semibold active:scale-[0.98] transition"
          >
            🔍 Ne kadar konuşuluyor?
          </button>
        </>
      )}

      {analysis && !busy && (
        <div className="mt-2">
          <div className="flex items-baseline gap-3">
            <span className="text-[34px] font-bold leading-none text-violet-800 dark:text-violet-200 tabular-nums">
              {analysis.score}
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-slate-900 dark:text-[#f2ebe6]">{analysis.label}</p>
              <p className="text-[12px] text-slate-500 dark:text-[#a59b94]">{TREND_TEXT[analysis.trend]}</p>
            </div>
          </div>
          <p className="mt-2 text-[14px] leading-relaxed text-slate-700 dark:text-[#d9d0c9]">{analysis.summary}</p>
          {analysis.praised.length > 0 && (
            <div className="mt-2">
              <p className="text-[12px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                Övülen
              </p>
              <ul className="mt-0.5 text-[13px] text-slate-700 dark:text-[#d9d0c9] list-disc pl-5">
                {analysis.praised.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          )}
          {analysis.complaints.length > 0 && (
            <div className="mt-2">
              <p className="text-[12px] font-bold uppercase tracking-wide text-rose-600 dark:text-rose-400">Şikâyet</p>
              <ul className="mt-0.5 text-[13px] text-slate-700 dark:text-[#d9d0c9] list-disc pl-5">
                {analysis.complaints.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          )}
          {analysis.platforms.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {analysis.platforms.map((x) => (
                <span
                  key={x}
                  className="px-2 py-0.5 rounded-full bg-white dark:bg-[#2c2536] text-[12px] text-violet-800 dark:text-violet-200"
                >
                  {x}
                </span>
              ))}
            </div>
          )}
          {analysis.sources.length > 0 && (
            <div className="mt-3">
              <p className="text-[12px] font-bold uppercase tracking-wide text-slate-500 dark:text-[#a59b94]">
                Kaynaklar
              </p>
              <ul className="mt-1 space-y-1">
                {analysis.sources.map((s) => (
                  <li key={s.url} className="truncate">
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[13px] text-violet-700 dark:text-violet-300 underline"
                    >
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="mt-3 text-[11px] text-slate-400 dark:text-[#857b74]">
            {ago(analysis.at)} · Claude web araması ile. Yapay zekâ yanılabilir; kaynaklara bakarak doğrula.
          </p>
        </div>
      )}
    </div>
  )
}

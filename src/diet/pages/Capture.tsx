import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import DietHeader from '../DietHeader'
import { dietDb, getDietSettings } from '../db'
import { analyzeFood } from '../ai'
import { computeStats, todayStr } from '../streak'
import { fileToResizedDataUrl } from '../../lib/image'
import type { Decision, FoodAnalysis } from '../types'

type Phase = 'idle' | 'analyzing' | 'result' | 'saved'

const RISK_STYLES: Record<string, string> = {
  düşük: 'bg-emerald-100 text-emerald-800',
  orta: 'bg-amber-100 text-amber-800',
  yüksek: 'bg-rose-100 text-rose-800'
}

export default function Capture() {
  const settings = useLiveQuery(() => getDietSettings(), [], undefined)
  const entries = useLiveQuery(() => dietDb.entries.toArray(), [], [])
  const stats = computeStats(entries ?? [])

  const fileRef = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [photo, setPhoto] = useState<string>('')
  const [analysis, setAnalysis] = useState<FoodAnalysis | null>(null)
  const [error, setError] = useState('')
  const [savedDecision, setSavedDecision] = useState<Decision>('none')

  const hasKey = !!settings?.apiKey

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) await runAnalysis(file)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function runAnalysis(file: File) {
    setError('')
    setAnalysis(null)
    try {
      const dataUrl = await fileToResizedDataUrl(file, 800, 0.8)
      setPhoto(dataUrl)
      setPhase('analyzing')
      const result = await analyzeFood({
        apiKey: settings!.apiKey!,
        photoDataUrl: dataUrl,
        model: settings?.model,
        userName: settings?.userName,
        goal: settings?.goal,
        dietPlan: settings?.dietPlan
      })
      setAnalysis(result)
      setPhase('result')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu.')
      setPhase('idle')
    }
  }

  async function decide(decision: Decision) {
    if (!analysis) return
    await dietDb.entries.add({
      ...analysis,
      photo,
      decision,
      createdAt: Date.now(),
      dateStr: todayStr()
    })
    setSavedDecision(decision)
    setPhase('saved')
  }

  function reset() {
    setPhase('idle')
    setPhoto('')
    setAnalysis(null)
    setSavedDecision('none')
    setError('')
  }

  return (
    <div>
      <DietHeader title="Diyet Koçu" subtitle="Yemeden önce çek, kararını ver" />

      <div className="p-3 space-y-4">
        {/* Seri kartim */}
        <div className="card p-4 bg-gradient-to-br from-emerald-500 to-emerald-700 text-white border-0">
          <p className="text-emerald-50 text-xs uppercase tracking-wide">Diyet serin</p>
          <p className="text-4xl font-extrabold mt-1">
            {stats.streak} <span className="text-lg font-semibold">gün</span>
          </p>
          <p className="text-emerald-50 text-sm mt-1">
            {stats.streak === 0
              ? 'Bugün temiz bir başlangıç yap! 💪'
              : `${stats.streak} gündür diyetini bozmadın. Devam! 🔥`}
          </p>
        </div>

        {!hasKey && (
          <div className="card p-4 bg-amber-50 border-amber-200 text-amber-800 text-sm">
            <p className="font-semibold mb-1">⚙️ Kurulum gerekli</p>
            <p>
              Fotoğraf incelemesi için bir Anthropic API anahtarı gerekiyor.{' '}
              <Link to="/ayarlar" className="underline font-semibold">
                Ayarlar
              </Link>{' '}
              bölümünden ekleyin.
            </p>
          </div>
        )}

        {error && <div className="card p-3 bg-rose-50 border-rose-200 text-rose-700 text-sm">{error}</div>}

        {/* Bos durum: cek butonu */}
        {phase === 'idle' && (
          <div className="card p-6 text-center space-y-4">
            <div className="text-6xl">📸</div>
            <p className="text-slate-600 text-sm">
              Yemeğini yemeden önce fotoğrafını çek. Yapay zeka onu tanıyıp diyetin için doğru kararı vermene
              yardım etsin.
            </p>
            <button onClick={() => fileRef.current?.click()} disabled={!hasKey} className="btn-primary w-full">
              📷 Yemeğin Fotoğrafını Çek
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={onPick}
            />
          </div>
        )}

        {/* Inceleniyor */}
        {phase === 'analyzing' && (
          <div className="card p-4 space-y-3 text-center">
            {photo && <img src={photo} alt="Yemek" className="w-full rounded-xl max-h-72 object-cover" />}
            <div className="flex items-center justify-center gap-2 text-emerald-700 py-2">
              <span className="animate-spin h-5 w-5 border-2 border-emerald-600 border-t-transparent rounded-full" />
              <span className="font-semibold">Yemeğin inceleniyor…</span>
            </div>
          </div>
        )}

        {/* Sonuc */}
        {phase === 'result' && analysis && (
          <div className="space-y-3">
            {photo && <img src={photo} alt="Yemek" className="w-full rounded-2xl max-h-72 object-cover shadow" />}

            <div className="card p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-bold text-slate-800">{analysis.foodName}</h2>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${RISK_STYLES[analysis.riskLevel] ?? ''}`}>
                  {analysis.riskLevel.toUpperCase()} RİSK
                </span>
              </div>

              <div className="flex items-center gap-3 text-sm text-slate-600">
                <span>🔥 ~{analysis.estimatedCalories} kcal</span>
                <span>{analysis.healthy ? '✅ Sağlıklı' : '⚠️ Diyetini zorlayabilir'}</span>
              </div>

              {/* Diyet listesine uyum (yalnizca liste yuklendiyse, yani >= 0) */}
              {analysis.compliancePercent >= 0 && <ComplianceBar analysis={analysis} />}

              <p className="text-slate-700 text-sm font-medium bg-slate-50 rounded-xl p-3">“{analysis.verdict}”</p>

              {analysis.harms.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-rose-600 uppercase tracking-wide mb-1">Zararları</p>
                  <ul className="space-y-1">
                    {analysis.harms.map((h, i) => (
                      <li key={i} className="text-sm text-slate-700 flex gap-2">
                        <span className="text-rose-500">⊘</span>
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {analysis.motivations.length > 0 && (
                <div className="bg-emerald-50 rounded-xl p-3">
                  <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-1">Sana bir söz</p>
                  <ul className="space-y-1.5">
                    {analysis.motivations.map((m, i) => (
                      <li key={i} className="text-sm text-emerald-900 flex gap-2">
                        <span>💚</span>
                        <span>{m}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {analysis.healthierAlternative && (
                <p className="text-sm text-slate-600">
                  <span className="font-semibold">Daha iyisi:</span> {analysis.healthierAlternative}
                </p>
              )}
            </div>

            {/* Karar butonlari */}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => decide('resisted')} className="btn-primary py-3">
                💪 Vazgeçtim
              </button>
              <button
                onClick={() => decide('ate')}
                className="btn py-3 bg-slate-200 text-slate-700 hover:bg-slate-300"
              >
                😋 Yine de yedim
              </button>
            </div>
            <button onClick={reset} className="w-full text-center text-sm text-slate-400 py-1">
              Vazgeç, baştan
            </button>
          </div>
        )}

        {/* Kaydedildi */}
        {phase === 'saved' && (
          <div className="card p-6 text-center space-y-4">
            <div className="text-6xl">{savedDecision === 'resisted' ? '🎉' : '🤝'}</div>
            <p className="text-lg font-bold text-slate-800">
              {savedDecision === 'resisted' ? 'Aferin sana! Vazgeçtin.' : 'Kaydedildi. Yarın yeni bir gün.'}
            </p>
            <p className="text-sm text-slate-600">
              {savedDecision === 'resisted'
                ? `Diyet serin: ${stats.streak} gün. İraden için tebrikler! 🌟`
                : 'Önemli olan pes etmemek. Bir sonrakinde sen kazanacaksın. 💪'}
            </p>
            <button onClick={reset} className="btn-primary w-full">
              Yeni Fotoğraf
            </button>
            <Link to="/gecmis" className="block text-sm text-emerald-700 underline">
              Geçmişi gör
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

// Diyet listesine uyum yuzdesini renkli bir cubukla gosterir
function ComplianceBar({ analysis }: { analysis: FoodAnalysis }) {
  const pct = Math.max(0, Math.min(100, analysis.compliancePercent))
  const color =
    pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500'
  const textColor =
    pct >= 80 ? 'text-emerald-700' : pct >= 50 ? 'text-amber-700' : 'text-rose-700'
  const label = pct >= 80 ? 'Listene uygun 👍' : pct >= 50 ? 'Kısmen uyuyor' : 'Listene aykırı'

  return (
    <div className="bg-slate-50 rounded-xl p-3 space-y-2">
      <div className="flex items-end justify-between">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Diyet listene uyum</span>
        <span className={`text-2xl font-extrabold ${textColor}`}>%{pct}</span>
      </div>
      <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <p className={`text-sm font-semibold ${textColor}`}>{label}</p>
      {analysis.complianceNote && <p className="text-sm text-slate-600">{analysis.complianceNote}</p>}
    </div>
  )
}

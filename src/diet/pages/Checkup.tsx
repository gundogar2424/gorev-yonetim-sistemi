import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import DietHeader from '../DietHeader'
import { listLabs, listVitals, listMeasurements, readDietSettings } from '../db'
import { healthChat } from '../ai'
import { buildHealthContext } from '../lib/context'
import type { Lab, Vital, Measurement, DietSettings } from '../types'

// Son tahlilleri kompakt tam metne dok (baslik + tarih + yorum/deger)
function buildLabsText(labs: Lab[]): string {
  if (!labs.length) return ''
  return labs
    .slice(-4)
    .map((l) => {
      const body = (l.analysis?.trim() || l.text?.trim() || '').replace(/\s+/g, ' ').slice(0, 1500)
      return `[${l.dateStr}] ${l.title || 'Tahlil'}:\n${body}`
    })
    .join('\n\n')
}

// Son seker/tansiyon olcumlerini dokum halinde ver
function buildVitalsText(vitals: Vital[]): string {
  if (!vitals.length) return ''
  return [...vitals]
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(-15)
    .map((v) =>
      v.kind === 'seker'
        ? `${v.dateStr} ${v.time} — Şeker ${v.sugar} mg/dL${v.sugarContext ? ` (${v.sugarContext})` : ''}`
        : `${v.dateStr} ${v.time} — Tansiyon ${v.systolic}/${v.diastolic}${v.pulse ? `, nabız ${v.pulse}` : ''}`
    )
    .join('\n')
}

function buildBody(settings?: DietSettings, measurements?: Measurement[]): string | undefined {
  const p: string[] = []
  if (settings?.gender) p.push(settings.gender)
  if (settings?.age) p.push(`${settings.age} yaşında`)
  if (settings?.heightCm) p.push(`boy ${settings.heightCm} cm`)
  const w = (measurements ?? []).filter((m) => typeof m.weight === 'number').sort((a, b) => a.createdAt - b.createdAt)
  if (w.length) p.push(`kilo ${w[w.length - 1].weight} kg`)
  return p.length ? `Kişinin fiziği: ${p.join(', ')}.` : undefined
}

export default function Checkup() {
  const settings = useLiveQuery(() => readDietSettings(), [], undefined)
  const labs = useLiveQuery(() => listLabs(), [], [])
  const vitals = useLiveQuery(() => listVitals(), [], [])
  const measurements = useLiveQuery(() => listMeasurements(), [], [])
  const [chat, setChat] = useState<{ role: 'user' | 'assistant'; text: string }[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)

  const hasKey = !!settings?.apiKey

  async function ask(preset?: string) {
    const q = (preset ?? input).trim()
    if (!q || !hasKey || busy) return
    const history = [...chat, { role: 'user' as const, text: q }]
    setChat(history)
    setInput('')
    setBusy(true)
    try {
      const s = await readDietSettings()
      const answer = await healthChat({
        apiKey: s.apiKey!,
        history,
        model: s.model,
        userName: s.userName,
        goal: s.goal,
        medications: s.medications,
        conditions: s.conditions,
        body: buildBody(s, measurements ?? []),
        labsText: buildLabsText(labs ?? []),
        vitalsText: buildVitalsText(vitals ?? []),
        dietitianNotes: s.dietitianNotes,
        health: await buildHealthContext(s)
      })
      setChat([...history, { role: 'assistant', text: answer }])
    } catch (err) {
      setChat([...history, { role: 'assistant', text: err instanceof Error ? err.message : 'Cevap alınamadı.' }])
    } finally {
      setBusy(false)
    }
  }

  const labCount = labs?.length ?? 0
  const vitCount = vitals?.length ?? 0

  return (
    <div>
      <DietHeader title="Sağlık Check-up" subtitle="Tüm verilerini bir hekim gibi bütünsel yorumlar" />

      <div className="p-3 space-y-3">
        {!hasKey ? (
          <div className="card p-4 text-sm text-slate-600">
            Bunun için{' '}
            <Link to="/ayarlar" className="underline font-semibold text-emerald-700">
              Ayarlar
            </Link>
            ’dan API anahtarı ekle.
          </div>
        ) : (
          <>
            {/* Bilgi + tek dokunus check-up */}
            <section className="card p-4 space-y-3 bg-gradient-to-br from-teal-50 to-emerald-50 border-emerald-100">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🩺</span>
                <div>
                  <p className="font-bold text-slate-800">Genel durumunu değerlendireyim</p>
                  <p className="text-xs text-slate-500">
                    Tahlillerin, şeker/tansiyon ölçümlerin, kilon ve ilaçların — hepsini birlikte, check-up gibi.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                <span className="px-2 py-0.5 rounded-full bg-white text-slate-600 border border-slate-200">🧪 {labCount} tahlil</span>
                <span className="px-2 py-0.5 rounded-full bg-white text-slate-600 border border-slate-200">🩸 {vitCount} ölçüm</span>
              </div>
              <button
                onClick={() => ask('Elimdeki tüm sağlık verilerime (tahliller, şeker, tansiyon, kilo, ilaçlar) bir check-up yapar gibi bütünsel bak; neyim iyi, neyim sınırda, neye dikkat etmeliyim, değerler birbiriyle bağlantılı mı — özetle ve önerilerini ver.')}
                disabled={busy}
                className="btn-primary w-full"
              >
                {busy && chat.length === 0 ? 'Değerlendiriyorum…' : '🩺 Check-up yap'}
              </button>
            </section>

            {/* Sohbet akisi */}
            {chat.length > 0 && (
              <div className="space-y-1.5">
                {chat.map((m, i) => (
                  <div
                    key={i}
                    className={`text-sm rounded-xl px-3 py-2 whitespace-pre-wrap leading-snug ${
                      m.role === 'user' ? 'bg-emerald-600 text-white ml-6' : 'bg-white border border-slate-100 text-slate-800 mr-6'
                    }`}
                  >
                    {m.text}
                  </div>
                ))}
                {busy && <p className="text-xs text-slate-400 mr-6">hekim bakıyor…</p>}
              </div>
            )}

            {/* Serbest soru */}
            <div className="flex gap-2">
              <input
                className="field-input flex-1"
                placeholder="örn. CRP’m neden yüksek? · Tansiyonum nasıl gidiyor?"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && ask()}
              />
              <button onClick={() => ask()} disabled={busy || !input.trim()} className="btn-primary px-4">
                Sor
              </button>
            </div>

            {chat.length === 0 && (
              <p className="text-[11px] text-slate-400 px-1">
                Sağlığınla ilgili ne merak edersen sor; tahlil, şeker/tansiyon ve kilo verini bilerek cevaplar. Not: tıbbi teşhis değildir, doktoruna danış.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

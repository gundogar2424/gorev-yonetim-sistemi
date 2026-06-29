import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { readDietSettings } from '../db'
import { chatAboutPlan } from '../ai'

// Ana ekranda kompakt "menüne sor" alani (oglen ne var? siradaki ogun?)
// Tam sohbet/duzeltme Daha -> Menum sayfasinda.
export default function MenuAsk() {
  const settings = useLiveQuery(() => readDietSettings(), [], undefined)
  const plan = settings?.dietPlan ?? ''
  const hasKey = !!settings?.apiKey
  const [input, setInput] = useState('')
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)

  if (!plan.trim()) return null // liste yoksa gosterme

  async function ask(question?: string) {
    const q = (question ?? input).trim()
    if (!q || !hasKey) return
    setBusy(true)
    setAnswer('')
    setInput('')
    try {
      const a = await chatAboutPlan({
        apiKey: settings!.apiKey!,
        dietPlan: plan,
        history: [{ role: 'user', text: q }],
        model: settings?.model,
        userName: settings?.userName,
        goal: settings?.goal
      })
      setAnswer(a)
    } catch (err) {
      setAnswer(err instanceof Error ? err.message : 'Cevap alınamadı.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card p-3 space-y-2 bg-emerald-50 border-emerald-100">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide">🍽️ Menüne sor</p>
        <Link to="/menu" className="text-xs text-emerald-700 underline">
          Menüm →
        </Link>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => ask('Şu an sıradaki öğün hangisi ve listemde ne var? Kısaca söyle.')}
          disabled={!hasKey || busy}
          className="btn-primary px-3 py-2 text-sm whitespace-nowrap"
        >
          Sıradaki öğün
        </button>
        <input
          className="field-input flex-1"
          placeholder="örn. Öğlen ne var?"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && ask()}
          disabled={!hasKey}
        />
        <button onClick={() => ask()} disabled={!hasKey || busy || !input.trim()} className="btn bg-emerald-600 text-white px-3">
          Sor
        </button>
      </div>
      {busy && <p className="text-xs text-emerald-700">bakıyorum…</p>}
      {answer && <p className="text-sm text-emerald-900 bg-white rounded-xl p-2.5 leading-snug">{answer}</p>}
      {!hasKey && <p className="text-[11px] text-emerald-700/70">Sormak için Ayarlar’dan API anahtarı gerekir.</p>}
    </div>
  )
}

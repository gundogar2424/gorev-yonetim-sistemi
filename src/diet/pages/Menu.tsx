import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import DietHeader from '../DietHeader'
import { readDietSettings, saveDietSettings } from '../db'
import { chatAboutPlan, editPlan } from '../ai'

export default function Menu() {
  const settings = useLiveQuery(() => readDietSettings(), [], undefined)
  const plan = settings?.dietPlan ?? ''
  const hasKey = !!settings?.apiKey

  const [chat, setChat] = useState<{ role: 'user' | 'assistant'; text: string }[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatBusy, setChatBusy] = useState(false)

  const [editInstr, setEditInstr] = useState('')
  const [proposed, setProposed] = useState<string | null>(null)
  const [editBusy, setEditBusy] = useState(false)
  const [msg, setMsg] = useState('')

  function flash(m: string) {
    setMsg(m)
    setTimeout(() => setMsg(''), 3000)
  }

  async function ask(question?: string) {
    const q = (question ?? chatInput).trim()
    if (!q) return
    const history = [...chat, { role: 'user' as const, text: q }]
    setChat(history)
    setChatInput('')
    setChatBusy(true)
    try {
      const answer = await chatAboutPlan({
        apiKey: settings!.apiKey!,
        dietPlan: plan,
        history,
        model: settings?.model,
        userName: settings?.userName,
        goal: settings?.goal
      })
      setChat([...history, { role: 'assistant', text: answer }])
    } catch (err) {
      setChat([...history, { role: 'assistant', text: err instanceof Error ? err.message : 'Cevap alınamadı.' }])
    } finally {
      setChatBusy(false)
    }
  }

  async function proposeEdit() {
    if (!editInstr.trim()) return
    setEditBusy(true)
    setProposed(null)
    try {
      const next = await editPlan({ apiKey: settings!.apiKey!, dietPlan: plan, instruction: editInstr, model: settings?.model })
      setProposed(next)
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Düzenlenemedi.')
    } finally {
      setEditBusy(false)
    }
  }

  async function applyEdit() {
    if (proposed == null) return
    await saveDietSettings({ dietPlan: proposed })
    setProposed(null)
    setEditInstr('')
    flash('Liste güncellendi ✅')
  }

  return (
    <div>
      <DietHeader title="Menüm" subtitle="Diyet listen — sor & düzelt" />

      <div className="p-3 space-y-4">
        {msg && <p className="card p-3 bg-emerald-50 text-emerald-800 text-sm border-emerald-100">{msg}</p>}

        {!plan.trim() && (
          <div className="card p-4 bg-amber-50 border-amber-200 text-amber-800 text-sm">
            Henüz diyet listen yok.{' '}
            <Link to="/ayarlar" className="underline font-semibold">
              Ayarlar
            </Link>{' '}
            bölümünden ekle (elle yaz ya da fotoğrafını çek).
          </div>
        )}

        {/* Hizli: siradaki ogun */}
        {plan.trim() && (
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => ask('Şu an sıradaki öğün hangisi ve listemde o öğünde ne var?')} disabled={!hasKey || chatBusy} className="btn-primary">
              🍽️ Sıradaki öğün
            </button>
            <button onClick={() => ask('Bugün listemde hangi öğünler var? Kısaca özetle.')} disabled={!hasKey || chatBusy} className="btn bg-slate-200 text-slate-700">
              📋 Günün özeti
            </button>
          </div>
        )}

        {/* Sohbet */}
        {plan.trim() && (
          <section className="card p-3 space-y-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">💬 Menün hakkında sor</p>
            {chat.length > 0 && (
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {chat.map((m, i) => (
                  <div
                    key={i}
                    className={`text-sm rounded-xl px-3 py-2 ${
                      m.role === 'user' ? 'bg-emerald-600 text-white ml-8' : 'bg-slate-100 text-slate-800 mr-8'
                    }`}
                  >
                    {m.text}
                  </div>
                ))}
                {chatBusy && <p className="text-xs text-slate-400 mr-8">yazıyor…</p>}
              </div>
            )}
            <div className="flex gap-2">
              <input
                className="field-input flex-1"
                placeholder="örn. Öğlen ne var? Akşam tatlı var mı?"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && ask()}
                disabled={!hasKey}
              />
              <button onClick={() => ask()} disabled={!hasKey || chatBusy || !chatInput.trim()} className="btn-primary px-4">
                Sor
              </button>
            </div>
          </section>
        )}

        {/* AI ile duzelt */}
        {plan.trim() && (
          <section className="card p-3 space-y-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">✨ Yapay zeka ile düzelt</p>
            <div className="flex gap-2">
              <input
                className="field-input flex-1"
                placeholder="örn. Kahvaltıya yumurta ekle, akşam pilavı çıkar"
                value={editInstr}
                onChange={(e) => setEditInstr(e.target.value)}
                disabled={!hasKey}
              />
              <button onClick={proposeEdit} disabled={!hasKey || editBusy || !editInstr.trim()} className="btn-primary px-4">
                {editBusy ? '…' : 'Düzenle'}
              </button>
            </div>
            {proposed != null && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Önerilen yeni liste</p>
                <textarea
                  className="field-input font-mono text-xs min-h-[160px]"
                  value={proposed}
                  onChange={(e) => setProposed(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setProposed(null)} className="btn bg-slate-200 text-slate-700">
                    Vazgeç
                  </button>
                  <button onClick={applyEdit} className="btn-primary">
                    ✅ Kaydet
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Mevcut liste (elle de duzenlenebilir) */}
        <section className="card p-3 space-y-2">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Diyet listem</p>
          <textarea
            className="field-input font-mono text-xs min-h-[180px]"
            placeholder={'Listeni buraya yaz ya da Ayarlar’dan fotoğrafını çek…'}
            value={plan}
            onChange={(e) => saveDietSettings({ dietPlan: e.target.value })}
          />
          <p className="text-[11px] text-slate-400">Elle de düzenleyebilirsin; otomatik kaydolur.</p>
        </section>

        {!hasKey && (
          <p className="text-center text-xs text-slate-400">Sor/düzelt için Ayarlar’dan API anahtarı gerekir. Listeyi elle yazmak bedava.</p>
        )}
      </div>
    </div>
  )
}

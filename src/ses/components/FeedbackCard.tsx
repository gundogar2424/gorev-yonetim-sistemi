// Yapay zeka (Claude) geri bildirimi karti: seans sonunda tek dokunusla.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getFeedback, hasApiKey } from '../lib/ai'
import { readSessions, updateSession, type Session } from '../lib/store'

export default function FeedbackCard({ session }: { session: Session }) {
  const [text, setText] = useState(session.feedback ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const keyOk = hasApiKey()

  async function al() {
    setBusy(true)
    setErr('')
    try {
      const fb = await getFeedback(session, readSessions())
      setText(fb)
      updateSession(session.id, { feedback: fb })
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="ses-card space-y-3">
      <div className="flex items-center gap-3">
        <span className="w-12 h-12 rounded-2xl bg-ses-50 dark:bg-[#352820] grid place-items-center text-[24px]">🤖</span>
        <div className="flex-1">
          <h3 className="text-[17px] font-bold text-slate-900 dark:text-[#f5ece4] leading-tight">Yapay zeka geri bildirimi</h3>
          <p className="text-[13px] text-slate-500 dark:text-[#a3908a]">Sonuçlar Claude'a gönderilir; ses kaydı gönderilmez.</p>
        </div>
      </div>
      {text ? (
        <div className="rounded-2xl bg-ses-50 dark:bg-[#352820] p-3 text-[15px] text-slate-800 dark:text-[#f5ece4] whitespace-pre-wrap leading-relaxed">{text}</div>
      ) : !keyOk ? (
        <p className="text-[14px] text-slate-500 dark:text-[#a3908a]">
          Önce <Link to="/ayarlar" className="text-ses-700 font-semibold underline">Ayarlar › Yapay zeka</Link> bölümüne Claude API anahtarını gir.
        </p>
      ) : null}
      {err && <p className="text-[14px] text-rose-600">{err}</p>}
      {keyOk && (
        <button className="ses-btn-soft w-full" onClick={al} disabled={busy}>
          {busy ? 'Değerlendiriliyor…' : text ? 'Yeniden değerlendir' : '✨ Geri bildirim al'}
        </button>
      )}
    </section>
  )
}

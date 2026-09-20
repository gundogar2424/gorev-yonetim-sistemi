// Yapay zeka (Claude) geri bildirimi karti: seans sonunda tek dokunusla.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getFeedback, hasApiKey } from '../lib/ai'
import { applyPlan, readSessions, updateSession, type NextPlan, type Session } from '../lib/store'
import { findDExercise, DTEMPO_LABEL } from '../lib/diksiyon'
import { findExercise } from '../lib/content'
import { LEVEL_LABEL } from '../lib/store'
import Icon from './Icon'

export default function FeedbackCard({ session }: { session: Session }) {
  const [text, setText] = useState(session.feedback ?? '')
  const [plan, setPlan] = useState<NextPlan | null>(session.plan ?? null)
  const [applied, setApplied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const keyOk = hasApiKey()

  async function al() {
    setBusy(true)
    setErr('')
    try {
      const fb = await getFeedback(session, readSessions())
      setText(fb.text)
      setPlan(fb.plan)
      setApplied(false)
      updateSession(session.id, { feedback: fb.text, plan: fb.plan })
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="ses-card space-y-3">
      <div className="flex items-center gap-3">
        <span className="w-12 h-12 rounded-[10px] bg-ses-50 dark:bg-sesui-dsoft grid place-items-center text-[22px]">🤖</span>
        <div className="flex-1">
          <h3 className="text-[17px] font-bold text-sesui-text dark:text-sesui-dtext leading-tight">Yapay zeka geri bildirimi</h3>
          <p className="text-[14px] text-sesui-body dark:text-sesui-dbody">Sonuçlar ve son 15 seansın eğilimi Claude'a gönderilir; ses kaydı gönderilmez. Seans başına birkaç sent.</p>
        </div>
      </div>
      {text ? (
        <div className="rounded-[10px] bg-ses-50 dark:bg-sesui-dsoft p-3 text-[16px] text-sesui-text dark:text-sesui-dtext whitespace-pre-wrap leading-relaxed">{text}</div>
      ) : !keyOk ? (
        <p className="text-[15px] text-sesui-body dark:text-sesui-dbody">
          Önce <Link to="/ayarlar" className="text-ses-700 font-semibold underline">Ayarlar › Yapay zeka</Link> bölümüne Claude API anahtarını gir.
        </p>
      ) : null}
      {text && plan && (plan.focus.length > 0 || plan.goal) && (
        <div className="rounded-[10px] border border-ses-200 dark:border-sesui-dline p-3 space-y-2">
          <div className="ses-label">Sonraki seans planı</div>
          {plan.goal && (
            <p className="flex gap-2 text-[15px] font-medium text-sesui-text dark:text-sesui-dtext">
              <Icon name="target" size={16} className="mt-0.5 text-ses-600 dark:text-ses-300" />
              <span>{plan.goal}</span>
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            <span className="ses-pill">tempo: {DTEMPO_LABEL[plan.tempo]}</span>
            <span className="ses-pill">yoğunluk: {LEVEL_LABEL[plan.level]}</span>
            {plan.focus.map((id) => {
              const e = findDExercise(id) ?? findExercise(id)
              return e ? (
                <span key={id} className="ses-pill">
                  {e.name}
                </span>
              ) : null
            })}
          </div>
          <button
            className={`w-full min-h-[50px] rounded-[10px] text-[16px] font-semibold ${applied ? 'bg-emerald-50 dark:bg-[#1f2e22] text-emerald-700 dark:text-emerald-300' : 'bg-ses-600 text-white'}`}
            onClick={() => {
              applyPlan(plan)
              setApplied(true)
            }}
            disabled={applied}
          >
            {applied ? 'Uygulandı (tempo, yoğunluk ve odak egzersizleri açıldı)' : 'Öneriyi uygula'}
          </button>
        </div>
      )}
      {err && <p className="text-[15px] text-rose-600">{err}</p>}
      {keyOk && (
        <button className="ses-btn-soft w-full" onClick={al} disabled={busy}>
          {busy ? 'Değerlendiriliyor…' : text ? 'Yeniden değerlendir' : '✨ Geri bildirim al'}
        </button>
      )}
    </section>
  )
}

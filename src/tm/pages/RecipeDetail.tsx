import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import TmHeader from '../TmHeader'
import { deleteRecipe, getRecipe, toggleFavorite } from '../db'
import { recipeToText, stepSummary } from '../lib/tm7'

export default function RecipeDetail() {
  const { id } = useParams()
  const rid = Number(id)
  const navigate = useNavigate()
  const r = useLiveQuery(() => getRecipe(rid), [rid], undefined)
  const [orijinalAcik, setOrijinalAcik] = useState(false)
  const [kopyalandi, setKopyalandi] = useState(false)

  if (!r) {
    return (
      <div>
        <TmHeader title="Tarif" back />
        <div className="px-4 py-6 text-center text-slate-400 text-sm">Tarif bulunamadı.</div>
      </div>
    )
  }

  async function paylas() {
    if (!r) return
    const metin = recipeToText(r)
    try {
      if (navigator.share) {
        await navigator.share({ title: r.title, text: metin })
        return
      }
      await navigator.clipboard.writeText(metin)
      setKopyalandi(true)
      setTimeout(() => setKopyalandi(false), 2000)
    } catch {
      /* kullanici vazgecti */
    }
  }

  async function sil() {
    if (!confirm(`"${r!.title}" tarifi silinsin mi?`)) return
    await deleteRecipe(rid)
    navigate('/')
  }

  const meta = [r.category, r.servings ? `${r.servings} kişilik` : '', r.minutes ? `${r.minutes} dk` : '']
    .filter(Boolean)
    .join(' · ')

  return (
    <div>
      <TmHeader
        title={r.title}
        subtitle={meta}
        back
        right={
          <button
            onClick={() => toggleFavorite(rid)}
            className={`w-9 h-9 rounded-full flex items-center justify-center ${
              r.favorite ? 'text-amber-400' : 'text-slate-300 dark:text-slate-600'
            }`}
            aria-label={r.favorite ? 'Favoriden çıkar' : 'Favoriye ekle'}
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill={r.favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
              <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9L3.5 9.7l5.9-.8z" strokeLinejoin="round" />
            </svg>
          </button>
        }
      />

      <div className="px-4 py-3 space-y-3">
        <Link to={`/pisir/${rid}`} className="btn-primary w-full py-3">
          ▶︎ Pişirmeye başla
        </Link>

        {r.warnings.length > 0 && (
          <div className="card p-3 bg-amber-50 dark:bg-[#252733] text-[13px] text-amber-800 space-y-1">
            {r.warnings.map((w, k) => (
              <div key={k}>⚠️ {w}</div>
            ))}
          </div>
        )}

        {r.ingredients.length > 0 && (
          <section className="card p-4">
            <h3 className="section-title mb-2">Malzemeler</h3>
            <ul className="text-sm text-slate-700 dark:text-slate-300 space-y-1">
              {r.ingredients.map((i, k) => (
                <li key={k}>• {i}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="space-y-2">
          <h3 className="section-title px-1">TM7 adımları</h3>
          {r.steps.map((s, k) => (
            <div key={k} className="card p-3">
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-brand-600 text-white text-sm font-bold flex items-center justify-center flex-shrink-0">
                  {k + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-slate-800 dark:text-[#e0e1e6]">{s.text}</div>
                  {s.ingredients && <div className="text-[12px] text-slate-500 mt-1">Kaba gir: {s.ingredients}</div>}
                  {stepSummary(s) && (
                    <div className="mt-1.5">
                      <span className="chip bg-brand-50 dark:bg-[#252733] text-brand-700">{stepSummary(s)}</span>
                    </div>
                  )}
                  {s.tip && <div className="text-[12px] text-amber-600 mt-1">💡 {s.tip}</div>}
                </div>
              </div>
            </div>
          ))}
        </section>

        {r.notes && <div className="card p-3 text-[13px] text-slate-600 dark:text-slate-300">📝 {r.notes}</div>}

        <div className="card p-3 text-[12px] text-slate-500 space-y-1">
          {r.source && <div>Kaynak: {r.source}</div>}
          <div>{r.origin === 'ai' ? 'Yapay zeka ile TM7’ye uyarlandı' : 'Elle yazıldı'}</div>
          {r.cookCount > 0 && (
            <div>
              {r.cookCount} kez pişirildi
              {r.lastCookedAt ? ` · son: ${new Date(r.lastCookedAt).toLocaleDateString('tr-TR')}` : ''}
            </div>
          )}
        </div>

        {r.originalText && (
          <div className="card p-3">
            <button
              onClick={() => setOrijinalAcik((v) => !v)}
              className="text-sm font-semibold text-brand-600 w-full text-left"
            >
              {orijinalAcik ? '▾' : '▸'} Orijinal tarif (uyarlanmadan önce)
            </button>
            {orijinalAcik && (
              <pre className="mt-2 text-[12px] text-slate-500 whitespace-pre-wrap font-sans">{r.originalText}</pre>
            )}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 pt-1">
          <Link to={`/duzenle/${rid}`} className="btn-ghost py-2.5 text-sm">
            Düzenle
          </Link>
          <button onClick={paylas} className="btn-ghost py-2.5 text-sm">
            {kopyalandi ? 'Kopyalandı' : 'Paylaş'}
          </button>
          <button onClick={sil} className="btn-danger py-2.5 text-sm">
            Sil
          </button>
        </div>
      </div>
    </div>
  )
}

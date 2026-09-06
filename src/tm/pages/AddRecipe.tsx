import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import TmHeader from '../TmHeader'
import { addRecipe } from '../db'
import { parseRecipeCode } from '../lib/recipeIO'
import { stepSummary } from '../lib/tm7'
import type { TmConversion } from '../types'

// TARIF EKLE: tarif baska bir yerde TM7 adimlarina cevrilip "tarif kodu"
// (JSON) olarak verilir; burada yapistirilip deftere eklenir.
// Uygulamanin icinde yapay zeka YOK: API anahtari, internet, ucret gerekmez.
export default function AddRecipe() {
  const navigate = useNavigate()
  const [kod, setKod] = useState('')
  const [hata, setHata] = useState('')
  const [onizleme, setOnizleme] = useState<TmConversion[] | null>(null)

  function kontrolEt() {
    setHata('')
    setOnizleme(null)
    try {
      setOnizleme(parseRecipeCode(kod).map((p) => p.recipe))
    } catch (e) {
      setHata((e as Error).message)
    }
  }

  async function ekle() {
    setHata('')
    try {
      const liste = parseRecipeCode(kod)
      let sonId = 0
      for (const { recipe, source } of liste) {
        sonId = await addRecipe(recipe, { source, origin: 'ai' })
      }
      if (liste.length === 1) navigate(`/tarif/${sonId}`)
      else navigate('/')
    } catch (e) {
      setHata((e as Error).message)
    }
  }

  async function panodanAl() {
    setHata('')
    try {
      const t = await navigator.clipboard.readText()
      if (t.trim()) setKod(t)
      else setHata('Panoda bir şey yok.')
    } catch {
      setHata('Panoya erişilemedi. Kutuya uzun basıp "Yapıştır" diyebilirsin.')
    }
  }

  return (
    <div>
      <TmHeader
        title="Tarif Ekle"
        subtitle="Hazır tarif kodunu yapıştır"
        right={
          <Link to="/yeni" className="tm-btn-soft px-3 py-2 text-sm">
            Elle yaz
          </Link>
        }
      />

      <div className="px-4 py-3 space-y-3">
        <div className="tm-card p-3 text-[13px] text-slate-600 dark:text-slate-300">
          Tarifi TM7 adımlarına çevirttiğinde sana bir <b>tarif kodu</b> verilir. Kodu buraya
          yapıştır, tarif fotoğrafı ve uyarılarıyla birlikte deftere insin. İnternet ya da ücretli
          bir anahtar gerekmez. Bir kodun içinde birden fazla tarif de olabilir.
        </div>

        <textarea
          className="tm-input min-h-[220px] font-mono text-[12px] leading-relaxed"
          placeholder={'{ "title": "Krep", "steps": [ ... ] }'}
          value={kod}
          onChange={(e) => setKod(e.target.value)}
        />

        <div className="flex gap-2">
          <button onClick={panodanAl} className="tm-btn-soft px-3 py-2.5 text-sm">
            📋 Panodan yapıştır
          </button>
          {kod && (
            <button onClick={() => { setKod(''); setOnizleme(null); setHata('') }} className="tm-btn-soft px-3 py-2.5 text-sm">
              Temizle
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <button onClick={kontrolEt} className="tm-btn-soft flex-1 py-3 text-sm">
            Önce kontrol et
          </button>
          <button onClick={ekle} className="tm-btn-primary flex-1 py-3">
            Deftere ekle
          </button>
        </div>

        {hata && (
          <div className="tm-card p-3 text-sm text-rose-600 whitespace-pre-wrap bg-rose-50 dark:bg-[#252733]">{hata}</div>
        )}

        {onizleme && <Onizleme liste={onizleme} />}
      </div>
    </div>
  )
}

// Eklemeden once ne geldigini goster: baslik, fotograf, adim ozetleri.
function Onizleme({ liste }: { liste: TmConversion[] }) {
  return (
    <section className="space-y-3">
      <div className="tm-card p-3 text-sm text-emerald-600 font-semibold bg-emerald-50 dark:bg-[#252733]">
        Kod geçerli ✔ {liste.length} tarif bulundu
      </div>
      {liste.map((r, i) => (
        <div key={i} className="tm-card overflow-hidden">
          {r.photo && <img src={r.photo} alt="" className="w-full h-40 object-cover" />}
          <div className="p-4">
            <div className="text-lg font-bold text-slate-800 dark:text-[#e0e1e6]">{r.title}</div>
            <div className="text-[12px] text-slate-500 mt-0.5">
              {[r.category, r.servings ? `${r.servings} kişilik` : '', r.minutes ? `${r.minutes} dk` : '']
                .filter(Boolean)
                .join(' · ')}
            </div>

            {r.ingredients.length > 0 && (
              <>
                <div className="tm-label mt-3 mb-1">Malzemeler ({r.ingredients.length})</div>
                <ul className="text-sm text-slate-700 dark:text-slate-300 space-y-0.5">
                  {r.ingredients.map((m, k) => (
                    <li key={k}>• {m}</li>
                  ))}
                </ul>
              </>
            )}

            <div className="tm-label mt-3 mb-1">Adımlar ({r.steps.length})</div>
            <ol className="space-y-2">
              {r.steps.map((s, k) => (
                <li key={k} className="text-sm">
                  <span className="font-semibold text-slate-800 dark:text-[#e0e1e6]">{k + 1}.</span>{' '}
                  <span className="text-slate-700 dark:text-slate-300">{s.text}</span>
                  {s.ingredients && <div className="text-[12px] text-slate-500 pl-4">Kaba gir: {s.ingredients}</div>}
                  {stepSummary(s) && (
                    <div className="pl-4">
                      <span className="chip bg-tm-50 dark:bg-[#252733] text-tm-700">{stepSummary(s)}</span>
                    </div>
                  )}
                  {s.tip && <div className="text-[12px] text-amber-600 pl-4">💡 {s.tip}</div>}
                </li>
              ))}
            </ol>

            {r.warnings.length > 0 && (
              <div className="mt-3 p-3 rounded-xl bg-amber-50 dark:bg-[#252733] text-[13px] text-amber-800 space-y-1">
                {r.warnings.map((w, k) => (
                  <div key={k}>⚠️ {w}</div>
                ))}
              </div>
            )}
            {r.notes && <p className="text-[13px] text-slate-500 mt-3">{r.notes}</p>}
          </div>
        </div>
      ))}
    </section>
  )
}

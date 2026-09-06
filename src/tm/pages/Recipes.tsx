import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import TmHeader from '../TmHeader'
import { listRecipes, toggleFavorite } from '../db'
import { CATEGORIES, durationLabel } from '../lib/tm7'
import type { TmRecipe } from '../types'

interface Props {
  onlyFavorites?: boolean
}

export default function Recipes({ onlyFavorites }: Props) {
  const all = useLiveQuery(() => listRecipes(), [], [] as TmRecipe[])
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')

  const list = all ?? []
  const base = onlyFavorites ? list.filter((r) => r.favorite) : list
  const kategoriler = Array.from(new Set(base.map((r) => r.category).filter(Boolean)))

  const arama = q.trim().toLocaleLowerCase('tr')
  const gorunen = base.filter((r) => {
    if (cat && r.category !== cat) return false
    if (!arama) return true
    const havuz = `${r.title} ${r.category} ${r.ingredients.join(' ')} ${r.source}`.toLocaleLowerCase('tr')
    return havuz.includes(arama)
  })

  return (
    <div>
      <TmHeader
        title={onlyFavorites ? 'Favoriler' : 'Tarif Defteri'}
        subtitle={onlyFavorites ? 'Yıldızladığın tarifler' : `${list.length} tarif · Thermomix TM7`}
        right={
          !onlyFavorites ? (
            <Link to="/ekle" className="btn-primary px-3.5 py-2 text-sm">
              + Tarif
            </Link>
          ) : undefined
        }
      />

      <div className="px-4 py-3 space-y-3">
        {base.length > 0 && (
          <>
            <input
              className="field-input"
              placeholder="Tarif ya da malzeme ara…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {kategoriler.length > 0 && (
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                <Chip active={cat === ''} onClick={() => setCat('')} label="Hepsi" />
                {kategoriler.map((k) => (
                  <Chip key={k} active={cat === k} onClick={() => setCat(cat === k ? '' : k)} label={k} />
                ))}
              </div>
            )}
          </>
        )}

        {base.length === 0 && (
          <div className="card p-6 text-center">
            <div className="text-5xl mb-2">🍲</div>
            <p className="text-slate-600 dark:text-slate-300 font-medium mb-1">
              {onlyFavorites ? 'Henüz favori tarif yok.' : 'Defter boş.'}
            </p>
            <p className="text-sm text-slate-500 mb-4">
              {onlyFavorites
                ? 'Bir tarifi açıp yıldıza basınca burada görünür.'
                : 'Hazır tarif kodunu yapıştır ya da tarifini elle yaz.'}
            </p>
            {!onlyFavorites && (
              <div className="flex gap-2 justify-center">
                <Link to="/ekle" className="btn-primary px-4 py-2 text-sm">
                  Tarif ekle
                </Link>
                <Link to="/yeni" className="btn-ghost px-4 py-2 text-sm">
                  Elle yaz
                </Link>
              </div>
            )}
          </div>
        )}

        {base.length > 0 && gorunen.length === 0 && (
          <div className="card p-6 text-center text-slate-400 text-sm">Aramana uyan tarif yok.</div>
        )}

        {/* Kategori secili degilse tarifler kategori basliklari altinda toplanir;
            secildiginde ya da arama yapilirken duz liste daha okunakli. */}
        {cat || arama ? (
          <div className="space-y-2">
            {gorunen.map((r) => (
              <RecipeRow key={r.id} r={r} />
            ))}
          </div>
        ) : (
          gruplaKategoriye(gorunen).map(([kategori, tarifler]) => (
            <section key={kategori} className="space-y-2">
              <h3 className="section-title px-1 pt-1">
                {kategori} <span className="text-slate-400 font-normal">({tarifler.length})</span>
              </h3>
              {tarifler.map((r) => (
                <RecipeRow key={r.id} r={r} />
              ))}
            </section>
          ))
        )}
      </div>
    </div>
  )
}

// Liste satirindaki kucuk fotograf. Uzaktaki bir adres internetsizken
// yuklenemez; kirik resim simgesi yerine tencere simgesi gosterilir.
function Kucukfoto({ src }: { src: string }) {
  const [hata, setHata] = useState(false)
  if (!src || hata) {
    return (
      <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-[#2f3240] flex items-center justify-center text-xl flex-shrink-0">
        🍲
      </div>
    )
  }
  return (
    <img
      src={src}
      alt=""
      onError={() => setHata(true)}
      className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
    />
  )
}

// Tarifleri kategoriye gore grupla. Sira CATEGORIES listesindeki sira; listede
// olmayan bir kategori (elle yazilmis olabilir) sonda, alfabetik durur.
function gruplaKategoriye(liste: TmRecipe[]): [string, TmRecipe[]][] {
  const gruplar = new Map<string, TmRecipe[]>()
  for (const r of liste) {
    const k = r.category?.trim() || 'Diğer'
    const mevcut = gruplar.get(k)
    if (mevcut) mevcut.push(r)
    else gruplar.set(k, [r])
  }
  return Array.from(gruplar.entries()).sort(([a], [b]) => {
    const ia = CATEGORIES.indexOf(a)
    const ib = CATEGORIES.indexOf(b)
    if (ia === -1 && ib === -1) return a.localeCompare(b, 'tr')
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`chip flex-shrink-0 border ${
        active
          ? 'bg-brand-600 text-white border-brand-600'
          : 'bg-white dark:bg-[#252733] text-slate-600 border-slate-200 dark:border-[#2f3240]'
      }`}
    >
      {label}
    </button>
  )
}

function RecipeRow({ r }: { r: TmRecipe }) {
  const meta = [
    r.category,
    r.servings ? `${r.servings} kişilik` : '',
    r.minutes ? durationLabel(r.minutes * 60) : '',
    `${r.steps.length} adım`
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="card p-3 flex items-center gap-3">
      <Kucukfoto src={r.photo} />
      <Link to={`/tarif/${r.id}`} className="flex-1 min-w-0">
        <div className="font-semibold text-slate-800 dark:text-[#e0e1e6] truncate">{r.title}</div>
        <div className="text-[12px] text-slate-500 truncate">{meta}</div>
        {r.cookCount > 0 && <div className="text-[11px] text-emerald-600 mt-0.5">{r.cookCount} kez pişirildi</div>}
      </Link>
      <button
        onClick={() => r.id && toggleFavorite(r.id)}
        className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
          r.favorite ? 'text-amber-400' : 'text-slate-300 dark:text-slate-600'
        }`}
        aria-label={r.favorite ? 'Favoriden çıkar' : 'Favoriye ekle'}
      >
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill={r.favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
          <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9L3.5 9.7l5.9-.8z" strokeLinejoin="round" />
        </svg>
      </button>
      <Link
        to={`/pisir/${r.id}`}
        className="flex-shrink-0 btn-primary px-3 py-2 text-sm"
        aria-label="Pişirme modunu başlat"
      >
        Pişir
      </Link>
    </div>
  )
}

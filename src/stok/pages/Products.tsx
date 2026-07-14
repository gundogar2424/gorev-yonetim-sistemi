import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { listProducts, changeStock, readStokSettings } from '../db'
import type { Product } from '../types'

// Fotoğrafı olmayan ürün için basit yer tutucu (kutu simgesi)
function Placeholder() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600">
      <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth={1.6}>
        <path d="M21 8l-9-5-9 5 9 5 9-5z" />
        <path d="M3 8v8l9 5 9-5V8" />
        <line x1="12" y1="13" x2="12" y2="21" />
      </svg>
    </div>
  )
}

export default function Products() {
  const navigate = useNavigate()
  const products = useLiveQuery(() => listProducts(), [], undefined as Product[] | undefined)
  const settings = useLiveQuery(() => readStokSettings(), [])
  const currency = settings?.currency || '₺'

  const [q, setQ] = useState('')
  const [onlyLow, setOnlyLow] = useState(false)
  const [company, setCompany] = useState('')

  // Firma filtresi için benzersiz firma listesi
  const companies = useMemo(() => {
    const set = new Set<string>()
    products?.forEach((p) => p.company?.trim() && set.add(p.company.trim()))
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'tr'))
  }, [products])

  const filtered = useMemo(() => {
    if (!products) return undefined
    const needle = q.trim().toLocaleLowerCase('tr-TR')
    return products.filter((p) => {
      if (company && (p.company || '') !== company) return false
      if (onlyLow) {
        const th = p.lowStock ?? 0
        if (!(th > 0 ? p.qty <= th : p.qty === 0)) return false
      }
      if (!needle) return true
      return [p.name, p.company, p.category, p.code, p.note]
        .filter(Boolean)
        .some((s) => String(s).toLocaleLowerCase('tr-TR').includes(needle))
    })
  }, [products, q, onlyLow, company])

  const totalUnits = useMemo(() => (products ? products.reduce((s, p) => s + (p.qty || 0), 0) : 0), [products])

  const isLow = (p: Product) => {
    const th = p.lowStock ?? 0
    return th > 0 ? p.qty <= th : p.qty === 0
  }

  return (
    <div>
      {/* Başlık + özet */}
      <header className="px-4 pt-5 pb-3">
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">
          {settings?.shopName?.trim() || 'Stok Takip'}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          {products == null
            ? 'Yükleniyor…'
            : `${products.length} çeşit ürün · toplam ${totalUnits} adet`}
        </p>
      </header>

      {/* Arama */}
      <div className="px-4 space-y-2">
        <div className="relative">
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ürün, firma, kod ara…"
            className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        {/* Filtreler */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setOnlyLow((v) => !v)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-sm border transition-colors ${
              onlyLow
                ? 'bg-amber-500 border-amber-500 text-white'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            ⚠️ Azalan / biten
          </button>
          {companies.length > 0 && (
            <select
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="shrink-0 px-3 py-1.5 rounded-full text-sm border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 focus:outline-none"
            >
              <option value="">Tüm firmalar</option>
              {companies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Liste */}
      <div className="px-4 mt-2">
        {filtered == null ? null : filtered.length === 0 ? (
          <EmptyState hasAny={(products?.length ?? 0) > 0} onAdd={() => navigate('/ekle')} />
        ) : (
          <div className="grid grid-cols-2 gap-3 pb-4">
            {filtered.map((p) => (
              <div
                key={p.id}
                className="rounded-2xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-card flex flex-col"
              >
                {/* Fotoğraf */}
                <button
                  onClick={() => navigate(`/duzenle/${p.id}`)}
                  className="relative block aspect-square w-full"
                >
                  {p.photo ? (
                    <img src={p.photo} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <Placeholder />
                  )}
                  {isLow(p) && (
                    <span className="absolute top-2 left-2 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500 text-white shadow">
                      {p.qty === 0 ? 'Bitti' : 'Azaldı'}
                    </span>
                  )}
                </button>

                {/* Bilgi */}
                <div className="p-2.5 flex flex-col gap-0.5 flex-1">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug line-clamp-2">
                    {p.name}
                  </p>
                  {p.company && <p className="text-xs text-slate-400 truncate">{p.company}</p>}
                  {p.salePrice != null && p.salePrice > 0 && (
                    <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                      {p.salePrice.toLocaleString('tr-TR')} {currency}
                    </p>
                  )}

                  {/* Adet kontrolü */}
                  <div className="mt-1.5 flex items-center justify-between gap-1">
                    <button
                      onClick={() => p.id != null && changeStock(p.id, -1, 'cikis', 'Satış/çıkış')}
                      className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-lg font-bold flex items-center justify-center active:scale-95"
                      aria-label="Bir azalt"
                    >
                      −
                    </button>
                    <span
                      className={`min-w-[2.5rem] text-center font-bold tabular-nums ${
                        isLow(p) ? 'text-amber-600 dark:text-amber-400' : 'text-slate-800 dark:text-slate-100'
                      }`}
                    >
                      {p.qty}
                      <span className="text-[10px] font-normal text-slate-400 ml-0.5">{p.unit || 'adet'}</span>
                    </span>
                    <button
                      onClick={() => p.id != null && changeStock(p.id, +1, 'giris', 'Giriş')}
                      className="h-8 w-8 rounded-lg bg-indigo-600 text-white text-lg font-bold flex items-center justify-center active:scale-95"
                      aria-label="Bir artır"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function EmptyState({ hasAny, onAdd }: { hasAny: boolean; onAdd: () => void }) {
  return (
    <div className="text-center py-16 px-6">
      <div className="mx-auto h-16 w-16 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center mb-4">
        <svg viewBox="0 0 24 24" className="h-8 w-8 text-indigo-500" fill="none" stroke="currentColor" strokeWidth={1.6}>
          <path d="M21 8l-9-5-9 5 9 5 9-5z" />
          <path d="M3 8v8l9 5 9-5V8" />
          <line x1="12" y1="13" x2="12" y2="21" />
        </svg>
      </div>
      {hasAny ? (
        <p className="text-slate-500 dark:text-slate-400">Aramanıza uygun ürün bulunamadı.</p>
      ) : (
        <>
          <p className="text-slate-700 dark:text-slate-200 font-medium">Henüz ürün yok</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-5">
            İlk ürününüzü fotoğrafıyla ekleyin; burada kart kart görünsün.
          </p>
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-medium active:scale-95"
          >
            + Ürün ekle
          </button>
        </>
      )}
    </div>
  )
}

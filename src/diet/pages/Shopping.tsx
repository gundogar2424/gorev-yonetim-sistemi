import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import DietHeader from '../DietHeader'
import {
  listShopping,
  addShopping,
  addShoppingMany,
  toggleShopping,
  deleteShopping,
  clearDoneShopping,
  readDietSettings
} from '../db'
import { suggestShopping } from '../ai'
import { buildHealthContext } from '../lib/context'
import type { ShoppingItem, ShoppingSuggestion, ShoppingSuggestItem } from '../types'

export default function Shopping() {
  const items = useLiveQuery(() => listShopping(), [], [])
  const settings = useLiveQuery(() => readDietSettings(), [], undefined)
  const [text, setText] = useState('')

  async function add() {
    const t = text.trim()
    if (!t) return
    await addShopping(t)
    setText('')
  }

  const list = items ?? []
  const pending = list.filter((i) => !i.done)
  const done = list.filter((i) => i.done)
  const allGroups = groupByCategory(list)

  return (
    <div>
      <DietHeader title="Alışveriş Listesi" subtitle="Sağlıklı alışveriş" />

      <div className="p-3 space-y-4">
        {/* Diyet listesine gore otomatik oneri */}
        <SuggestFromPlan
          apiKey={settings?.apiKey}
          dietPlan={settings?.dietPlan}
          model={settings?.model}
          userName={settings?.userName}
          goal={settings?.goal}
        />

        <div className="flex gap-2">
          <input
            className="field-input"
            placeholder="örn. yulaf, yumurta, brokoli"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') add()
            }}
          />
          <button onClick={add} className="btn-primary px-4">
            Ekle
          </button>
        </div>

        {list.length === 0 && (
          <div className="card p-6 text-center text-slate-400 text-sm">
            <div className="text-5xl mb-2">🛒</div>
            Liste boş. Almak istediklerini ekle ya da diyetine göre öneri al.
          </div>
        )}

        {/* Tum urunler — kategoriye gore gruplanir; tik atinca yerinde kalir,
            istediginde tekrar dokununca tiki kalkar */}
        {list.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                Liste ({pending.length} kaldı{done.length ? ` · ${done.length} alındı` : ''})
              </h3>
              {done.length > 0 && (
                <button onClick={clearDoneShopping} className="text-xs text-rose-500 underline">
                  Alınanları temizle
                </button>
              )}
            </div>
            {allGroups.map(([cat, group]) => (
              <div key={cat} className="space-y-2">
                {cat && <p className="text-xs font-bold text-emerald-700 px-1">{cat}</p>}
                {group.map((i) => (
                  <div key={i.id} className={`card p-3 flex items-center gap-3 ${i.done ? 'opacity-60' : ''}`}>
                    <button
                      onClick={() => toggleShopping(i.id!, !i.done)}
                      className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                        i.done ? 'bg-emerald-500 text-white' : 'border-2 border-emerald-500'
                      }`}
                      aria-label={i.done ? 'Tiki kaldır' : 'Tamamla'}
                    >
                      {i.done ? '✓' : ''}
                    </button>
                    <div className="flex-1 min-w-0">
                      <span className={i.done ? 'text-slate-500 line-through' : 'text-slate-700'}>{i.text}</span>
                      {i.meals && i.meals.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {i.meals.map((m) => (
                            <span
                              key={m}
                              className="text-[10px] font-semibold bg-amber-100 text-amber-800 rounded-full px-1.5 py-0.5"
                            >
                              🍽️ {m}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button onClick={() => deleteShopping(i.id!)} className="text-slate-300 hover:text-rose-500">
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  )
}

// Diyet listesine gore kategorili alisveris onerisi uretir (yapay zeka)
function SuggestFromPlan({
  apiKey,
  dietPlan,
  model,
  userName,
  goal
}: {
  apiKey?: string
  dietPlan?: string
  model?: string
  userName?: string
  goal?: string
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ShoppingSuggestion | null>(null)
  const [days, setDays] = useState(7)
  const [added, setAdded] = useState<Set<string>>(new Set())

  const hasKey = !!apiKey
  const hasPlan = !!dietPlan?.trim()

  async function suggest() {
    setError('')
    setResult(null)
    setAdded(new Set())
    setBusy(true)
    try {
      const health = await buildHealthContext(await readDietSettings())
      const res = await suggestShopping({ apiKey: apiKey!, dietPlan: dietPlan ?? '', days, model, userName, goal, health })
      setResult(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Öneri alınamadı.')
    } finally {
      setBusy(false)
    }
  }

  async function addOne(cat: string, item: ShoppingSuggestItem) {
    await addShopping(item.name, cat, item.meals)
    setAdded((s) => new Set(s).add(cat + '|' + item.name))
  }

  async function addAll() {
    if (!result) return
    const all: { text: string; category: string; meals: string[] }[] = []
    for (const c of result.categories)
      for (const it of c.items) all.push({ text: it.name, category: c.name, meals: it.meals })
    await addShoppingMany(all)
    setAdded(new Set(all.map((a) => a.category + '|' + a.text)))
  }

  return (
    <section className="card p-3 space-y-2 bg-emerald-50 border-emerald-100">
      <h3 className="font-bold text-emerald-800 text-sm uppercase tracking-wide">🤖 Diyetime Göre Liste Çıkar</h3>
      {!hasKey ? (
        <p className="text-xs text-slate-500">
          Yapay zeka önerisi için{' '}
          <Link to="/ayarlar" className="underline font-semibold">
            Ayarlar
          </Link>
          ’dan API anahtarı ekle.
        </p>
      ) : !hasPlan ? (
        <p className="text-xs text-slate-500">
          Önce diyet listeni ekle (
          <Link to="/menu" className="underline font-semibold">
            Menü
          </Link>{' '}
          ya da{' '}
          <Link to="/ayarlar" className="underline font-semibold">
            Ayarlar
          </Link>
          ), sonra burada diyetine göre alışveriş listesi çıkarayım.
        </p>
      ) : (
        <>
          <p className="text-xs text-slate-500">
            Diyet listendeki öğünleri yapabilmen için gereken ürünleri kategorilere ayırıp çıkarır.
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Kaç günlük:</span>
            {[3, 7, 14].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`text-xs font-semibold rounded-lg px-2.5 py-1 ${
                  days === d ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
                }`}
              >
                {d} gün
              </button>
            ))}
          </div>
          <button onClick={suggest} disabled={busy} className="btn-primary w-full">
            {busy ? 'Hazırlanıyor…' : '🪄 Listeyi çıkar'}
          </button>
          <p className="text-[11px] text-slate-400">Bu özellik token kullanır (küçük, tek seferlik).</p>
        </>
      )}

      {error && <p className="text-xs text-rose-600 font-semibold">{error}</p>}

      {result && (
        <div className="space-y-3 pt-1">
          {result.note && <p className="text-xs text-emerald-700 font-medium">{result.note}</p>}
          {result.categories.map((c) => (
            <div key={c.name} className="bg-white rounded-xl p-2.5 space-y-1.5">
              <p className="text-xs font-bold text-slate-600">{c.name}</p>
              <div className="flex flex-wrap gap-1.5">
                {c.items.map((it) => {
                  const isAdded = added.has(c.name + '|' + it.name)
                  return (
                    <button
                      key={it.name}
                      onClick={() => addOne(c.name, it)}
                      disabled={isAdded}
                      className={`text-xs font-semibold rounded-full px-2.5 py-1 ${
                        isAdded ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {isAdded ? '✓ ' : '+ '}
                      {it.name}
                      {it.meals.length > 0 && <span className="opacity-70"> · {it.meals.join(', ')}</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
          <button onClick={addAll} className="btn bg-emerald-600 text-white w-full">
            Tümünü listeye ekle
          </button>
        </div>
      )}
    </section>
  )
}

// Bekleyen urunleri kategoriye gore gruplar (kategorisizler en sonda, baslıksız)
function groupByCategory(items: ShoppingItem[]): [string, ShoppingItem[]][] {
  const map = new Map<string, ShoppingItem[]>()
  for (const i of items) {
    const key = i.category?.trim() || ''
    const arr = map.get(key) ?? []
    arr.push(i)
    map.set(key, arr)
  }
  // Kategorili olanlar once, kategorisiz ('') en sonda
  return Array.from(map.entries()).sort((a, b) => {
    if (a[0] === '') return 1
    if (b[0] === '') return -1
    return a[0].localeCompare(b[0], 'tr')
  })
}

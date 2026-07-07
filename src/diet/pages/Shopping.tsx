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
import type { ShoppingItem, ShoppingSuggestion } from '../types'

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
  // Sade: kategori/öğün YOK. Tik atılmayan = alınacak (elimizde yok), tik atılan = alındı.
  const pending = list.filter((i) => !i.done)
  const done = list.filter((i) => i.done)

  return (
    <div>
      <DietHeader title="Alışveriş Listesi" subtitle="Tik at = alındı · tik yok = elimizde yok" />

      <div className="p-3 space-y-4">
        {/* Diyet listesine gore otomatik oneri (sade — dogrudan urunler) */}
        <SuggestFromPlan
          apiKey={settings?.apiKey}
          dietPlan={settings?.dietPlan}
          model={settings?.model}
          userName={settings?.userName}
          goal={settings?.goal}
        />

        {/* Elle urun ekle */}
        <div className="flex gap-2">
          <input
            className="field-input"
            placeholder="Ürün ekle: örn. yumurta"
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

        {/* ALINACAKLAR (elimizde yok) — tik atılmamışlar */}
        {pending.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide px-1">
              🛒 Alınacaklar ({pending.length})
            </h3>
            {pending.map((i) => (
              <Row key={i.id} i={i} />
            ))}
          </section>
        )}

        {/* ALINDI — tik atılmışlar (altta, üstü çizili) */}
        {done.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide">✓ Alındı ({done.length})</h3>
              <button onClick={clearDoneShopping} className="text-xs text-rose-500 underline">
                Temizle
              </button>
            </div>
            {done.map((i) => (
              <Row key={i.id} i={i} />
            ))}
          </section>
        )}
      </div>
    </div>
  )
}

// Tek satır: yuvarlak tik + ürün adı + sil. Kategori/öğün yok.
function Row({ i }: { i: ShoppingItem }) {
  return (
    <div className={`card p-3 flex items-center gap-3 ${i.done ? 'opacity-60' : ''}`}>
      <button
        onClick={() => toggleShopping(i.id!, !i.done)}
        className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
          i.done ? 'bg-emerald-500 text-white' : 'border-2 border-emerald-500'
        }`}
        aria-label={i.done ? 'Tiki kaldır' : 'Alındı işaretle'}
      >
        {i.done ? '✓' : ''}
      </button>
      <span className={`flex-1 min-w-0 ${i.done ? 'text-slate-500 line-through' : 'text-slate-800 font-medium'}`}>
        {i.text}
      </span>
      <button onClick={() => deleteShopping(i.id!)} className="text-slate-300 hover:text-rose-500">
        🗑️
      </button>
    </div>
  )
}

// Diyet listesine gore SADE alisveris onerisi (kategori/ogun etiketi olmadan,
// duz urun listesi). Cift urunler tekillestirilir.
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
  const [names, setNames] = useState<string[] | null>(null)
  const [note, setNote] = useState('')
  const [days, setDays] = useState(7)
  const [added, setAdded] = useState<Set<string>>(new Set())

  const hasKey = !!apiKey
  const hasPlan = !!dietPlan?.trim()

  async function suggest() {
    setError('')
    setNames(null)
    setNote('')
    setAdded(new Set())
    setBusy(true)
    try {
      const health = await buildHealthContext(await readDietSettings())
      const res: ShoppingSuggestion = await suggestShopping({ apiKey: apiKey!, dietPlan: dietPlan ?? '', days, model, userName, goal, health })
      // Kategorileri düz listeye indir + tekilleştir (öğün/kategori gösterme)
      const seen = new Set<string>()
      const flat: string[] = []
      for (const c of res.categories)
        for (const it of c.items) {
          const key = it.name.trim().toLowerCase()
          if (key && !seen.has(key)) {
            seen.add(key)
            flat.push(it.name.trim())
          }
        }
      setNames(flat)
      setNote(res.note || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Öneri alınamadı.')
    } finally {
      setBusy(false)
    }
  }

  async function addOne(name: string) {
    await addShopping(name)
    setAdded((s) => new Set(s).add(name.toLowerCase()))
  }

  async function addAll() {
    if (!names) return
    await addShoppingMany(names.map((n) => ({ text: n })))
    setAdded(new Set(names.map((n) => n.toLowerCase())))
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
          <p className="text-xs text-slate-500">Diyetindeki öğünler için gereken ürünleri düz bir liste olarak çıkarır.</p>
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

      {names && (
        <div className="space-y-2 pt-1">
          {note && <p className="text-xs text-emerald-700 font-medium">{note}</p>}
          <div className="flex flex-wrap gap-1.5">
            {names.map((n) => {
              const isAdded = added.has(n.toLowerCase())
              return (
                <button
                  key={n}
                  onClick={() => addOne(n)}
                  disabled={isAdded}
                  className={`text-xs font-semibold rounded-full px-2.5 py-1 ${
                    isAdded ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-700'
                  }`}
                >
                  {isAdded ? '✓ ' : '+ '}
                  {n}
                </button>
              )
            })}
          </div>
          <button onClick={addAll} className="btn bg-emerald-600 text-white w-full">
            Tümünü listeye ekle
          </button>
        </div>
      )}
    </section>
  )
}

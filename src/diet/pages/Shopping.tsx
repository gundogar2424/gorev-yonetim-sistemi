import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import DietHeader from '../DietHeader'
import { listShopping, addShopping, toggleShopping, deleteShopping, clearDoneShopping } from '../db'

export default function Shopping() {
  const items = useLiveQuery(() => listShopping(), [], [])
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

  return (
    <div>
      <DietHeader title="Alışveriş Listesi" subtitle="Sağlıklı alışveriş" />

      <div className="p-3 space-y-4">
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
            Liste boş. Almak istediklerini ekle.
          </div>
        )}

        {/* Alinacaklar */}
        {pending.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide px-1">Alınacaklar ({pending.length})</h3>
            {pending.map((i) => (
              <div key={i.id} className="card p-3 flex items-center gap-3">
                <button
                  onClick={() => toggleShopping(i.id!, true)}
                  className="w-6 h-6 rounded-full border-2 border-emerald-500 flex-shrink-0"
                  aria-label="Tamamla"
                />
                <span className="flex-1 text-slate-700">{i.text}</span>
                <button onClick={() => deleteShopping(i.id!)} className="text-slate-300 hover:text-rose-500">
                  🗑️
                </button>
              </div>
            ))}
          </section>
        )}

        {/* Alinanlar */}
        {done.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide">Alındı ({done.length})</h3>
              <button onClick={clearDoneShopping} className="text-xs text-rose-500 underline">
                Temizle
              </button>
            </div>
            {done.map((i) => (
              <div key={i.id} className="card p-3 flex items-center gap-3 opacity-60">
                <button
                  onClick={() => toggleShopping(i.id!, false)}
                  className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center flex-shrink-0"
                  aria-label="Geri al"
                >
                  ✓
                </button>
                <span className="flex-1 text-slate-500 line-through">{i.text}</span>
                <button onClick={() => deleteShopping(i.id!)} className="text-slate-300 hover:text-rose-500">
                  🗑️
                </button>
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  )
}

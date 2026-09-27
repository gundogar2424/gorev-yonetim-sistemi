import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { addToShopping, lzDb } from '../db'
import type { LzShopItem } from '../types'
import { Header, Icon, T_BASLIK, T_GOVDE, T_SOLUK, Toast, useToast } from '../components/ui'
import { REYONLAR, reyonBul } from '../lib/qty'

// ALISVERIS LISTESI: tariflerden ya da elle eklenen malzemeler. Market
// reyonuna gore (manav, kasap, sut urunleri...) ya da tarife gore gruplanir.
export default function Shopping() {
  const liste = useLiveQuery(() => lzDb.shopping.orderBy('createdAt').toArray(), [], [] as LzShopItem[]) ?? []
  const [yeni, setYeni] = useState('')
  const [grup, setGrup] = useState<'reyon' | 'tarif'>(() => {
    try {
      return localStorage.getItem('lz-shop-grup') === 'tarif' ? 'tarif' : 'reyon'
    } catch {
      return 'reyon'
    }
  })
  const [toast, goster] = useToast()

  const acik = liste.filter((i) => !i.done)
  const alinan = liste.filter((i) => i.done)

  const gruplar: [string, string, LzShopItem[]][] = []
  if (grup === 'reyon') {
    const sira = [...REYONLAR.map((r) => [r.ad, r.emoji] as const), ['Diğer', '🛒'] as const]
    for (const [ad, emoji] of sira) {
      const x = acik.filter((i) => reyonBul(i.text) === ad)
      if (x.length) gruplar.push([ad, emoji, x])
    }
  } else {
    const adlar = Array.from(new Set(acik.map((i) => i.recipeTitle || 'Elle eklenenler')))
    for (const ad of adlar) gruplar.push([ad, '🍲', acik.filter((i) => (i.recipeTitle || 'Elle eklenenler') === ad)])
  }

  const ekle = async () => {
    const satirlar = yeni.split(/\n|,/)
    await addToShopping(satirlar)
    setYeni('')
  }

  const paylas = async () => {
    const metin = ['🛒 Alışveriş listesi', ...gruplar.flatMap(([ad, emoji, x]) => ['', `${emoji} ${ad}`, ...x.map((i) => `☐ ${i.text}`)])].join('\n')
    try {
      if (navigator.share) await navigator.share({ title: 'Alışveriş listesi', text: metin })
      else {
        await navigator.clipboard.writeText(metin)
        goster('Liste panoya kopyalandı')
      }
    } catch {
      /* vazgecildi */
    }
  }

  const grupDegis = (g: 'reyon' | 'tarif') => {
    setGrup(g)
    try {
      localStorage.setItem('lz-shop-grup', g)
    } catch {
      /* yok say */
    }
  }

  return (
    <div>
      <Header
        title="Alışveriş"
        subtitle={acik.length ? `${acik.length} ürün alınacak` : 'Liste boş'}
        right={
          acik.length > 0 && (
            <button onClick={() => void paylas()} className="w-10 h-10 rounded-full bg-white dark:bg-[#221d1a] flex items-center justify-center" aria-label="Listeyi paylaş">
              <Icon name="share" />
            </button>
          )
        }
      />
      <div className="px-4 space-y-3 pb-6">
        <div className="flex gap-2">
          <input
            className="lz-input"
            placeholder="Ürün ekle (örn. 1 kg domates)"
            value={yeni}
            onChange={(e) => setYeni(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void ekle()}
          />
          <button className="lz-btn-primary px-4 flex-shrink-0" disabled={!yeni.trim()} onClick={() => void ekle()} aria-label="Ekle">
            <Icon name="plus" />
          </button>
        </div>

        {acik.length > 0 && (
          <div className="grid grid-cols-2 bg-[#f3ebe2] dark:bg-[#221d1a] rounded-full p-1">
            {(['reyon', 'tarif'] as const).map((g) => (
              <button
                key={g}
                onClick={() => grupDegis(g)}
                className={`py-1.5 rounded-full text-[13px] font-semibold transition ${grup === g ? 'bg-white dark:bg-[#2f2824] text-lz-600 shadow-sm' : 'text-[#8c7d72]'}`}
              >
                {g === 'reyon' ? 'Reyona göre' : 'Tarife göre'}
              </button>
            ))}
          </div>
        )}

        {liste.length === 0 && (
          <div className="lz-card p-6 text-center">
            <div className="text-5xl mb-2">🛒</div>
            <p className={`font-semibold mb-1 ${T_BASLIK}`}>Liste boş</p>
            <p className={`text-sm ${T_SOLUK}`}>Bir tarifte “Alışveriş listesine ekle”ye bas ya da Bu Hafta’daki planın malzemelerini tek dokunuşla ekle.</p>
          </div>
        )}

        {gruplar.map(([ad, emoji, x]) => (
          <div key={ad} className="lz-card p-3.5">
            <div className="lz-label mb-1 px-1">
              {emoji} {ad}
            </div>
            <ul>
              {x.map((i) => (
                <Satir key={i.id} i={i} />
              ))}
            </ul>
          </div>
        ))}

        {alinan.length > 0 && (
          <div className="lz-card p-3.5">
            <div className="flex items-center justify-between mb-1 px-1">
              <span className="lz-label">✓ Alınanlar · {alinan.length}</span>
              <button className="text-[13px] font-semibold text-lz-600" onClick={() => void lzDb.shopping.bulkDelete(alinan.map((i) => i.id!))}>
                Temizle
              </button>
            </div>
            <ul>
              {alinan.map((i) => (
                <Satir key={i.id} i={i} />
              ))}
            </ul>
          </div>
        )}

        {liste.length > 0 && (
          <button
            className={`text-[13px] w-full py-2 ${T_SOLUK}`}
            onClick={() => {
              if (confirm('Tüm liste silinsin mi?')) void lzDb.shopping.clear()
            }}
          >
            Listeyi tamamen temizle
          </button>
        )}
      </div>
      <Toast text={toast} />
    </div>
  )
}

function Satir({ i }: { i: LzShopItem }) {
  return (
    <li className="flex items-center gap-3 py-2 px-1">
      <input
        type="checkbox"
        className="w-5 h-5 flex-shrink-0"
        checked={!!i.done}
        onChange={() => void lzDb.shopping.update(i.id!, { done: i.done ? 0 : 1 })}
      />
      <span className={`flex-1 text-[15px] leading-snug ${i.done ? 'line-through opacity-50' : ''} ${T_GOVDE}`}>{i.text}</span>
      <button onClick={() => void lzDb.shopping.delete(i.id!)} className={`w-7 h-7 flex items-center justify-center ${T_SOLUK}`} aria-label="Sil">
        <Icon name="x" className="w-4 h-4" />
      </button>
    </li>
  )
}

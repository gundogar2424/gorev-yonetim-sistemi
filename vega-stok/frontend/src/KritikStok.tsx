import { useState } from 'react'
import { kritikStokGetir } from './api'
import { adet, Gorsel, Hata, tarih, terminGecti, useVeri } from './ortak'
import { UrunDetay } from './UrunDetay'

/** Sipariş gerektirenler: Depo Stoğu + Yoldaki Sipariş < Kritik Eşik */
export function KritikStok() {
  const { veri, hata, yenile } = useVeri(kritikStokGetir)
  const [seciliId, setSeciliId] = useState<number | null>(null)

  return (
    <>
      <div className="py-3">
        <h1 className="text-xl font-semibold">Sipariş Gerektirenler</h1>
        <p className="text-sm text-slate-500">Depo stoğu + yoldaki sipariş, kritik eşiğin altında kalan ürünler. En acil olan en üstte.</p>
      </div>
      <Hata mesaj={hata} />
      {veri?.length === 0 && <p className="py-16 text-center text-slate-500">Sipariş gerektiren ürün yok.</p>}
      <ul className="space-y-2">
        {veri?.map((u) => (
          <li key={u.id}>
            <button onClick={() => setSeciliId(u.id)} className="flex w-full items-center gap-3 rounded-xl bg-white p-2 pr-4 text-left shadow-sm ring-1 ring-slate-200 hover:ring-blue-400">
              <Gorsel urun={u} boyut="kart" className="size-16 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{u.ad}</p>
                <p className="text-sm text-slate-500">
                  Depoda <b className={u.stok <= 0 ? 'text-red-600' : 'text-slate-700'}>{adet.format(u.stok)}</b> · Yolda <b className="text-slate-700">{adet.format(u.yoldaki)}</b> · Eşik{' '}
                  {adet.format(u.kritikEsik ?? 0)}
                </p>
                {u.yoldaki > 0 && (
                  <p className={`text-xs ${terminGecti(u.termin) ? 'font-medium text-red-600' : 'text-slate-500'}`}>
                    {u.tedarikci} · {terminGecti(u.termin) ? `Termin geçti (${tarih(u.termin)})` : tarih(u.termin)}
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs text-slate-500">Eksik</p>
                <p className="text-lg font-bold text-red-600">{adet.format(u.eksik)}</p>
              </div>
            </button>
          </li>
        ))}
      </ul>
      {seciliId !== null && <UrunDetay id={seciliId} kapat={() => setSeciliId(null)} degisti={yenile} />}
    </>
  )
}

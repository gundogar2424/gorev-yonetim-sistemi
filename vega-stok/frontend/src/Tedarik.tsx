import { useState } from 'react'
import { acikSiparisleriGetir } from './api'
import { adet, Gorsel, gecikmeGun, Hata, tarih, useVeri } from './ortak'
import { UrunDetay } from './UrunDetay'

/** Tedarikçilere verilmiş tüm açık siparişler; termini geçenler en üstte ve kırmızı. */
export function Tedarik() {
  const { veri, hata, yenile } = useVeri(acikSiparisleriGetir)
  const [seciliId, setSeciliId] = useState<number | null>(null)
  const geciken = veri?.filter((s) => s.gecikti).length ?? 0

  return (
    <>
      <div className="py-3">
        <h1 className="text-xl font-semibold">Tedarik ve Termin Takibi</h1>
        <p className="text-sm text-slate-500">
          {veri ? `${veri.length} açık sipariş` : 'Yükleniyor…'}
          {geciken > 0 && <b className="text-red-600"> · {geciken} tanesinin termini geçti</b>}
        </p>
      </div>
      <Hata mesaj={hata} />
      {veri?.length === 0 && <p className="py-16 text-center text-slate-500">Açık sipariş yok. Sipariş eklemek için katalogdan bir ürün açın.</p>}
      <ul className="space-y-2">
        {veri?.map((s) => (
          <li key={s.id}>
            <button
              onClick={() => setSeciliId(s.urunId)}
              className={`flex w-full items-center gap-3 rounded-xl p-2 pr-4 text-left shadow-sm ring-1 hover:ring-blue-400 ${s.gecikti ? 'bg-red-50 ring-red-300' : 'bg-white ring-slate-200'}`}
            >
              <Gorsel urun={{ id: s.urunId, gorselSurum: s.gorselSurum }} boyut="kart" className="size-16 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{s.urunAd}</p>
                <p className="truncate text-sm text-slate-500">
                  {s.tedarikci} · <b className="text-slate-700">{adet.format(s.miktar)} adet</b> · depoda {adet.format(s.stok)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className={`font-semibold ${s.gecikti ? 'text-red-700' : ''}`}>{tarih(s.termin)}</p>
                {s.gecikti && s.termin ? <p className="text-xs font-medium text-red-700">{gecikmeGun(s.termin)} gün gecikti</p> : null}
              </div>
            </button>
          </li>
        ))}
      </ul>
      {seciliId !== null && <UrunDetay id={seciliId} kapat={() => setSeciliId(null)} degisti={yenile} />}
    </>
  )
}

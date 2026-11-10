import { useEffect, useState, type FormEvent } from 'react'
import { gorselYukle, kritikEsikKaydet, siparisEkle, siparisGuncelle, siparisSil, siparisTeslim, tedarikcileriGetir, urunGetir, type Siparis } from './api'
import { adet, Gorsel, gecikmeGun, para, stokDurumu, useVeri } from './ortak'

const girdi = 'h-10 min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500'

/** Ürün detayı: bilgiler, tedarik siparişleri, kritik eşik ve görsel yükleme. */
export function UrunDetay({ id, kapat, degisti }: { id: number; kapat: () => void; degisti: () => void }) {
  const { veri: urun, hata: yuklemeHatasi, yenile } = useVeri(() => urunGetir(id))
  const { veri: tedarikciler } = useVeri(tedarikcileriGetir)
  const [mesgul, setMesgul] = useState(false)
  const [hata, setHata] = useState<string | null>(null)
  const [yeni, setYeni] = useState({ tedarikci: '', miktar: '', termin: '' })
  const [esik, setEsik] = useState<string | null>(null) // null: kullanıcı henüz dokunmadı

  useEffect(() => {
    const tus = (e: KeyboardEvent) => e.key === 'Escape' && kapat()
    window.addEventListener('keydown', tus)
    return () => window.removeEventListener('keydown', tus)
  }, [kapat])

  /** Bir değişikliği uygular, sonra hem bu pencereyi hem arkadaki listeyi tazeler. */
  async function uygula(islem: () => Promise<unknown>): Promise<boolean> {
    setMesgul(true)
    setHata(null)
    try {
      await islem()
      yenile()
      degisti()
      return true
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'İşlem başarısız')
      return false
    } finally {
      setMesgul(false)
    }
  }

  async function siparisKaydet(e: FormEvent) {
    e.preventDefault()
    const tamam = await uygula(() => siparisEkle(id, { tedarikci: yeni.tedarikci, miktar: Number(yeni.miktar.replace(',', '.')), termin: yeni.termin || null }))
    if (tamam) setYeni({ tedarikci: '', miktar: '', termin: '' })
  }

  const terminDegistir = (s: Siparis, termin: string) => uygula(() => siparisGuncelle(s.id, { tedarikci: s.tedarikci, miktar: s.miktar, termin: termin || null }))

  const esikMetni = esik ?? (urun?.kritikEsik != null ? String(urun.kritikEsik) : '')
  const esikKaydet = () =>
    uygula(() => kritikEsikKaydet(id, esikMetni.trim() === '' ? null : Number(esikMetni.replace(',', '.')))).then((t) => t && setEsik(null))

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-slate-900/60 sm:items-center sm:p-6" onClick={kapat}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={urun?.ad ?? 'Ürün'}
        className="flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-y-auto rounded-t-2xl bg-white sm:flex-row sm:overflow-hidden sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {!urun ? (
          <p className="p-8 text-slate-500">{yuklemeHatasi ?? 'Yükleniyor…'}</p>
        ) : (
          <>
            <div className="shrink-0 sm:w-2/5">
              <Gorsel urun={urun} boyut="buyuk" className="aspect-square w-full" />
              <label className={`m-3 flex h-10 cursor-pointer items-center justify-center rounded-lg border border-slate-300 text-sm font-medium hover:bg-slate-50 ${mesgul ? 'pointer-events-none opacity-60' : ''}`}>
                {urun.gorselSurum ? 'Görseli değiştir' : 'Görsel ekle'}
                <input type="file" accept="image/*" className="hidden" disabled={mesgul} onChange={(e) => { const d = e.target.files?.[0]; if (d) void uygula(() => gorselYukle(id, d)) }} />
              </label>
            </div>

            <div className="flex flex-1 flex-col gap-4 p-5 sm:overflow-y-auto">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold leading-snug">{urun.ad}</h2>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {[urun.kod, urun.barkod, urun.marka, urun.olcu, urun.raf && `Raf ${urun.raf}`].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <button onClick={kapat} aria-label="Kapat" className="-mr-2 -mt-2 rounded-lg p-2 text-2xl leading-none text-slate-400 hover:bg-slate-100">×</button>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">{urun.satisFiyati != null ? para.format(urun.satisFiyati) : '—'}</span>
                <span className={`rounded-full px-3 py-1 text-sm font-medium ${stokDurumu(urun).sinif}`}>{stokDurumu(urun).etiket}</span>
              </div>

              <div className="grid grid-cols-3 divide-x divide-slate-200 rounded-xl bg-slate-50 text-center ring-1 ring-slate-200">
                {([['Depoda', adet.format(urun.stok)], ['Yolda', adet.format(urun.yoldaki)]] as const).map(([ad, deger]) => (
                  <div key={ad} className="p-3">
                    <p className="text-xs text-slate-500">{ad}</p>
                    <p className="text-lg font-semibold">{deger}</p>
                  </div>
                ))}
                <div className="p-3">
                  <label htmlFor="esik" className="text-xs text-slate-500">Kritik eşik</label>
                  <input
                    id="esik" inputMode="decimal" placeholder="—" value={esikMetni} disabled={mesgul}
                    onChange={(e) => setEsik(e.target.value)}
                    onBlur={() => esik !== null && void esikKaydet()}
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                    className="w-full bg-transparent text-center text-lg font-semibold outline-none focus:text-blue-700"
                  />
                </div>
              </div>

              <section>
                <h3 className="mb-2 text-sm font-semibold">Tedarikçiye verilen açık siparişler</h3>
                {urun.siparisler.length === 0 && <p className="text-sm text-slate-500">Açık sipariş yok.</p>}
                <ul className="space-y-2">
                  {urun.siparisler.map((s) => (
                    <li key={s.id} className={`rounded-lg p-3 text-sm ring-1 ${s.gecikti ? 'bg-red-50 ring-red-300' : 'bg-white ring-slate-200'}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{s.tedarikci}</span>
                        <span className="font-semibold">{adet.format(s.miktar)} adet</span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <input type="date" aria-label="Termin tarihi" value={s.termin ?? ''} disabled={mesgul} onChange={(e) => void terminDegistir(s, e.target.value)} className={`${girdi} ${s.gecikti ? 'border-red-400 text-red-700' : ''}`} />
                        {s.gecikti && s.termin ? <span className="font-medium text-red-700">{gecikmeGun(s.termin)} gün gecikti</span> : null}
                        <span className="ml-auto flex gap-2">
                          <button disabled={mesgul} onClick={() => void uygula(() => siparisTeslim(s.id))} className="h-10 rounded-lg bg-emerald-600 px-3 font-medium text-white hover:bg-emerald-700 disabled:opacity-60">Teslim alındı</button>
                          <button disabled={mesgul} onClick={() => confirm('Bu sipariş kaydı silinsin mi?') && void uygula(() => siparisSil(s.id))} className="h-10 rounded-lg px-3 text-slate-500 hover:bg-slate-100 disabled:opacity-60">Sil</button>
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>

                <form onSubmit={siparisKaydet} className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-[1fr_6rem_auto_auto]">
                  <input required list="tedarikciler" placeholder="Tedarikçi" aria-label="Tedarikçi" value={yeni.tedarikci} onChange={(e) => setYeni({ ...yeni, tedarikci: e.target.value })} className={`${girdi} col-span-2 sm:col-span-1`} />
                  <datalist id="tedarikciler">{tedarikciler?.map((t) => <option key={t} value={t} />)}</datalist>
                  <input required inputMode="decimal" placeholder="Adet" aria-label="Adet" value={yeni.miktar} onChange={(e) => setYeni({ ...yeni, miktar: e.target.value })} className={girdi} />
                  <input type="date" aria-label="Beklenen teslim tarihi" value={yeni.termin} onChange={(e) => setYeni({ ...yeni, termin: e.target.value })} className={girdi} />
                  <button disabled={mesgul} className="col-span-2 h-10 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 sm:col-span-1">Sipariş ekle</button>
                </form>
              </section>

              {hata && <p className="text-sm text-red-600">{hata}</p>}
              <p className="mt-auto text-xs text-slate-400">Sipariş ve eşik bilgileri yalnızca bu programda tutulur, Vega'ya yazılmaz.</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

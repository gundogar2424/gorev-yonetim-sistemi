import { useEffect, useMemo, useRef, useState } from 'react'
import { iskontoCoz, teklifHesapla } from '../../ortak/teklif-hesap'
import {
  ayarlariGetir, musterileriGetir, teklifEkle, teklifGetir, teklifGuncelle, teklifleriGetir, teklifMetniGetir, teklifSil, urunleriAra,
  type TeklifGirdi, type Urun,
} from './api'
import { adet, Gorsel, Hata, para, tarih, useVeri } from './ortak'

const girdi = 'h-10 min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500'
/** "1.250,5" ve "12,5" Türkçe yazım; virgül yoksa nokta ondalık sayılır ("0.45"). */
const sayi = (metin: string) => Number(metin.includes(',') ? metin.replace(/\./g, '').replace(',', '.') : metin)
const sayiYaz = (n: number) => String(n).replace('.', ',')

/** Düzenleme sırasında sayılar metin olarak tutulur ("12,5" yazarken bozulmasın). */
interface Satir {
  anahtar: number
  urunId: number | null
  gorselSurum: number | null
  kod: string | null
  ad: string
  miktar: string
  birimFiyat: string
  iskonto: string
  kdv: number
}

export function Teklifler({ alt }: { alt: string }) {
  if (alt === '') return <TeklifListesi />
  // key: başka bir teklife geçildiğinde düzenleyici sıfırdan kurulsun
  return <TeklifDuzenle key={alt} id={alt === 'yeni' ? null : Number(alt)} />
}

function TeklifListesi() {
  const { veri, hata } = useVeri(teklifleriGetir)
  return (
    <>
      <div className="flex items-center justify-between gap-3 py-3">
        <h1 className="text-xl font-semibold">Teklifler</h1>
        <a href="#/teklif/yeni" className="flex h-10 items-center rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700">Yeni teklif</a>
      </div>
      <Hata mesaj={hata} />
      {veri?.length === 0 && <p className="py-16 text-center text-slate-500">Henüz teklif yok.</p>}
      <ul className="space-y-2">
        {veri?.map((t) => (
          <li key={t.id}>
            <a href={`#/teklif/${t.id}`} className="flex items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 hover:ring-blue-400">
              <div className="min-w-0">
                <p className="truncate font-medium">{t.musteriAd}</p>
                <p className="text-sm text-slate-500">{t.no} · {tarih(t.tarih)} · {t.kalemSayisi} kalem</p>
              </div>
              <p className="shrink-0 font-semibold">{para.format(t.genelToplam)}</p>
            </a>
          </li>
        ))}
      </ul>
    </>
  )
}

function TeklifDuzenle({ id: ilkId }: { id: number | null }) {
  const [id, setId] = useState(ilkId)
  const [no, setNo] = useState<string | null>(null)
  const [hazir, setHazir] = useState(ilkId === null)
  const [musteri, setMusteri] = useState({ ad: '', telefon: '', adres: '' })
  const [satirlar, setSatirlar] = useState<Satir[]>([])
  const [genelIskonto, setGenelIskonto] = useState('')
  const [kdvDahil, setKdvDahil] = useState(false)
  const [gecerlilikGun, setGecerlilikGun] = useState('15')
  const [notu, setNotu] = useState('')
  const [hata, setHata] = useState<string | null>(null)
  const [mesgul, setMesgul] = useState(false)
  const [metin, setMetin] = useState<string | null>(null)
  const { veri: musteriler } = useVeri(musterileriGetir)
  const anahtar = useRef(0)

  useEffect(() => {
    if (ilkId === null) {
      // Yeni teklif: firmanın "fiyatlar KDV dahil mi" ayarıyla başla
      ayarlariGetir().then((a) => setKdvDahil(a.fiyatlarKdvDahil)).catch(() => {})
      return
    }
    teklifGetir(ilkId)
      .then((t) => {
        setNo(t.no)
        setMusteri({ ad: t.musteriAd, telefon: t.musteriTelefon ?? '', adres: t.musteriAdres ?? '' })
        setSatirlar(t.kalemler.map((k) => ({ ...k, anahtar: ++anahtar.current, miktar: sayiYaz(k.miktar), birimFiyat: sayiYaz(k.birimFiyat) })))
        setGenelIskonto(t.genelIskonto)
        setKdvDahil(t.kdvDahil)
        setGecerlilikGun(String(t.gecerlilikGun))
        setNotu(t.notu ?? '')
        setHazir(true)
      })
      .catch((e) => setHata(e instanceof Error ? e.message : 'Teklif yüklenemedi'))
  }, [ilkId])

  // --- Ürün arama (her tuşta) ---
  const [ara, setAra] = useState('')
  const [sonuclar, setSonuclar] = useState<Urun[]>([])
  const araKutusu = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!ara.trim()) return setSonuclar([])
    const iptal = new AbortController()
    urunleriAra({ q: ara, marka: '', kategori: '', olcu: '' }, iptal.signal).then((s) => setSonuclar(s.slice(0, 8))).catch(() => {})
    return () => iptal.abort()
  }, [ara])

  function urunEkle(u: Urun) {
    setSatirlar((eski) =>
      eski.some((s) => s.urunId === u.id)
        ? eski.map((s) => (s.urunId === u.id ? { ...s, miktar: sayiYaz(sayi(s.miktar) + 1) } : s)) // sepette varsa adedi artır
        : [...eski, { anahtar: ++anahtar.current, urunId: u.id, gorselSurum: u.gorselSurum, kod: u.kod, ad: u.ad, miktar: '1', birimFiyat: sayiYaz(u.satisFiyati ?? 0), iskonto: '', kdv: u.kdv ?? 20 }],
    )
    setAra('')
    araKutusu.current?.focus()
  }
  const serbestEkle = () =>
    setSatirlar((eski) => [...eski, { anahtar: ++anahtar.current, urunId: null, gorselSurum: null, kod: null, ad: '', miktar: '1', birimFiyat: '0', iskonto: '', kdv: 20 }])
  const satirDegistir = (a: number, alan: Partial<Satir>) => setSatirlar((eski) => eski.map((s) => (s.anahtar === a ? { ...s, ...alan } : s)))

  // --- Anlık hesap ---
  const kalemler = useMemo(
    () => satirlar.map((s) => ({ urunId: s.urunId, kod: s.kod, ad: s.ad, miktar: sayi(s.miktar) || 0, birimFiyat: sayi(s.birimFiyat) || 0, iskonto: s.iskonto, kdv: s.kdv })),
    [satirlar],
  )
  const hesap = useMemo(() => teklifHesapla(kalemler, genelIskonto, kdvDahil), [kalemler, genelIskonto, kdvDahil])

  /** Teklifi kaydeder (yeni ise oluşturur) ve kimliğini döndürür. */
  async function kaydet(): Promise<number | null> {
    const govde: TeklifGirdi = {
      musteriAd: musteri.ad, musteriTelefon: musteri.telefon, musteriAdres: musteri.adres,
      genelIskonto, kdvDahil, gecerlilikGun: Number(gecerlilikGun), notu, kalemler,
    }
    setMesgul(true)
    setHata(null)
    try {
      if (id !== null) {
        await teklifGuncelle(id, govde)
        return id
      }
      const yeni = (await teklifEkle(govde)).id
      setId(yeni)
      setNo((await teklifGetir(yeni)).no)
      history.replaceState(null, '', `#/teklif/${yeni}`) // sayfa yenilenirse aynı teklif açılsın
      return yeni
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Teklif kaydedilemedi')
      return null
    } finally {
      setMesgul(false)
    }
  }

  // Yeni sekme tıklama anında açılır (sonradan açılırsa tarayıcı engeller), kayıt bitince adresi verilir
  async function pdfAc() {
    const sekme = window.open('', '_blank')
    const kayitli = await kaydet()
    if (kayitli === null) return sekme?.close()
    if (sekme) sekme.location.href = `/api/teklifler/${kayitli}/pdf`
    else location.href = `/api/teklifler/${kayitli}/pdf`
  }

  async function metniHazirla(whatsapp: boolean) {
    const sekme = whatsapp ? window.open('', '_blank') : null
    const kayitli = await kaydet()
    if (kayitli === null) return sekme?.close()
    try {
      const { metin: m, telefon } = await teklifMetniGetir(kayitli)
      setMetin(m)
      if (sekme) {
        // 0532… → 90532… ; numara yoksa WhatsApp kişi seçtirir
        const rakam = (telefon ?? '').replace(/\D/g, '').replace(/^0/, '90')
        sekme.location.href = `https://wa.me/${rakam.length >= 11 ? rakam : ''}?text=${encodeURIComponent(m)}`
      }
    } catch (e) {
      sekme?.close()
      setHata(e instanceof Error ? e.message : 'Metin alınamadı')
    }
  }

  async function sil() {
    if (id === null || !confirm(`${no ?? 'Bu'} teklif silinsin mi?`)) return
    try {
      await teklifSil(id)
      location.hash = '#/teklif'
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Teklif silinemedi')
    }
  }

  if (!hazir) return <p className="py-10 text-slate-500">{hata ?? 'Yükleniyor…'}</p>
  const iskontoHatali = (m: string) => iskontoCoz(m) === null

  return (
    <div className="py-3">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <a href="#/teklif" className="text-sm text-blue-600 hover:underline">← Teklifler</a>
        <h1 className="text-xl font-semibold">{no ?? 'Yeni teklif'}</h1>
        {id !== null && <button onClick={sil} className="ml-auto text-sm text-slate-500 hover:text-red-600">Teklifi sil</button>}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <section className="grid gap-2 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:grid-cols-2">
            <input
              list="musteriler" placeholder="Müşteri adı" aria-label="Müşteri adı" value={musteri.ad} className={`${girdi} sm:col-span-2`}
              onChange={(e) => {
                // Kayıtlı müşteri seçilirse telefon ve adres kendiliğinden dolar
                const kayitli = musteriler?.find((m) => m.ad === e.target.value)
                setMusteri(kayitli ? { ad: kayitli.ad, telefon: kayitli.telefon ?? '', adres: kayitli.adres ?? '' } : { ...musteri, ad: e.target.value })
              }}
            />
            <datalist id="musteriler">{musteriler?.map((m) => <option key={m.ad} value={m.ad} />)}</datalist>
            <input placeholder="Telefon (WhatsApp)" aria-label="Müşteri telefonu" inputMode="tel" value={musteri.telefon} onChange={(e) => setMusteri({ ...musteri, telefon: e.target.value })} className={girdi} />
            <input placeholder="Adres" aria-label="Müşteri adresi" value={musteri.adres} onChange={(e) => setMusteri({ ...musteri, adres: e.target.value })} className={girdi} />
          </section>

          <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <div className="relative">
              <input
                ref={araKutusu} type="search" value={ara} placeholder="Ürün ekle: ad, stok kodu veya barkod… (Enter ilk sonucu ekler)" aria-label="Ürün ara ve ekle"
                onChange={(e) => setAra(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && sonuclar[0]) urunEkle(sonuclar[0]); if (e.key === 'Escape') setAra('') }}
                className="h-11 w-full rounded-lg border border-slate-300 px-4 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
              {sonuclar.length > 0 && (
                <ul className="absolute inset-x-0 top-12 z-10 max-h-96 overflow-y-auto rounded-lg bg-white shadow-lg ring-1 ring-slate-200">
                  {sonuclar.map((u, i) => (
                    <li key={u.id}>
                      <button onClick={() => urunEkle(u)} className={`flex w-full items-center gap-3 p-2 text-left hover:bg-blue-50 ${i === 0 ? 'bg-slate-50' : ''}`}>
                        <Gorsel urun={u} boyut="kart" className="size-10 shrink-0 rounded" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{u.ad}</span>
                          <span className="text-xs text-slate-500">{u.kod} · stok {adet.format(u.stok)}</span>
                        </span>
                        <span className="shrink-0 text-sm font-semibold">{u.satisFiyati != null ? para.format(u.satisFiyati) : '—'}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {satirlar.length === 0 && <p className="py-8 text-center text-sm text-slate-500">Sepet boş. Yukarıdan ürün arayıp ekleyin.</p>}
            <ul className="mt-3 divide-y divide-slate-100">
              {satirlar.map((s, i) => {
                // Tutar + sil düğmesi: telefonda ad satırının, geniş ekranda satırın sonunda durur
                const son = (sinif: string) => (
                  <span className={`shrink-0 items-center gap-1 ${sinif}`}>
                    <span className="w-24 text-right text-sm font-semibold sm:w-28">{para.format(hesap.kalemler[i]?.net ?? 0)}</span>
                    <button onClick={() => setSatirlar((eski) => eski.filter((x) => x.anahtar !== s.anahtar))} aria-label={`${s.ad || 'Kalem'} satırını sil`} className="size-10 rounded-lg text-xl text-slate-400 hover:bg-slate-100 hover:text-red-600">×</button>
                  </span>
                )
                return (
                  <li key={s.anahtar} className="flex flex-wrap items-center gap-2 py-2">
                    <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:flex-1">
                      {s.urunId !== null ? <Gorsel urun={{ id: s.urunId, gorselSurum: s.gorselSurum }} boyut="kart" className="size-10 shrink-0 rounded" /> : <span className="hidden size-10 shrink-0 sm:block" />}
                      {s.urunId !== null ? (
                        <span className="min-w-0 flex-1 text-sm"><span className="font-medium">{s.ad}</span> <span className="text-xs text-slate-500">{s.kod}</span></span>
                      ) : (
                        <input placeholder="Kalem adı (nakliye, işçilik…)" aria-label="Kalem adı" value={s.ad} onChange={(e) => satirDegistir(s.anahtar, { ad: e.target.value })} className={`${girdi} flex-1`} />
                      )}
                      {son('flex sm:hidden')}
                    </div>
                    <input aria-label="Miktar" title="Miktar" inputMode="decimal" value={s.miktar} onChange={(e) => satirDegistir(s.anahtar, { miktar: e.target.value })} className={`${girdi} flex-1 text-right sm:w-20 sm:flex-none`} />
                    <span className="text-slate-400">×</span>
                    <input aria-label="Birim fiyat" title="Birim fiyat" inputMode="decimal" value={s.birimFiyat} onChange={(e) => satirDegistir(s.anahtar, { birimFiyat: e.target.value })} className={`${girdi} flex-1 text-right sm:w-24 sm:flex-none`} />
                    <input aria-label="İskonto" title="Kademeli iskonto, örn. 10+5" placeholder="isk. %" value={s.iskonto} onChange={(e) => satirDegistir(s.anahtar, { iskonto: e.target.value })} className={`${girdi} flex-1 text-right sm:w-20 sm:flex-none ${iskontoHatali(s.iskonto) ? 'border-red-500 text-red-600' : ''}`} />
                    {son('hidden sm:flex')}
                  </li>
                )
              })}
            </ul>
            <button onClick={serbestEkle} className="mt-2 text-sm text-blue-600 hover:underline">+ Katalog dışı kalem ekle (nakliye, işçilik…)</button>
          </section>

          <textarea placeholder="Not (teslimat, ödeme koşulları…)" aria-label="Teklif notu" value={notu} onChange={(e) => setNotu(e.target.value)} rows={2} className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm outline-none focus:border-blue-500" />
        </div>

        <aside className="h-fit space-y-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 lg:sticky lg:top-3">
          <label className="flex items-center justify-between gap-2 text-sm">
            Genel iskonto %
            <input aria-label="Genel iskonto" placeholder="örn. 5" value={genelIskonto} onChange={(e) => setGenelIskonto(e.target.value)} className={`${girdi} w-24 text-right ${iskontoHatali(genelIskonto) ? 'border-red-500 text-red-600' : ''}`} />
          </label>
          <label className="flex items-center justify-between gap-2 text-sm">
            Geçerlilik (gün)
            <input aria-label="Geçerlilik süresi" inputMode="numeric" value={gecerlilikGun} onChange={(e) => setGecerlilikGun(e.target.value)} className={`${girdi} w-24 text-right`} />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={kdvDahil} onChange={(e) => setKdvDahil(e.target.checked)} className="size-4" />
            Birim fiyatlar KDV dahil
          </label>

          <dl className="space-y-1 border-t border-slate-200 pt-3 text-sm">
            {hesap.iskontoToplam > 0 && (
              <>
                <div className="flex justify-between"><dt>Ara toplam</dt><dd>{para.format(hesap.araToplam)}</dd></div>
                <div className="flex justify-between text-emerald-700"><dt>İskonto</dt><dd>-{para.format(hesap.iskontoToplam)}</dd></div>
              </>
            )}
            <div className="flex justify-between"><dt>Toplam (KDV hariç)</dt><dd>{para.format(hesap.matrah)}</dd></div>
            {hesap.kdvler.map((k) => (
              <div key={k.oran} className="flex justify-between"><dt>KDV %{adet.format(k.oran)}</dt><dd>{para.format(k.tutar)}</dd></div>
            ))}
            <div className="flex justify-between border-t border-slate-900 pt-2 text-lg font-bold"><dt>Genel toplam</dt><dd data-testid="genel-toplam">{para.format(hesap.genelToplam)}</dd></div>
          </dl>

          <Hata mesaj={hata} />
          <div className="grid gap-2">
            <button disabled={mesgul} onClick={pdfAc} className="h-11 rounded-lg bg-blue-600 font-medium text-white hover:bg-blue-700 disabled:opacity-60">Kaydet ve PDF aç</button>
            <button disabled={mesgul} onClick={() => metniHazirla(true)} className="h-11 rounded-lg bg-emerald-600 font-medium text-white hover:bg-emerald-700 disabled:opacity-60">WhatsApp'tan gönder</button>
            <div className="grid grid-cols-2 gap-2">
              <button disabled={mesgul} onClick={() => metniHazirla(false)} className="h-10 rounded-lg text-sm font-medium ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-60">Metin özeti</button>
              <button disabled={mesgul} onClick={() => void kaydet()} className="h-10 rounded-lg text-sm font-medium ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-60">Sadece kaydet</button>
            </div>
          </div>
          {metin !== null && (
            <textarea readOnly aria-label="Teklif metin özeti" value={metin} rows={10} onFocus={(e) => e.currentTarget.select()} className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2 font-mono text-xs" />
          )}
        </aside>
      </div>
    </div>
  )
}

import { useEffect, useState, type FormEvent } from 'react'
import { ayarlariGetir, ayarlariKaydet, logoYukle, type Firma } from './api'
import { Hata } from './ortak'

const ALANLAR: [keyof Omit<Firma, 'fiyatlarKdvDahil'>, string][] = [
  ['ad', 'Firma adı'], ['adres', 'Adres'], ['telefon', 'Telefon'], ['eposta', 'E-posta'], ['vergi', 'Vergi dairesi / no'],
]

/** Teklif PDF'inin başlığında görünen firma bilgileri ve logo. */
export function Ayarlar() {
  const [firma, setFirma] = useState<Firma | null>(null)
  const [logoSurum, setLogoSurum] = useState<number | null>(null) // null: logo yok
  const [hata, setHata] = useState<string | null>(null)
  const [durum, setDurum] = useState<string | null>(null)

  useEffect(() => {
    ayarlariGetir()
      .then(({ logoVar, ...f }) => (setFirma(f), setLogoSurum(logoVar ? 0 : null)))
      .catch((e) => setHata(e instanceof Error ? e.message : 'Ayarlar yüklenemedi'))
  }, [])

  async function calistir(islem: () => Promise<unknown>, basari: string) {
    setHata(null)
    setDurum(null)
    try {
      await islem()
      setDurum(basari)
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'İşlem başarısız')
    }
  }

  const kaydet = (e: FormEvent) => {
    e.preventDefault()
    if (firma) void calistir(() => ayarlariKaydet(firma), 'Kaydedildi.')
  }

  if (!firma) return <p className="py-10 text-slate-500">{hata ?? 'Yükleniyor…'}</p>
  return (
    <form onSubmit={kaydet} className="mx-auto max-w-xl space-y-3 py-3">
      <h1 className="text-xl font-semibold">Firma Bilgileri</h1>
      <p className="text-sm text-slate-500">Bu bilgiler ve logo, teklif PDF'inin başlığında ve WhatsApp özetinde kullanılır.</p>
      {ALANLAR.map(([alan, etiket]) => (
        <label key={alan} className="block text-sm">
          <span className="text-slate-600">{etiket}</span>
          <input value={firma[alan]} onChange={(e) => setFirma({ ...firma, [alan]: e.target.value })} className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 outline-none focus:border-blue-500" />
        </label>
      ))}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={firma.fiyatlarKdvDahil} onChange={(e) => setFirma({ ...firma, fiyatlarKdvDahil: e.target.checked })} className="size-4" />
        Vega'daki satış fiyatları KDV dahil (yeni tekliflerde varsayılan)
      </label>

      <div className="flex items-center gap-4 rounded-xl bg-white p-4 ring-1 ring-slate-200">
        {logoSurum !== null ? <img src={`/logo?v=${logoSurum}`} alt="Firma logosu" className="h-16 max-w-40 object-contain" /> : <span className="text-sm text-slate-400">Logo yok</span>}
        <label className="flex h-10 cursor-pointer items-center rounded-lg px-4 text-sm font-medium ring-1 ring-slate-300 hover:bg-slate-50">
          Logo yükle
          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const d = e.target.files?.[0]; if (d) void calistir(() => logoYukle(d).then(() => setLogoSurum(Date.now())), 'Logo yüklendi.') }} />
        </label>
      </div>

      <Hata mesaj={hata} />
      <div className="flex items-center gap-3">
        <button className="h-11 rounded-lg bg-blue-600 px-6 font-medium text-white hover:bg-blue-700">Kaydet</button>
        {durum && <span role="status" className="text-sm text-emerald-700">{durum}</span>}
      </div>
    </form>
  )
}

import { useState, type FormEvent } from 'react'
import { kullaniciEkle, kullaniciGuncelle, kullanicilariGetir, ROL_ADLARI, sifreDegistir, type Kullanici, type Rol } from './api'
import { Hata, useVeri } from './ortak'

const girdi = 'h-10 min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500'
const ROL_ACIKLAMA: Record<Rol, string> = {
  yonetici: 'Her şey; kullanıcılar ve firma ayarları dahil',
  satis: 'Katalog, teklif, tedarik, kritik stok, depo',
  depo: 'Katalog, tedarik, kritik stok, depo — teklifleri göremez',
}

function RolSecimi({ deger, degisti, disabled }: { deger: Rol; degisti: (r: Rol) => void; disabled?: boolean }) {
  return (
    <select aria-label="Rol" value={deger} disabled={disabled} onChange={(e) => degisti(e.target.value as Rol)} className={girdi}>
      {(Object.keys(ROL_ADLARI) as Rol[]).map((r) => <option key={r} value={r}>{ROL_ADLARI[r]}</option>)}
    </select>
  )
}

/** Yönetici: kullanıcı ekleme, rol değiştirme, şifre sıfırlama, devre dışı bırakma. */
export function Kullanicilar({ ben }: { ben: Kullanici }) {
  const { veri, hata: yuklemeHatasi, yenile } = useVeri(kullanicilariGetir)
  const [hata, setHata] = useState<string | null>(null)
  const [yeni, setYeni] = useState({ kullaniciAdi: '', ad: '', rol: 'satis' as Rol, sifre: '' })

  async function uygula(islem: () => Promise<unknown>): Promise<boolean> {
    setHata(null)
    try {
      await islem()
      yenile()
      return true
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'İşlem başarısız')
      return false
    }
  }

  async function ekle(e: FormEvent) {
    e.preventDefault()
    if (await uygula(() => kullaniciEkle(yeni))) setYeni({ kullaniciAdi: '', ad: '', rol: 'satis', sifre: '' })
  }

  function sifreSifirla(k: Kullanici) {
    const sifre = prompt(`${k.ad} için yeni şifre (en az 6 karakter):`)
    if (sifre) void uygula(() => kullaniciGuncelle(k.id, { ad: k.ad, rol: k.rol, aktif: k.aktif, sifre }))
  }

  return (
    <div className="mx-auto max-w-3xl py-3">
      <h1 className="text-xl font-semibold">Kullanıcılar</h1>
      <ul className="mt-1 text-sm text-slate-500">
        {(Object.keys(ROL_ADLARI) as Rol[]).map((r) => <li key={r}><b className="text-slate-700">{ROL_ADLARI[r]}:</b> {ROL_ACIKLAMA[r]}</li>)}
      </ul>
      <div className="mt-3"><Hata mesaj={hata ?? yuklemeHatasi} /></div>

      <ul className="space-y-2">
        {veri?.map((k) => (
          <li key={k.id} className={`flex flex-wrap items-center gap-2 rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200 ${k.aktif ? '' : 'opacity-60'}`}>
            <div className="min-w-40 flex-1">
              <p className="font-medium">{k.ad}{k.id === ben.id && <span className="ml-2 text-xs font-normal text-slate-500">(siz)</span>}</p>
              <p className="text-sm text-slate-500">{k.kullaniciAdi}{!k.aktif && ' · devre dışı'}</p>
            </div>
            <RolSecimi deger={k.rol} disabled={k.id === ben.id || !k.aktif} degisti={(rol) => void uygula(() => kullaniciGuncelle(k.id, { ad: k.ad, rol, aktif: k.aktif }))} />
            <button onClick={() => sifreSifirla(k)} className="h-10 rounded-lg px-3 text-sm ring-1 ring-slate-300 hover:bg-slate-50">Şifre sıfırla</button>
            {k.id !== ben.id && (
              <button onClick={() => void uygula(() => kullaniciGuncelle(k.id, { ad: k.ad, rol: k.rol, aktif: !k.aktif }))} className="h-10 w-32 rounded-lg px-3 text-sm ring-1 ring-slate-300 hover:bg-slate-50">
                {k.aktif ? 'Devre dışı bırak' : 'Yeniden etkinleştir'}
              </button>
            )}
          </li>
        ))}
      </ul>

      <form onSubmit={ekle} className="mt-6 grid gap-2 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:grid-cols-2">
        <h2 className="font-semibold sm:col-span-2">Yeni kullanıcı</h2>
        <input required placeholder="Ad soyad" aria-label="Ad soyad" value={yeni.ad} onChange={(e) => setYeni({ ...yeni, ad: e.target.value })} className={girdi} />
        <input required placeholder="Kullanıcı adı (örn. ahmet)" aria-label="Kullanıcı adı" autoCapitalize="off" value={yeni.kullaniciAdi} onChange={(e) => setYeni({ ...yeni, kullaniciAdi: e.target.value })} className={girdi} />
        <input required placeholder="İlk şifre (en az 6 karakter)" aria-label="İlk şifre" value={yeni.sifre} onChange={(e) => setYeni({ ...yeni, sifre: e.target.value })} className={girdi} />
        <RolSecimi deger={yeni.rol} degisti={(rol) => setYeni({ ...yeni, rol })} />
        <button className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 sm:col-span-2">Kullanıcı ekle</button>
      </form>
    </div>
  )
}

/** Herkes: kendi şifresini değiştirme. */
export function Hesap({ ben }: { ben: Kullanici }) {
  const [f, setF] = useState({ eski: '', yeni: '' })
  const [hata, setHata] = useState<string | null>(null)
  const [tamam, setTamam] = useState(false)

  async function gonder(e: FormEvent) {
    e.preventDefault()
    setHata(null)
    setTamam(false)
    try {
      await sifreDegistir(f.eski, f.yeni)
      setF({ eski: '', yeni: '' })
      setTamam(true)
    } catch (err) {
      setHata(err instanceof Error ? err.message : 'Şifre değiştirilemedi')
    }
  }

  return (
    <form onSubmit={gonder} className="mx-auto max-w-sm space-y-3 py-3">
      <h1 className="text-xl font-semibold">Hesabım</h1>
      <p className="text-sm text-slate-500">{ben.ad} · {ben.kullaniciAdi} · {ROL_ADLARI[ben.rol]}</p>
      <input required type="password" placeholder="Mevcut şifre" aria-label="Mevcut şifre" autoComplete="current-password" value={f.eski} onChange={(e) => setF({ ...f, eski: e.target.value })} className={`${girdi} w-full`} />
      <input required type="password" placeholder="Yeni şifre (en az 6 karakter)" aria-label="Yeni şifre" autoComplete="new-password" value={f.yeni} onChange={(e) => setF({ ...f, yeni: e.target.value })} className={`${girdi} w-full`} />
      <Hata mesaj={hata} />
      <div className="flex items-center gap-3">
        <button className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700">Şifreyi değiştir</button>
        {tamam && <span role="status" className="text-sm text-emerald-700">Şifre değiştirildi.</span>}
      </div>
    </form>
  )
}

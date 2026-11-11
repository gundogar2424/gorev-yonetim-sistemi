import { useState, type FormEvent } from 'react'
import { girisYap, kurulumYap, type Kullanici } from './api'

const girdi = 'mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200'

/** Giriş ekranı. Sistemde hiç kullanıcı yoksa ilk yönetici hesabını oluşturur. */
export function Giris({ kurulum, demo, girildi }: { kurulum: boolean; demo: boolean; girildi: (k: Kullanici) => void }) {
  const [f, setF] = useState({ kullaniciAdi: '', ad: '', sifre: '' })
  const [hata, setHata] = useState<string | null>(null)
  const [mesgul, setMesgul] = useState(false)

  async function gonder(e: FormEvent) {
    e.preventDefault()
    setMesgul(true)
    setHata(null)
    try {
      girildi(await (kurulum ? kurulumYap(f) : girisYap(f.kullaniciAdi, f.sifre)))
    } catch (err) {
      setHata(err instanceof Error ? err.message : 'Giriş yapılamadı')
    } finally {
      setMesgul(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <form onSubmit={gonder} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow ring-1 ring-slate-200">
        <div>
          <h1 className="text-xl font-semibold">{kurulum ? 'İlk kurulum' : 'Giriş'}</h1>
          {kurulum && <p className="mt-1 text-sm text-slate-500">Henüz kullanıcı yok. Yönetici hesabını oluşturun; diğer kullanıcıları sonra bu hesapla eklersiniz.</p>}
        </div>
        {kurulum && (
          <label className="block text-sm">
            Ad soyad
            <input required value={f.ad} onChange={(e) => setF({ ...f, ad: e.target.value })} className={girdi} />
          </label>
        )}
        <label className="block text-sm">
          Kullanıcı adı
          <input required autoFocus autoCapitalize="off" autoComplete="username" value={f.kullaniciAdi} onChange={(e) => setF({ ...f, kullaniciAdi: e.target.value })} className={girdi} />
        </label>
        <label className="block text-sm">
          Şifre
          <input required type="password" autoComplete={kurulum ? 'new-password' : 'current-password'} value={f.sifre} onChange={(e) => setF({ ...f, sifre: e.target.value })} className={girdi} />
        </label>
        {hata && <p role="alert" className="text-sm text-red-600">{hata}</p>}
        <button disabled={mesgul} className="h-11 w-full rounded-lg bg-blue-600 font-medium text-white hover:bg-blue-700 disabled:opacity-60">
          {kurulum ? 'Yönetici hesabını oluştur' : 'Giriş yap'}
        </button>
        {demo && !kurulum && <p className="text-xs text-slate-500">Demo hesapları: <b>yonetici</b>, <b>satis</b>, <b>depo</b> — şifre: <b>demo1234</b></p>}
      </form>
    </div>
  )
}

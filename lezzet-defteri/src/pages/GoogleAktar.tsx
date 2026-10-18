import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { lzDb } from '../db'
import type { LzMekan, LzZiyaret } from '../types'
import { Header, T_BASLIK, T_GOVDE, T_SOLUK, Toast, useToast } from '../components/ui'
import { yerBul, yerlereGrupla, ziyaretleriOku, type Aday } from '../lib/zamanCizelgesi'
import { mesafeKm } from '../lib/mekan'

const KEY_ALINAN = 'lz-gz-alinan' // eklenen ya da istemedim denen yerler bir daha listelenmez
function alinanlar(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY_ALINAN) || '[]') as string[]
  } catch {
    return []
  }
}
function alinanEkle(k: string[]): void {
  try {
    localStorage.setItem(KEY_ALINAN, JSON.stringify(Array.from(new Set([...alinanlar(), ...k]))))
  } catch {
    /* yok */
  }
}
const tarihYaz = (t: string) => t.split('-').reverse().join('.')

type Satir = Aday & { puan: number; secili: boolean }

// GOOGLE'DAN AKTAR: Zaman Cizelgesi dosyasindaki yeme-icme yerleri listelenir; istemediklerini cikar,
// puan ver, secilenler "Gittigim yerler"e ziyaret tarihleriyle eklenir.
export default function GoogleAktar() {
  const navigate = useNavigate()
  const [satirlar, setSatirlar] = useState<Satir[]>([])
  const [durum, setDurum] = useState('')
  const [hata, setHata] = useState('')
  const [bitti, setBitti] = useState(false)
  const iptal = useRef(false)
  const [toast, goster] = useToast()

  const dosyaOku = async (f: File) => {
    setHata('')
    setSatirlar([])
    setBitti(false)
    iptal.current = false
    try {
      const ziyaret = ziyaretleriOku(await f.text())
      const atla = new Set(alinanlar())
      const yerler = yerlereGrupla(ziyaret).filter((y) => !atla.has(y.anahtar))
      if (!ziyaret.length) throw new Error('Dosyada ziyaret bulunamadı. Doğru dosyayı (Zaman Çizelgesi dışa aktarımı) seçtiğinden emin ol.')
      if (!yerler.length) throw new Error('Bu dosyadaki yerlerin hepsine daha önce bakılmış.')
      for (let i = 0; i < yerler.length && !iptal.current; i++) {
        setDurum(`${yerler.length} yerden ${i + 1}. kontrol ediliyor… (yeme-içme yerleri ayıklanıyor)`)
        const y = yerler[i]
        const s = await yerBul(y)
        if (s.yeme) setSatirlar((l) => [...l, { anahtar: y.anahtar, lat: y.lat, lon: y.lon, ad: s.ad, tur: s.tur, ilce: s.ilce, sehir: s.sehir, adres: s.adres, tarihler: y.tarihler, puan: 0, secili: true }])
      }
      setBitti(true)
    } catch (e) {
      setHata((e as Error).message.includes('JSON') ? 'Dosya okunamadı; Zaman Çizelgesi’nden dışa aktarılan .json dosyasını seç.' : (e as Error).message)
    }
    setDurum('')
  }

  const degis = (k: string, p: Partial<Satir>) => setSatirlar((l) => l.map((x) => (x.anahtar === k ? { ...x, ...p } : x)))
  const secililer = satirlar.filter((x) => x.secili)

  const ekle = async () => {
    const hepsi = await lzDb.mekanlar.toArray()
    let yeni = 0
    let guncel = 0
    for (const x of secililer) {
      const ad = x.ad.trim() || 'Adı bilinmeyen yer'
      const ziyaretler: LzZiyaret[] = x.tarihler.map((t, i) => ({ tarih: t, puan: i === 0 ? x.puan : 0, yedim: '', not: 'Google Zaman Çizelgesi’nden', tekrar: '' }))
      // Ayni mekan zaten kayitliysa (ayni ad ya da 60 m icinde) yalnizca eksik ziyaretler eklenir
      const var_ = hepsi.find(
        (m) =>
          (m.ad.toLocaleLowerCase('tr') === ad.toLocaleLowerCase('tr') && (!m.sehir || !x.sehir || m.sehir === x.sehir)) ||
          (m.lat !== undefined && m.lon !== undefined && mesafeKm({ lat: m.lat, lon: m.lon }, { lat: x.lat, lon: x.lon }) < 0.06)
      )
      if (var_) {
        const olan = new Set((var_.ziyaretler ?? []).map((z) => z.tarih))
        await lzDb.mekanlar.update(var_.id!, { gidildi: true, ziyaretler: [...(var_.ziyaretler ?? []), ...ziyaretler.filter((z) => !olan.has(z.tarih))] })
        guncel++
      } else {
        const m: LzMekan = {
          ad,
          tur: x.tur,
          adres: x.adres,
          ilce: x.ilce,
          sehir: x.sehir,
          lat: x.lat,
          lon: x.lon,
          konumKaynak: 'harita',
          oneriler: [],
          fiyat: '',
          notlar: '',
          etiketler: [],
          foto: '',
          sourceUrl: '',
          platform: 'manual',
          gidildi: true,
          createdAt: Date.now(),
          ziyaretler
        }
        await lzDb.mekanlar.add(m)
        yeni++
      }
    }
    alinanEkle(satirlar.map((x) => x.anahtar))
    goster(`${yeni} yeni mekan eklendi${guncel ? `, ${guncel} mekana ziyaret eklendi` : ''}`)
    setTimeout(() => navigate('/gittiklerim', { replace: true }), 900)
  }

  return (
    <div>
      <Header title="Google’dan aktar" subtitle="Zaman Çizelgesi’ndeki yeme-içme yerleri" back />
      <div className="px-4 space-y-3 pb-28">
        {!satirlar.length && !durum && (
          <div className="lz-card p-4 space-y-2.5">
            <div className={`font-semibold ${T_BASLIK}`}>1. Dosyayı telefondan al</div>
            <ol className={`text-[13.5px] space-y-1 list-decimal pl-5 ${T_GOVDE}`}>
              <li>
                Telefonun <b>Ayarlar → Konum → Konum servisleri → Zaman Çizelgesi</b>’ne gir.
              </li>
              <li>
                <b>Zaman Çizelgesi verilerini dışa aktar</b>’a bas, dosyayı <b>İndirilenler</b>’e kaydet.
              </li>
              <li>Aşağıdaki düğmeyle o dosyayı seç.</li>
            </ol>
            <p className={`text-[12px] ${T_SOLUK}`}>
              Dosya telefonundan dışarı gönderilmez; sadece yerlerin konumu, adlarını bulmak için OpenStreetMap’e sorulur. Yapay zeka kullanılmaz, kredi
              harcanmaz.
            </p>
          </div>
        )}
        {!durum && (
          <label className="lz-btn-primary w-full cursor-pointer">
            {satirlar.length || bitti ? 'Başka bir dosya seç' : '2. Zaman Çizelgesi dosyasını seç'}
            <input
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) void dosyaOku(f)
              }}
            />
          </label>
        )}
        {durum && (
          <div className="lz-card p-3.5 flex items-center gap-3">
            <span className="w-5 h-5 rounded-full border-[2.5px] border-lz-600 border-t-transparent animate-spin flex-shrink-0" />
            <span className={`flex-1 text-[13.5px] ${T_GOVDE}`}>{durum}</span>
            <button className="lz-chip text-[12px]" onClick={() => (iptal.current = true)}>
              Durdur
            </button>
          </div>
        )}
        {hata && <div className="rounded-2xl bg-rose-50 dark:bg-[#2a1a1d] text-rose-700 dark:text-rose-300 text-sm p-3">{hata}</div>}
        {bitti && !satirlar.length && !hata && <div className={`lz-card p-4 text-[13.5px] ${T_GOVDE}`}>Bu dosyada yeme-içme yeri bulunamadı.</div>}

        {satirlar.length > 0 && (
          <p className={`text-[12.5px] px-1 ${T_SOLUK}`}>İstemediklerinin işaretini kaldır, istersen yıldızla puan ver. Puan, son ziyarete yazılır.</p>
        )}
        {satirlar.map((x) => (
          <div key={x.anahtar} className={`lz-card p-3.5 space-y-1.5 ${x.secili ? '' : 'opacity-50'}`}>
            <div className="flex items-start gap-3">
              <input type="checkbox" className="w-5 h-5 mt-1 flex-shrink-0" checked={x.secili} onChange={(e) => degis(x.anahtar, { secili: e.target.checked })} />
              <div className="flex-1 min-w-0">
                <input
                  className={`w-full bg-transparent font-semibold text-[15px] outline-none border-b border-transparent focus:border-lz-400 ${T_BASLIK}`}
                  value={x.ad}
                  placeholder="Adı bilinmiyor — yaz"
                  onChange={(e) => degis(x.anahtar, { ad: e.target.value })}
                />
                <div className={`text-[12px] ${T_SOLUK}`}>{[x.tur, x.ilce, x.sehir].filter(Boolean).join(' · ')}</div>
                <div className={`text-[12px] ${T_GOVDE}`}>
                  {x.tarihler.length > 1 ? `${x.tarihler.length} kez gittin · son ${tarihYaz(x.tarihler[0])}` : `${tarihYaz(x.tarihler[0])} tarihinde gittin`}
                </div>
              </div>
            </div>
            <div className="flex gap-1 pl-8">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  className={`text-[22px] leading-none ${n <= x.puan ? 'text-amber-500' : 'text-[#d4d4d8] dark:text-[#3a3a40]'}`}
                  aria-label={`${n} yıldız`}
                  onClick={() => degis(x.anahtar, { puan: x.puan === n ? 0 : n, secili: true })}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {satirlar.length > 0 && !durum && (
        <div className="fixed left-0 right-0 max-w-xl mx-auto px-4 z-30" style={{ bottom: 'calc(5.25rem + env(safe-area-inset-bottom))' }}>
          <button className="lz-btn-primary w-full shadow-lg" disabled={!secililer.length} onClick={() => void ekle()}>
            Seçilenleri Gittiğim yerler’e ekle ({secililer.length})
          </button>
        </div>
      )}
      <Toast text={toast} />
    </div>
  )
}

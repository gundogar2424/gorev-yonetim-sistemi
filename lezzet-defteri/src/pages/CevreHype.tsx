import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { lzDb } from '../db'
import { aiCevreHype, apiAnahtari, saglayici, type MekanOnerisi } from '../lib/ai'
import { ayniMekan, mesafeKm, mesafeYaz, oneriKaydet } from '../lib/mekan'
import { merkezAl, useMerkez } from '../lib/merkez'
import { fiyatYazi } from '../lib/mekanGoster'
import { disariAc } from '../lib/disariAc'
import { DahaFazlaGoster, MESAFE_KM } from '../components/DahaFazla'
import { guvenSkoru, ReklamRozeti } from './Takip'
import { Header, IskeletKartlar, Sheet, T_BASLIK, T_GOVDE, T_SOLUK, Thumb, Toast, useToast } from '../components/ui'

// CEVREMDEKI HYPE: bulundugun yerin cevresinde son zamanlarda cok konusulan, yuksek puanli, HENUZ KAYITLI OLMAYAN yerler.
// Konum onceligi Yakininda ile ayni (GPS > yazilan semt > son GPS en fazla 6 saat). 1 km ile baslar; Daha fazla goster ile 3, 5, 10 km.
// Tek aramada en fazla 25 mekan; ayni arama 24 saat onbellekten gosterilir (para harcanmaz).

const KEY = 'lz-cevre-hype' // { [anahtar]: { zaman, merkez, km, liste } }
const SAAT24 = 24 * 3600 * 1000
interface Kayit {
  zaman: number
  lat: number
  lon: number
  km: number
  liste: MekanOnerisi[]
}
function onbellek(): Kayit[] {
  try {
    const l = JSON.parse(localStorage.getItem(KEY) || '[]') as Kayit[]
    return Array.isArray(l) ? l.filter((x) => Date.now() - x.zaman < SAAT24) : []
  } catch {
    return []
  }
}
// Ayni yer (300 m icinde) ve ayni mesafe icin 24 saat icindeki arama
function onbellektenBul(k: { lat: number; lon: number }, km: number): Kayit | undefined {
  return onbellek()
    .filter((x) => x.km === km && mesafeKm(k, { lat: x.lat, lon: x.lon }) < 0.3)
    .sort((a, b) => b.zaman - a.zaman)[0]
}
function onbellegeYaz(k: Kayit): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([k, ...onbellek().filter((x) => !(x.km === k.km && mesafeKm(k, x) < 0.3))].slice(0, 8)))
  } catch {
    /* yok */
  }
}

type Sonuc = MekanOnerisi & { km: number; kayitliId?: number }

export default function CevreHype() {
  const navigate = useNavigate()
  const mz = useMerkez()
  const [km, setKm] = useState(MESAFE_KM[0])
  const [liste, setListe] = useState<Sonuc[] | null>(null)
  const [durum, setDurum] = useState('')
  const [hata, setHata] = useState('')
  const [zaman, setZaman] = useState(0) // onbellekten geldiyse aramanin zamani
  const [secili, setSecili] = useState<Sonuc | null>(null)
  const [toast, goster] = useToast()
  const sira = useRef(0)

  useEffect(() => {
    void merkezAl()
  }, [])

  const ara = async (yaricap: number) => {
    const k = mz.konum
    if (!k) return
    const no = ++sira.current
    setHata('')
    const eski = onbellektenBul(k, yaricap)
    let ham: MekanOnerisi[]
    if (eski) {
      ham = eski.liste
      setZaman(eski.zaman)
    } else {
      if (!apiAnahtari() || saglayici() !== 'gemini') {
        setListe([])
        setHata('Çevremdeki Hype Google araması gerektirir; yalnızca Gemini anahtarıyla çalışır (Ayarlar › Yapay zeka).')
        return
      }
      setDurum(`${yaricap} km içindeki hype mekanlar araştırılıyor…`)
      try {
        ham = await aiCevreHype(mz.ad, k, yaricap, (await lzDb.mekanlar.toArray()).map((m) => m.ad))
        onbellegeYaz({ zaman: Date.now(), lat: k.lat, lon: k.lon, km: yaricap, liste: ham })
        setZaman(0)
      } catch (e) {
        if (no === sira.current) {
          setHata((e as Error).message)
          setDurum('')
          setListe((l) => l ?? [])
        }
        return
      }
    }
    // Kayitli olanlar elenir (ayni ad + ayni sehir ya da 300 m); mesafesi dogrulanamayan ya da disarida kalan gosterilmez
    const sonuc: Sonuc[] = []
    for (const o of ham) {
      if (!(o.enlem || o.boylam)) continue
      const uzak = mesafeKm(k, { lat: o.enlem, lon: o.boylam })
      if (uzak > yaricap * 1.1) continue
      if (await ayniMekan({ ad: o.ad, sehir: o.sehir, lat: o.enlem, lon: o.boylam })) continue
      sonuc.push({ ...o, km: uzak })
    }
    // Mekan siralamasi ile ayni: Google puani x yorum sayisinin logaritmasi, reklamsa %15 dusuk, hype %15 yuksek
    sonuc.sort((a, b) => guvenSkoru(b) * 1.15 - guvenSkoru(a) * 1.15)
    if (no !== sira.current) return
    setListe(sonuc)
    setDurum('')
  }

  // Konum hazir olunca ve mesafe degisince ara
  useEffect(() => {
    if (mz.durum === 'tamam' && mz.konum) void ara(km)
  }, [mz.durum, mz.konum?.lat, mz.konum?.lon, km])

  const kaydet = async (o: Sonuc, istek: boolean): Promise<number> => {
    const id = o.kayitliId ?? (await oneriKaydet(o, istek))
    await lzDb.mekanlar.update(id, { hype: { var: true, not: o.neden || o.populerlik, zaman: Date.now() }, reklam: o.reklam || undefined, ...(istek ? { gitmekIstiyorum: true } : {}) })
    setListe((l) => (l ?? []).map((x) => (x === o ? { ...x, kayitliId: id } : x)))
    return id
  }

  return (
    <div>
      <Header title="Çevremdeki Hype" subtitle={mz.konum ? `${mz.ad || 'Bulunduğun yer'} · ${km} km içinde` : 'Yakınında çok konuşulan yerler'} back />
      <div className="px-4 pt-3 space-y-3">
        {mz.durum === 'kapali' ? (
          // Konum yoksa hicbir sey uydurulmaz
          <div className="lz-card p-4 text-[14px]" data-hype-kapali>
            <span className={T_GOVDE}>Konum kapalı · </span>
            <button className="text-lz-600 font-bold min-h-[48px]" onClick={() => void merkezAl(true)}>
              Konumumu bul
            </button>
          </div>
        ) : mz.durum !== 'tamam' ? (
          <p className={`text-[13.5px] ${T_SOLUK}`}>Konum alınıyor…</p>
        ) : null}

        {durum && <p className={`text-[13.5px] ${T_SOLUK}`}>{durum}</p>}
        {hata && <p className="rounded-xl bg-amber-50 dark:bg-[#33270f] text-amber-900 dark:text-amber-200 text-[13.5px] px-3 py-2">{hata}</p>}
        {zaman > 0 && !durum && (
          <p className={`text-[12px] ${T_SOLUK}`} data-hype-onbellek>
            {Math.max(1, Math.round((Date.now() - zaman) / 60000))} dk önceki arama (kredi harcanmadı); 24 saat sonra yenilenir.
          </p>
        )}
        {durum && !liste && <IskeletKartlar adet={4} izgara />}

        {mz.durum === 'tamam' && liste && !durum && liste.length === 0 && !hata && (
          <div className={`lz-card p-6 text-center text-sm ${T_GOVDE}`} data-hype-bos>
            Yakınında hype mekan bulunamadı
          </div>
        )}

        {liste && liste.length > 0 && (
          <div className="grid grid-cols-2 gap-3" data-hype-liste>
            {liste.map((o) => (
              <div key={`${o.ad}|${o.enlem}`} className="lz-card lz-gezi overflow-hidden flex flex-col min-w-0" data-hype-kart>
                <button className="relative block text-left" onClick={() => setSecili(o)} aria-label={o.ad}>
                  <Thumb src="" className="w-full rounded-none aspect-[4/3]" emoji="" />
                  <span className="absolute bottom-2 left-2 flex gap-1 items-center">
                    <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-lz-600 text-white">Hype</span>
                    {o.reklam && <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-black/60 text-white">Reklam</span>}
                  </span>
                </button>
                <button className="p-2.5 flex flex-col gap-1 flex-1 min-w-0 text-left" onClick={() => setSecili(o)}>
                  <span className={`lz-baslik font-semibold text-[15px] leading-[1.3] line-clamp-2 min-h-[2.6em] ${T_BASLIK}`}>{o.ad}</span>
                  <span className={`text-[12px] truncate ${T_SOLUK}`}>
                    {o.puan ? <b className="text-amber-700 dark:text-amber-300 font-semibold">★ {o.puan.toFixed(1).replace('.', ',')}{o.yorumSayisi ? ` (${o.yorumSayisi.toLocaleString('tr')})` : ''}</b> : null}
                    {o.puan && (o.tur || o.ilce) ? ' · ' : ''}
                    {[o.tur, o.ilce].filter(Boolean).join(' · ')}
                  </span>
                  <span className={`text-[12px] truncate ${T_GOVDE}`} data-neden>
                    {o.neden || o.populerlik || '—'}
                  </span>
                  <span className="text-[12px] font-semibold min-h-[1.4em] truncate text-lz-600">{[mesafeYaz(o.km), fiyatYazi(o.fiyat) ? `${fiyatYazi(o.fiyat)}${/Uygun|Orta|Pahalı/.test(fiyatYazi(o.fiyat)) ? ' fiyat' : ''}` : ''].filter(Boolean).join(' · ')}</span>
                </button>
                <div className="px-2.5 pb-2.5">
                  <button
                    className={`lz-chip w-full justify-center !px-2 ${o.kayitliId ? 'lz-chip-on' : ''}`}
                    disabled={!!o.kayitliId}
                    onClick={async () => {
                      await kaydet(o, true)
                      goster(`${o.ad} “Gitmek istediklerim”e eklendi`)
                    }}
                    data-hype-istek
                  >
                    {o.kayitliId ? '✓ Eklendi' : '+ Gitmek istiyorum'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {mz.durum === 'tamam' && liste && <DahaFazlaGoster simdiKm={km} kapali={!!durum} buyut={(yeni) => setKm(yeni)} />}
        <p className={`text-[12px] ${T_SOLUK}`}>
          Kayıtlı mekanların burada gösterilmez. Bir aramada en fazla 25 mekan araştırılır; aynı arama 24 saat içinde yeniden para harcamaz. Google araması yalnızca Gemini’de çalışır ve Ayarlar’daki harcama sayacına eklenir.
        </p>
      </div>

      {/* Karta dokununca mekanin sayfasi: bilgiler, kaydet, gitmek istiyorum, yol tarifi */}
      <Sheet open={!!secili} onClose={() => setSecili(null)} title={secili?.ad ?? ''}>
        {secili && (
          <div className="space-y-2.5" data-hype-sayfa>
            <p className={`text-[13.5px] ${T_GOVDE}`}>
              {[secili.tur, [secili.ilce, secili.sehir].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
              {secili.reklam && <ReklamRozeti />}
            </p>
            {secili.puan > 0 && (
              <p className={`text-[14px] font-semibold ${T_BASLIK}`}>
                ★ {secili.puan.toFixed(1).replace('.', ',')}
                {secili.yorumSayisi ? ` (${secili.yorumSayisi.toLocaleString('tr')} yorum)` : ''} · {mesafeYaz(secili.km)}
              </p>
            )}
            {(secili.neden || secili.populerlik) && (
              <p className={`text-[14px] ${T_GOVDE}`}>
                <b>Neden hype:</b> {[secili.neden, secili.populerlik].filter(Boolean).join(' ')}
              </p>
            )}
            {secili.ne_yenir.length > 0 && (
              <p className={`text-[14px] ${T_GOVDE}`}>
                <b>Ne yenir:</b> {secili.ne_yenir.join(', ')}
              </p>
            )}
            {secili.adres && <p className={`text-[13px] ${T_SOLUK}`}>{secili.adres}</p>}
            <button
              className="lz-btn-primary w-full"
              onClick={async () => {
                const id = await kaydet(secili, false)
                setSecili(null)
                navigate(`/mekan/${id}`)
              }}
              data-hype-kaydet
            >
              Mekanlarım’a kaydet ve sayfasını aç
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                className="lz-btn-soft !px-2"
                onClick={async () => {
                  await kaydet(secili, true)
                  goster(`${secili.ad} “Gitmek istediklerim”e eklendi`)
                  setSecili(null)
                }}
              >
                + Gitmek istiyorum
              </button>
              <button
                className="lz-btn-soft !px-2"
                onClick={() => void disariAc(`https://www.google.com/maps/dir/?api=1&destination=${secili.enlem},${secili.boylam}`)}
              >
                Yol tarifi
              </button>
            </div>
          </div>
        )}
      </Sheet>
      <Toast text={toast} />
    </div>
  )
}

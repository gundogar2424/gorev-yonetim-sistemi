import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { lzDb } from '../db'
import type { LzMekan } from '../types'
import { Header, T_BASLIK, T_GOVDE, T_SOLUK } from '../components/ui'
import { aiMekanOner, apiAnahtari, type MekanOnerisi } from '../lib/ai'
import { platformBul } from '../lib/importer'
import { adrestenKonum, konumdanAdres, mesafeKm, mesafeYaz, telefonKonumu, type Konum } from '../lib/mekan'

const ORNEKLER = [
  'Bu akşam iyi bir lahmacun',
  'Kore mutfağı denemek istiyorum, fiyat-performans olsun',
  'Manzaralı kahvaltı',
  'Ucuz ve doyurucu öğle yemeği',
  'Son zamanlarda çok konuşulan tatlıcı',
  'Romantik akşam yemeği'
]

type Sonuc = MekanOnerisi & { km?: number; kayitliId?: number }

const KEY_HESAP = 'lz-yemek-hesaplari'
function hesaplariOku(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY_HESAP) || '[]') as string[]
  } catch {
    return []
  }
}
// Ayni arama 24 saat icinde tekrar yapilirsa yapay zekaya gitmeden onceki sonuc gosterilir (token tasarrufu)
const KEY_ONBELLEK = 'lz-oneri-onbellek'
const GUN = 24 * 60 * 60 * 1000
type Onbellek = Record<string, { t: number; liste: MekanOnerisi[] }>
function onbellekOku(): Onbellek {
  try {
    const o = JSON.parse(localStorage.getItem(KEY_ONBELLEK) || '{}') as Onbellek
    for (const k of Object.keys(o)) if (Date.now() - o[k].t > GUN) delete o[k]
    return o
  } catch {
    return {}
  }
}
function onbellekYaz(anahtar: string, liste: MekanOnerisi[]): void {
  try {
    const o = onbellekOku()
    o[anahtar] = { t: Date.now(), liste }
    const anahtarlar = Object.keys(o).sort((a, b) => o[b].t - o[a].t)
    for (const k of anahtarlar.slice(20)) delete o[k]
    localStorage.setItem(KEY_ONBELLEK, JSON.stringify(o))
  } catch {
    /* yok */
  }
}

type Yemek = { ad: string; km: number }
type Arama = { istek: string; hesap: string; diyet: string; yemek?: Yemek }
const YARICAPLAR = [3, 5, 10]

function hesaplariYaz(h: string[]): void {
  try {
    localStorage.setItem(KEY_HESAP, JSON.stringify(h))
  } catch {
    /* yok */
  }
}

// MEKAN ONERISI: "canim su an … istiyor" — bulundugun yere gore Google'da arastirilip
// puan, fiyat ve sosyal medyadaki son durumuyla mekan onerilir.
export default function MekanOner() {
  const kayitli = useLiveQuery(() => lzDb.mekanlar.toArray(), [], [] as LzMekan[]) ?? []
  const [istek, setIstek] = useState('')
  const [semt, setSemt] = useState('')
  const [durum, setDurum] = useState('')
  const [hata, setHata] = useState('')
  const [sonuclar, setSonuclar] = useState<Sonuc[]>([])
  const aiVar = !!apiAnahtari()
  const [hesaplar, setHesaplar] = useState<string[]>(hesaplariOku())
  const [yeniHesap, setYeniHesap] = useState('')
  const [aktifHesap, setAktifHesap] = useState('')
  const plan = useLiveQuery(() => lzDb.diyet.get(1), [])
  const [diyetModu, setDiyetModu] = useState(false)
  const [yemekAd, setYemekAd] = useState('')
  const [yemekKm, setYemekKm] = useState(5)
  const [aktifYemek, setAktifYemek] = useState<Yemek>()
  const [sonArama, setSonArama] = useState<Arama>()
  const [onbellekten, setOnbellekten] = useState(0)

  const ara = async (istekMetni = istek, hesap = '', diyet = '', yemek?: Yemek, yenile = false) => {
    setHata('')
    setSonuclar([])
    setAktifHesap(hesap)
    setDiyetModu(!!diyet)
    setAktifYemek(yemek)
    setOnbellekten(0)
    setSonArama({ istek: istekMetni, hesap, diyet, yemek })
    try {
      // Nerede oldugum: yazilan semt ya da telefon konumu
      let yer = semt.trim()
      let k: Konum | undefined
      if (yer) {
        setDurum('Semt bulunuyor…')
        k = await adrestenKonum(yer)
      } else {
        setDurum('Konumun alınıyor…')
        try {
          k = await telefonKonumu(10000)
          yer = (await konumdanAdres(k)) || `${k.lat.toFixed(4)}, ${k.lon.toFixed(4)}`
        } catch {
          throw new Error('Konum alınamadı. Konumu aç ya da semt yaz (ör. “Moda, Kadıköy”).')
        }
      }
      // Konum ~1 km'ye yuvarlanir: ayni yerde ayni arama icin token harcanmaz
      const anahtar = [istekMetni.trim(), hesap, diyet, yemek ? `${yemek.ad.toLocaleLowerCase('tr')}|${yemek.km}` : '', k ? `${k.lat.toFixed(2)},${k.lon.toFixed(2)}` : yer.toLocaleLowerCase('tr')].join('|')
      const eski = yenile ? undefined : onbellekOku()[anahtar]
      let liste: MekanOnerisi[]
      if (eski) {
        liste = eski.liste
        setOnbellekten(eski.t)
      } else {
        setDurum(yemek ? `${yemek.ad} için ${yemek.km} km içindeki yerler araştırılıyor…` : `Yapay zeka ${yer} çevresinde araştırıyor…`)
        liste = await aiMekanOner(istekMetni.trim(), yer, kayitli.map((m) => m.ad), hesap, diyet, yemek)
        if (liste.length) onbellekYaz(anahtar, liste)
      }
      const ad = (x: string) => x.toLocaleLowerCase('tr').replace(/[^\p{L}\p{N}]+/gu, '')
      const sonuc: Sonuc[] = liste.map((o) => {
        const kayit = kayitli.find((m) => ad(m.ad) === ad(o.ad))
        const hedef = o.enlem || o.boylam ? { lat: o.enlem, lon: o.boylam } : kayit?.lat !== undefined ? { lat: kayit.lat, lon: kayit.lon! } : undefined
        return { ...o, kayitliId: kayit?.id, km: k && hedef ? mesafeKm(k, hedef) : undefined }
      })
      if (yemek) {
        // Yaricap disindakileri at; en iyi puanlidan baslayarak sirala
        const icerde = sonuc.filter((o) => o.km === undefined || o.km <= yemek.km + 0.5)
        setSonuclar(icerde.sort((a, b) => (b.puan || 0) - (a.puan || 0) || (a.km ?? 999) - (b.km ?? 999)))
        if (!icerde.length) setHata(`${yemek.km} km içinde iyi yorum almış ${yemek.ad} yapan yer bulunamadı; yarıçapı büyütmeyi dene.`)
      } else setSonuclar(sonuc.sort((a, b) => (a.km ?? 999) - (b.km ?? 999)))
      if (!sonuc.length && !yemek) setHata(hesap ? `${hesap.includes(',') ? 'Takip ettiğin hesapların' : `${hesap} hesabının`} yakınında tanıttığı mekan bulunamadı.` : 'Uygun mekan bulunamadı; isteği biraz değiştirip tekrar dene.')
    } catch (e) {
      setHata((e as Error).message)
    }
    setDurum('')
  }

  const kaydet = async (o: Sonuc) => {
    const id = await lzDb.mekanlar.add({
      ad: o.ad,
      tur: o.tur,
      adres: o.adres,
      ilce: o.ilce,
      sehir: o.sehir,
      lat: o.enlem || o.boylam ? o.enlem : undefined,
      lon: o.enlem || o.boylam ? o.boylam : undefined,
      konumKaynak: o.enlem || o.boylam ? 'arama' : '',
      oneriler: o.ne_yenir,
      fiyat: o.fiyat,
      notlar: [o.neden, o.populerlik].filter(Boolean).join('\n'),
      etiketler: [],
      foto: '',
      sourceUrl: o.link,
      platform: o.link ? platformBul(o.link) : 'manual',
      gidildi: false,
      createdAt: Date.now(),
      puan: o.puan || undefined,
      yorumSayisi: o.yorumSayisi || undefined,
      puanZamani: o.puan ? Date.now() : undefined
    })
    setSonuclar((s) => s.map((x) => (x === o ? { ...x, kayitliId: id } : x)))
  }

  const yolTarifi = (o: Sonuc) =>
    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(o.enlem || o.boylam ? `${o.enlem},${o.boylam}` : [o.ad, o.adres || o.ilce, o.sehir].filter(Boolean).join(', '))}`
  const haritada = (o: Sonuc) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([o.ad, o.adres || o.ilce, o.sehir].filter(Boolean).join(' '))}`

  return (
    <div>
      <Header title="Bana mekan öner" subtitle="Canın ne çekiyor?" back />
      <div className="px-4 space-y-3 pb-8">
        <div className="lz-card p-4 space-y-2.5">
          <textarea
            className="lz-input min-h-[80px] text-[15px]"
            placeholder="Ör. Bu akşam iyi bir lahmacun yemek istiyorum, fiyat-performans olsun"
            value={istek}
            onChange={(e) => setIstek(e.target.value)}
          />
          <div className="flex flex-wrap gap-1.5">
            {ORNEKLER.map((o) => (
              <button key={o} className="lz-chip text-[12.5px] !whitespace-normal text-left" onClick={() => setIstek(o)}>
                {o}
              </button>
            ))}
          </div>
          <input className="lz-input py-2 text-[14px]" placeholder="Nerede? Boş bırakırsan konumun kullanılır (ya da semt yaz)" value={semt} onChange={(e) => setSemt(e.target.value)} />
          <button className="lz-btn-primary w-full" disabled={!aiVar || !istek.trim() || !!durum} onClick={() => void ara()}>
            {durum || '✨ Öner'}
          </button>
          <button
            className="lz-btn-soft w-full"
            disabled={!aiVar || !!durum}
            onClick={() => void ara('Şu an sosyal medyada (Instagram, TikTok) çok konuşulan, hype olan, gitmeye değer yeme-içme mekanları')}
          >
            🔥 Yakınımda şu an popüler olanlar
          </button>
          {!aiVar && (
            <p className="text-[12.5px] text-rose-600 dark:text-rose-300">
              Bunun için <Link to="/ayarlar" className="underline font-semibold">Ayarlar</Link>’dan Gemini anahtarı gerekli.
            </p>
          )}
          {hata && <div className="rounded-2xl bg-rose-50 dark:bg-[#2a1a1d] text-rose-700 dark:text-rose-300 text-sm p-3">⚠️ {hata}</div>}
        </div>

        <div className="lz-card p-4 space-y-2.5">
          <div className={`font-semibold ${T_BASLIK}`}>🍽️ Canım şu yemeği çekiyor</div>
          <p className={`text-[12.5px] ${T_SOLUK}`}>Yemeği yaz, mesafeyi seç: o yemeği en iyi yapan yakın yerler, yemeğin oradaki fiyatıyla listelenir.</p>
          <input className="lz-input py-2 text-[14px]" placeholder="Ör. Tavuk şinitzel" value={yemekAd} onChange={(e) => setYemekAd(e.target.value)} />
          <div className="flex gap-1.5">
            {YARICAPLAR.map((km) => (
              <button key={km} className={`lz-chip text-[13px] flex-1 ${yemekKm === km ? 'lz-chip-on' : ''}`} onClick={() => setYemekKm(km)}>
                {km} km
              </button>
            ))}
          </div>
          <button
            className="lz-btn-primary w-full"
            disabled={!aiVar || !yemekAd.trim() || !!durum}
            onClick={() => void ara(`Bana yakın, en iyi yorum almış ${yemekAd.trim()} yapan yerler`, '', '', { ad: yemekAd.trim(), km: yemekKm })}
          >
            {durum && aktifYemek ? durum : `🍽️ ${yemekKm} km içinde en iyisini bul`}
          </button>
        </div>

        {plan && plan.ogunler.length > 0 && (
          <div className="lz-card p-4 space-y-2.5">
            <div className={`font-semibold ${T_BASLIK}`}>🥗 Diyetime uygun yakın restoran</div>
            <p className={`text-[12.5px] ${T_SOLUK}`}>Öğünü seç: menüsünde diyetine uyan yemek olan yakın restoranlar ve ne sipariş edeceğin listelenir.</p>
            <div className="flex flex-wrap gap-1.5">
              {plan.ogunler.map((o, i) => (
                <button
                  key={i}
                  className="lz-chip text-[13px]"
                  disabled={!aiVar || !!durum}
                  onClick={() =>
                    void ara(
                      `${o.ad} için diyetime uygun yemek yiyebileceğim restoran`,
                      '',
                      `Öğün: ${o.ad}\nDiyetisyenin bu öğün için yazdığı: ${o.icerik}\nHedef: ~${Math.round(o.hedef.kalori)} kcal, protein ${Math.round(o.hedef.protein)} g, karbonhidrat ${Math.round(o.hedef.karb)} g, yağ ${Math.round(o.hedef.yag)} g` +
                        (plan.notlar ? `\nPlanın genel kuralları: ${plan.notlar.slice(0, 800)}` : '')
                    )
                  }
                >
                  🥗 {o.ad}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="lz-card p-4 space-y-2.5">
          <div className={`font-semibold ${T_BASLIK}`}>📱 Takip ettiğim yemek hesapları</div>
          <p className={`text-[12.5px] ${T_SOLUK}`}>Hesaba dokun: o hesabın tanıttığı mekanlardan sana yakın olanlar önerilir.</p>
          <div className="flex flex-wrap gap-1.5">
            {hesaplar.map((h) => (
              <span key={h} className="inline-flex items-center">
                <button className="lz-chip text-[13px]" disabled={!aiVar || !!durum} onClick={() => void ara(`${h} hesabının önerdiği mekanlar`, h)}>
                  {h}
                </button>
                <button
                  className={`ml-0.5 text-[13px] px-1 ${T_SOLUK}`}
                  aria-label={`${h} sil`}
                  onClick={() => {
                    const y = hesaplar.filter((x) => x !== h)
                    setHesaplar(y)
                    hesaplariYaz(y)
                  }}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
          {hesaplar.length > 1 && (
            <button
              className="lz-btn-primary w-full text-[14px]"
              disabled={!aiVar || !!durum}
              onClick={() => void ara('Takip ettiğim hesapların tanıttığı mekanlar', hesaplar.join(', '))}
            >
              🔥 Hepsinin buraya yakın önerdikleri ({hesaplar.length} hesap)
            </button>
          )}
          <div className="flex gap-2">
            <input className="lz-input py-2 text-[14px] min-w-0" placeholder="Meşhur hesap: @hesapadi ya da profil linki" value={yeniHesap} onChange={(e) => setYeniHesap(e.target.value)} />
            <button
              className="lz-btn-soft px-3 text-sm"
              disabled={!yeniHesap.trim()}
              onClick={() => {
                const t = yeniHesap.trim()
                const ad = t.match(/(?:instagram|tiktok)\.com\/@?([\w.]+)/i)?.[1] ?? t.replace(/^@/, '')
                const h = `@${ad}`
                if (!hesaplar.includes(h)) {
                  const y = [...hesaplar, h]
                  setHesaplar(y)
                  hesaplariYaz(y)
                }
                setYeniHesap('')
              }}
            >
              Ekle
            </button>
          </div>
        </div>

        {sonuclar.length > 0 && (
          <div className={`flex items-center gap-2 px-1 text-[12.5px] ${T_SOLUK}`}>
            <span className="flex-1">
              {aktifYemek ? `${aktifYemek.ad}: ${aktifYemek.km} km içinde, en yüksek puanlıdan` : `${sonuclar.length} öneri`}
              {onbellekten ? ` · ${Math.max(1, Math.round((Date.now() - onbellekten) / 60000))} dk önceki arama (kredi harcanmadı)` : ''}
            </span>
            {onbellekten > 0 && sonArama && (
              <button className="lz-chip text-[12px]" disabled={!!durum} onClick={() => void ara(sonArama.istek, sonArama.hesap, sonArama.diyet, sonArama.yemek, true)}>
                ↻ Yeniden ara
              </button>
            )}
          </div>
        )}
        {aktifHesap && sonuclar.length > 0 && <div className={`text-[13px] px-1 font-semibold ${T_GOVDE}`}>{aktifHesap.includes(',') ? 'Takip ettiğin hesapların' : `${aktifHesap} hesabının`} önerdikleri:</div>}
        {sonuclar.map((o, i) => (
          <div key={i} className="lz-card p-4 space-y-1.5">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className={`font-bold text-[16px] leading-snug ${T_BASLIK}`}>{o.ad}</div>
                <div className={`text-[12.5px] ${T_SOLUK}`}>{[o.tur, o.ilce, o.sehir].filter(Boolean).join(' · ')}</div>
              </div>
              {o.km !== undefined && <div className="text-[13px] font-semibold text-lz-600 whitespace-nowrap">{mesafeYaz(o.km)}</div>}
            </div>
            <div className={`text-[13px] ${T_GOVDE}`}>
              {o.puan ? <b className="text-amber-600 dark:text-amber-300">⭐ {o.puan.toFixed(1).replace('.', ',')}{o.yorumSayisi ? ` (${o.yorumSayisi.toLocaleString('tr')})` : ''}</b> : null}
              {o.puan && o.fiyat ? ' · ' : ''}
              {o.fiyat}
            </div>
            {aktifYemek && o.yemek_fiyati && (
              <div className="rounded-xl bg-[#f6efe7] dark:bg-[#2a2420] px-3 py-1.5 text-[14px] font-semibold text-lz-600">
                🍽️ {aktifYemek.ad}: {o.yemek_fiyati}
              </div>
            )}
            {aktifYemek && o.yemek_yorumu && <p className={`text-[13px] ${T_GOVDE}`}>💬 {o.yemek_yorumu}</p>}
            <p className={`text-[13.5px] ${T_GOVDE}`}>{o.neden}</p>
            {o.ne_yenir.length > 0 && <p className={`text-[13px] ${T_GOVDE}`}>{diyetModu ? '🥗 Sipariş: ' : '😋 '}{o.ne_yenir.slice(0, 4).join(', ')}</p>}
            {o.populerlik && <p className={`text-[12.5px] ${T_SOLUK}`}>📱 {o.populerlik}</p>}
            {o.link && (
              <a href={o.link} target="_blank" rel="noreferrer" className="text-[13px] text-lz-600 font-semibold underline">
                ▶ Tanıtım paylaşımını aç
              </a>
            )}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <a href={yolTarifi(o)} target="_blank" rel="noreferrer" className="lz-btn-primary text-[12.5px] px-2">
                🧭 Git
              </a>
              <a href={haritada(o)} target="_blank" rel="noreferrer" className="lz-btn-soft text-[12.5px] px-2">
                🗺️ Yorumlar
              </a>
              {o.kayitliId ? (
                <Link to={`/mekan/${o.kayitliId}`} className="lz-btn-soft text-[12.5px] px-2">
                  ✓ Kayıtlı
                </Link>
              ) : (
                <button className="lz-btn-soft text-[12.5px] px-2" onClick={() => void kaydet(o)}>
                  ＋ Kaydet
                </button>
              )}
            </div>
          </div>
        ))}
        {sonuclar.length > 0 && (
          <p className={`text-[11.5px] text-center px-2 ${T_SOLUK}`}>
            Öneriler yapay zekanın Google araması; puan, fiyat ve açık olup olmadığını gitmeden önce Google Haritalar’dan kontrol et.
          </p>
        )}
      </div>
    </div>
  )
}

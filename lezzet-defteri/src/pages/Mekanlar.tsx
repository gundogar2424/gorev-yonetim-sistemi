import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { lzDb } from '../db'
import { guvenSkoru } from './Takip'
import { sinirsizTeklif } from './Sinirsiz'
import Buradayim from '../components/Buradayim'
import { bugunAyYil, odemeler, tlYaz } from '../lib/harcama'
import type { LzMekan } from '../types'
import { Header, Icon, IskeletKartlar, T_BASLIK, T_GOVDE, T_SOLUK, Thumb } from '../components/ui'
import { SonAramalar } from '../components/SonAramalar'
import { DahaFazlaGoster, MESAFE_KM } from '../components/DahaFazla'
import { aiMekanHype, apiAnahtari } from '../lib/ai'
import { bildirimIzniIste, kampanyaKontrolEt, sonKontrol, useKampanyaDurumu } from '../lib/kampanya'
import { etiketAdi, fiyatSeviyesi } from '../lib/mekanGoster'
import { buHaftaBaslik, etkinlikSehri } from '../lib/etkinlik'
import { merkezAl, semtMerkezi, useMerkez, yaricapIcinde, type Merkez } from '../lib/merkez'
import { esles, sonAramaEkle } from '../lib/arama'
import {
  puanYaz,
  adrestenKonum,
  mekanLinktenEkle,
  mesafeKm,
  mesafeYaz,
  type Konum
} from '../lib/mekan'

const YAKIN_KM = 3


// MEKANLARIM: internette gorulen yeme-icme yerleri. Yakinimdakiler en ustte.
// gomulu: Tarifler ekranindaki "Mekanlarım" sekmesinde; baslik ve arama kutusu disaridan gelir
// yakinIstek: durum seridindeki "Yakininda N mekan"a dokunuldu (her dokunusta artar) -> "Yakininda" suzgeci (1 km) acilir
export default function Mekanlar({ gomulu = false, disArama, yakinIstek = 0 }: { gomulu?: boolean; disArama?: string; yakinIstek?: number } = {}) {
  const navigate = useNavigate()
  const listeHam = useLiveQuery(() => lzDb.mekanlar.orderBy('createdAt').reverse().toArray(), [])
  const liste = listeHam ?? []
  // Konum tek kaynaktan: GPS > yazilan semt > son GPS konumu; yoksa kapali (uydurulmaz)
  const mz = useMerkez()
  const konum: Konum | null = mz.konum ? { ...mz.konum, ad: mz.ad || (mz.kaynak === 'semt' ? 'Yazdığın semt' : 'Bulunduğun yer') } : null
  const [konumMesaj, setKonumMesaj] = useState('')
  const [semt, setSemt] = useState('')
  const [link, setLink] = useState('')
  const [ekleniyor, setEkleniyor] = useState('')
  const [hata, setHata] = useState('')
  const [arama, setArama] = useState('')
  const [aramaOdak, setAramaOdak] = useState(false)
  const [sadeceGidilmedi, setSadeceGidilmedi] = useState(false)
  const [sadeceYeni, setSadeceYeni] = useState(false)
  const [sehirSec, setSehirSec] = useState('') // Sehir sec: '' = Tümü
  const [yakinMod, setYakinMod] = useState(false) // "Yakınımda ne var?" ile acildi: 1/3/10/30 km cipleri // son 7 gunde eklenenler, en yeni ustte
  // Mekan sayfasindaki etikete / yemege dokununca buraya ?etiket= / ?yemek= ile gelinir
  const [params] = useSearchParams()
  const [etiket, setEtiket] = useState(params.get('etiket') ?? '')
  const [yemek, setYemek] = useState(params.get('yemek') ?? '')
  const [sadeceFavori, setSadeceFavori] = useState(false)
  const [sadeceIstek, setSadeceIstek] = useState(false)
  const [sadeceHype, setSadeceHype] = useState(false)
  const [hypeDurum, setHypeDurum] = useState('')
  const [yaricap, setYaricap] = useState(yakinIstek ? MESAFE_KM[0] : 0) // 0 = hepsi
  // "Yakininda"ya her dokunusta 1 km suzgeci ve listeye kaydirma
  useEffect(() => {
    if (!yakinIstek) return
    digerleriniKapat('yakin')
    setYaricap(MESAFE_KM[0])
    setTimeout(() => document.getElementById('mekan-listesi')?.scrollIntoView({ behavior: 'smooth' }), 150)
  }, [yakinIstek])
  const [kampanyaAcik, setKampanyaAcik] = useState(false)
  const aiVar = !!apiAnahtari()

  // SUZGECLER TEKLI: Gitmek istediklerim, Favoriler, Hype, Gitmediklerim, Yeni, Yakininda'dan yalnizca biri secili olabilir
  const digerleriniKapat = (haric: 'istek' | 'favori' | 'hype' | 'gidilmedi' | 'yeni' | 'yakin') => {
    if (haric !== 'istek') setSadeceIstek(false)
    if (haric !== 'favori') setSadeceFavori(false)
    if (haric !== 'hype') {
      setSadeceHype(false)
      setHypeDurum('')
    }
    if (haric !== 'gidilmedi') setSadeceGidilmedi(false)
    if (haric !== 'yeni') setSadeceYeni(false)
    if (haric !== 'yakin') {
      setYaricap(0)
      setYakinMod(false)
    } else setSehirSec('') // Yakininda GPS'e gore calisir: sehir secimi onu daraltmaz
  }

  const konumuAl = async () => {
    setKonumMesaj('Konum alınıyor…')
    const r = await merkezAl(true)
    setKonumMesaj(r.kaynak === 'gps' ? '' : `${r.hata || 'Konum alınamadı.'} İstersen bulunduğun semti yaz.`)
  }

  // Ekran her acildiginda konum guncellenir (100 m'den az hareket edildiyse ayni konum)
  useEffect(() => {
    void merkezAl()
  }, [])

  const semtBul = async () => {
    setKonumMesaj('Semt aranıyor…')
    const k = await adrestenKonum(semt)
    if (!k) {
      setKonumMesaj('Bu semt bulunamadı; ilçe ve şehirle dene (ör. “Moda, Kadıköy, İstanbul”).')
      return
    }
    semtMerkezi(k, semt)
    setKonumMesaj('')
  }

  const ekle = async () => {
    setHata('')
    try {
      const { id, yeni, digerleri } = await mekanLinktenEkle(link.trim(), setEkleniyor)
      setLink('')
      navigate(`/mekan/${id}`, { state: { zatenVar: !yeni, digerleri } })
    } catch (e) {
      setHata((e as Error).message)
    }
    setEkleniyor('')
  }

  // Kayitli mekanlardaki etiketler (cok kullanilan once)
  const sayac = new Map<string, number>()
  liste.forEach((m) => m.etiketler.forEach((e) => sayac.set(e, (sayac.get(e) ?? 0) + 1)))
  const q = (gomulu ? disArama ?? '' : arama).trim().toLocaleLowerCase('tr')
  // Sehir sec: kayitli mekanlarin sehirleri; Tümü = butun sehirler
  const sehirAd = (x: string) => x.trim().toLocaleLowerCase('tr')
  const sehirler = [...new Map(liste.filter((m) => m.sehir?.trim()).map((m) => [sehirAd(m.sehir), m.sehir.trim()])).values()].sort((a, b) => a.localeCompare(b, 'tr'))
  const sehirUyar = (m: LzMekan) => !sehirSec || sehirAd(m.sehir ?? '') === sehirAd(sehirSec)
  const suzulmus = liste.filter(
    (m) =>
      sehirUyar(m) &&
      (!sadeceGidilmedi || !m.gidildi) &&
      (!sadeceYeni || yeniMekan(m)) &&
      (!etiket || m.etiketler.includes(etiket)) &&
      (!yemek || yemekGeciyor(m, yemek)) &&
      (!sadeceFavori || m.favori) &&
      (!sadeceIstek || m.gitmekIstiyorum) &&
      (!sadeceHype || m.hype?.var) &&
      (!yaricap || (konum && m.lat !== undefined && m.lon !== undefined && mesafeKm(konum, { lat: m.lat, lon: m.lon }) <= yaricap)) &&
      (!q || esles(q, `${m.ad} ${m.tur} ${m.ilce} ${m.sehir} ${m.oneriler.join(' ')} ${m.etiketler.join(' ')} ${m.notlar} ${m.kampanya?.ozet ?? ''} ${m.paylasanYorumu?.begendi ?? ''} ${m.paylasanYorumu?.yedi ?? ''}`))
  )
  const mesafe = (m: LzMekan) => (konum && m.lat !== undefined && m.lon !== undefined ? mesafeKm(konum, { lat: m.lat, lon: m.lon }) : undefined)
  // Etiket ya da yemek secilince bulundugum yerden uzaga dogru; digerlerinde en begenilen once (esitse yakin olan)
 // Yeni: en yeni en ustte (puan siralamasi yok); Yakininda/etiket/yemek: yakindan uzaga; digerleri: puana gore
  const sirali = sadeceYeni
    ? [...suzulmus].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    : etiket || yemek || yaricap
      ? [...suzulmus].sort((a, b) => (mesafe(a) ?? 1e9) - (mesafe(b) ?? 1e9) || mekanSkoru(b) - mekanSkoru(a))
      : [...suzulmus].sort((a, b) => mekanSkoru(b) - mekanSkoru(a) || (mesafe(a) ?? 1e9) - (mesafe(b) ?? 1e9))
  // Etiket / yemekle gelindiyse liste goruntulenir
  useEffect(() => {
    if (params.get('etiket') || params.get('yemek')) setTimeout(() => document.getElementById('mekan-listesi')?.scrollIntoView({ behavior: 'smooth' }), 300)
  }, [])
  // HYPE: listedeki mekanlardan hangileri su an sosyal medyada konusuluyor? Tek aramada en fazla 25 mekan;
  // son 7 gunde bakilanlara tekrar bakilmaz (kredi harcamamak icin)
  const hypeKontrol = async () => {
    if (sadeceHype) return setSadeceHype(false)
    digerleriniKapat('hype')
    setSadeceHype(true)
    const hafta = Date.now() - 7 * 24 * 3600 * 1000
    const bakilacak = sirali.filter((m) => !m.hype || m.hype.zaman < hafta).slice(0, 25)
    if (!bakilacak.length || !aiVar) return
    setHypeDurum(`${bakilacak.length} mekan sosyal medyada araştırılıyor…`)
    try {
      const sonuc = await aiMekanHype(bakilacak.map((m) => ({ ad: m.ad, yer: [m.ilce, m.sehir].filter(Boolean).join(', ') })))
      const ad = (x: string) => x.toLocaleLowerCase('tr').replace(/[^\p{L}\p{N}]+/gu, '')
      for (const m of bakilacak) {
        const s = sonuc.find((x) => ad(x.ad) === ad(m.ad))
        await lzDb.mekanlar.update(m.id!, { hype: { var: !!s?.hype, not: s?.not ?? '', zaman: Date.now() } })
      }
      setHypeDurum('')
    } catch (e) {
      setHypeDurum(`${(e as Error).message}`)
    }
  }
  const yakinlar = konum ? sirali.filter((m) => (mesafe(m) ?? 1e9) <= YAKIN_KM) : []
  // Hype suzgeci bos kalinca uyari kucuk kalir, altinda (hype haric ayni suzgeclerle) mekanlar gosterilir
  const hypeBos = sadeceHype && !hypeDurum && liste.length > 0 && sirali.length === 0
  const gosterilen = hypeBos
    ? liste
        .filter(
          (m) =>
            sehirUyar(m) &&
            (!sadeceGidilmedi || !m.gidildi) &&
            (!sadeceYeni || yeniMekan(m)) &&
            (!etiket || m.etiketler.includes(etiket)) &&
            (!yemek || yemekGeciyor(m, yemek)) &&
            (!sadeceFavori || m.favori) &&
            (!sadeceIstek || m.gitmekIstiyorum) &&
            (!yaricap || (konum && m.lat !== undefined && m.lon !== undefined && mesafeKm(konum, { lat: m.lat, lon: m.lon }) <= yaricap))
        )
        .sort((a, b) => mekanSkoru(b) - mekanSkoru(a) || (mesafe(a) ?? 1e9) - (mesafe(b) ?? 1e9))
    : sirali
  const listeyeGit = () => setTimeout(() => document.getElementById('mekan-listesi')?.scrollIntoView({ behavior: 'smooth' }), 100)
  const istekSayisi = liste.filter((m) => m.gitmekIstiyorum).length
  const sinirsizSayisi = liste.filter((m) => sinirsizTeklif(m)).length
  const gidilenSayisi = liste.filter((m) => m.gidildi).length
  const kampanyaSayisi = liste.filter((m) => m.kampanya && Date.now() - m.kampanya.zaman < 7 * 24 * 3600 * 1000).length
  const harcama = (() => {
    const { ay } = bugunAyYil()
    const l = odemeler(liste)
    return l.length ? `Bu ay ${tlYaz(l.filter((o) => o.tarih.startsWith(ay)).reduce((t, o) => t + o.tutar, 0))}` : 'Ödediğin hesaplar'
  })()

  return (
    <div>
      {!gomulu && <Header title="Mekanlarım" subtitle={liste.length ? `${liste.length} yeme-içme mekanı` : 'Gördüğün mekanları kaydet'} back />}
      <div className={gomulu ? 'space-y-3' : 'px-4 pt-3 space-y-3'}>
        {/* SEHIR SEC: secilen sehrin kayitli mekanlari; Tümü = butun sehirler. Yakininda ve GPS mantigi aynen kalir */}
        <label className={`flex items-center gap-2 text-[13.5px] font-semibold ${T_BASLIK}`} data-mekan-sehir>
          <span className="flex-shrink-0">Şehir seç</span>
          <select
            className="lz-input !min-h-[48px] flex-1 min-w-0"
            value={sehirSec}
            onChange={(e) => {
              setSehirSec(e.target.value)
              // Sehir secilince Yakininda kapanir (ikisi birlikte listeyi bosaltmasin)
              if (e.target.value) {
                setYaricap(0)
                setYakinMod(false)
              }
            }}
          >
            <option value="">Tümü</option>
            {sehirler.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </label>
        {/* YAKINIMDA NE VAR?: Yakininda suzgecine kisayol. Hicbir etiket/filtre uygulanmaz; yakindan uzaga, 1 km ile baslar */}
        <button
          className="lz-btn-primary w-full !min-h-[56px] text-[16.5px] font-bold"
          onClick={() => {
            setEtiket('')
            setYemek('')
            setSadeceFavori(false)
            setSadeceIstek(false)
            setSadeceHype(false)
            setSadeceGidilmedi(false)
            setSadeceYeni(false)
            setSehirSec('')
            setYakinMod(true)
            setYaricap(YAKIN_CIPLER[0])
            if (!konum) void merkezAl(true)
            listeyeGit()
          }}
          data-yakinimda-ne-var
        >
          <Icon name="pin" className="w-5 h-5" /> Yakınımda ne var?
        </button>

        {/* ETIKETLER: yalnizca 6 sabit etiket + Tumu (hepsi ayri ekranda) */}
        <div className="flex flex-wrap gap-1.5">
          {SABIT_ETIKETLER.map((e) => {
            const on = etiket === e
            return (
              <button
                key={e}
                className={`lz-chip text-[13px] ${on ? '!bg-lz-600 !border-lz-600 !text-white' : '!text-[#221C15] dark:!text-white'}`}
                onClick={() => {
                  setEtiket(on ? '' : e)
                  listeyeGit()
                }}
              >
                {e}
                <span className={`text-[11px] ${on ? 'text-white/80' : 'text-[#5C5245] dark:text-[#B3A998]'}`}>{sayac.get(e) ?? 0}</span>
              </button>
            )
          })}
          <Link to="/etiketler" className="lz-chip text-[13px] !text-lz-700 dark:!text-[#ff9f88] font-semibold">
            Tümü ›
          </Link>
        </div>

        {/* ARAMA ve SUZGECLER */}
        <div id="mekan-listesi" className="space-y-2 scroll-mt-24">
          {!gomulu && (
            <input
              className="lz-input py-2 text-[14px] w-full min-h-[48px]"
              placeholder="Ara: ad, semt, yemek…"
              value={arama}
              onChange={(e) => setArama(e.target.value)}
              onFocus={() => setAramaOdak(true)}
              onBlur={() => {
                setTimeout(() => setAramaOdak(false), 150)
                sonAramaEkle('mekan', arama)
              }}
              onKeyDown={(e) => e.key === 'Enter' && sonAramaEkle('mekan', arama)}
            />
          )}
          {!gomulu && aramaOdak && !arama && <SonAramalar tur="mekan" sec={(x) => setArama(x)} />}
          <div className="grid grid-cols-2 gap-2">
            <button className={`lz-chip justify-center !whitespace-normal text-center leading-tight ${sadeceIstek ? 'lz-chip-on' : ''}`} onClick={() => { digerleriniKapat('istek'); setSadeceIstek(!sadeceIstek) }} data-suzgec="istek">
              Gitmek istediklerim
            </button>
            <button className={`lz-chip justify-center !whitespace-normal text-center leading-tight ${sadeceFavori ? 'lz-chip-on' : ''}`} onClick={() => { digerleriniKapat('favori'); setSadeceFavori(!sadeceFavori) }} data-suzgec="favori">
              Favoriler
            </button>
            <button className={`lz-chip justify-center !whitespace-normal text-center leading-tight ${sadeceHype ? 'lz-chip-on' : ''}`} disabled={hypeDurum.endsWith('…')} onClick={() => void hypeKontrol()}>
              Hype
            </button>
            <button className={`lz-chip justify-center !whitespace-normal text-center leading-tight ${sadeceGidilmedi ? 'lz-chip-on' : ''}`} onClick={() => { digerleriniKapat('gidilmedi'); setSadeceGidilmedi(!sadeceGidilmedi) }} data-suzgec="gidilmedi">
              Gitmediklerim
            </button>
            {/* Yeni: son 7 gunde eklenen mekanlar (7 gun dolunca kendiliginden cikar) */}
            <button
              className={`lz-chip col-span-2 justify-center !whitespace-normal text-center leading-tight ${sadeceYeni ? 'lz-chip-on' : ''}`}
              onClick={() => {
                digerleriniKapat('yeni')
                setSadeceYeni(!sadeceYeni)
              }}
              data-mekan-yeni
            >
              Yeni
            </button>
            {/* Yakininda: ayri ekran degil; ayni liste 1 km icindekilerle, yakindan uzaga (Daha fazla goster ile 3, 5, 10 km) */}
            <button
              className={`lz-chip col-span-2 justify-center !whitespace-normal text-center leading-tight ${yaricap > 0 ? 'lz-chip-on' : ''}`}
              onClick={() => {
                setYakinMod(false)
                if (yaricap) return setYaricap(0)
                digerleriniKapat('yakin')
                setYaricap(MESAFE_KM[0])
                if (!konum) void merkezAl(true)
              }}
              data-yakininda
            >
              <Icon name="pin" className="w-4 h-4" /> Yakınında
            </button>
          </div>
          {(yemek || (etiket && !SABIT_ETIKETLER.includes(etiket)) || yaricap > 0) && (
            <div className="flex items-center gap-2 flex-wrap">
              {yemek && (
                <button className="lz-chip !bg-lz-600 !border-lz-600 !text-white" onClick={() => setYemek('')}>
                  Yemek: {yemek} ✕
                </button>
              )}
              {etiket && !SABIT_ETIKETLER.includes(etiket) && (
                <button className="lz-chip !bg-lz-600 !border-lz-600 !text-white" onClick={() => setEtiket('')}>
                  {etiketAdi(etiket)} ✕
                </button>
              )}
              {yaricap > 0 && (
                // Mesafe tek yontemle buyur (listenin altindaki "Daha fazla goster"); X ile hepsi
                <button
                  className="lz-chip !bg-lz-600 !border-lz-600 !text-white"
                  onClick={() => {
                    setYaricap(0)
                    setYakinMod(false)
                  }}
                >
                  {yaricap} km içinde ✕
                </button>
              )}
            </div>
          )}
          {/* "Yakınımda ne var?" ile acildiysa mesafe cipleri: yalnizca secilen mesafe kadar bakilir */}
          {yakinMod && yaricap > 0 && (
            <div className="grid grid-cols-4 gap-2" data-yakin-cipler>
              {YAKIN_CIPLER.map((k) => (
                <button key={k} className={`lz-chip justify-center !px-1 ${yaricap === k ? 'lz-chip-on' : ''}`} onClick={() => setYaricap(k)}>
                  {k} km
                </button>
              ))}
            </div>
          )}
          {yaricap > 0 &&
            (konum ? (
              <p className={`text-[12px] ${T_SOLUK}`} data-konum-satiri>
                Konum: {konum.ad} · {yaricap} km içinde · yakından uzağa
              </p>
            ) : mz.durum === 'aliniyor' || mz.durum === 'bekliyor' ? (
              <p className={`text-[12px] ${T_SOLUK}`} data-konum-satiri>
                Konum alınıyor…
              </p>
            ) : (
              // Konum yoksa sayi/mesafe uydurulmaz
              <p className={`text-[13.5px] ${T_GOVDE}`} data-konum-satiri>
                Konum kapalı ·{' '}
                <button className="text-lz-600 font-bold min-h-[48px]" onClick={() => void merkezAl(true)}>
                  Konumumu bul
                </button>
              </p>
            ))}
          {!yaricap && (etiket || yemek) && <p className={`text-[12px] ${T_SOLUK}`}>{konum ? 'Yakından uzağa sıralı' : 'Konum alınınca yakından uzağa sıralanır'}</p>}
          {hypeDurum && <p className={`text-[12.5px] px-1 ${T_SOLUK}`}>{hypeDurum}</p>}
        </div>

        {/* MEKAN KARTLARI: Tarifler kartiyla ayni, 2 sutun */}
        {listeHam === undefined && <IskeletKartlar adet={4} izgara />}
        {listeHam !== undefined && liste.length === 0 && (
          <div className={`lz-card p-5 text-center text-sm ${T_GOVDE}`}>Henüz mekan yok. Aşağıdaki “Mekan ekle”den ya da Instagram’da Paylaş → Lezzet Rotası: Mekan ile ekle.</div>
        )}
        {hypeBos && (
          <p className="rounded-xl bg-amber-50 dark:bg-[#33270f] text-amber-900 dark:text-amber-200 text-[12.5px] px-3 py-2">
            Şu an sosyal medyada çok konuşulan mekan yok; tüm mekanlar aşağıda.
          </p>
        )}
        {yaricap > 0 && konum && liste.length > 0 && sirali.length === 0 && (
          <div className={`lz-card p-5 text-center text-sm ${T_GOVDE}`}>
            {yaricap} km içinde kayıtlı mekan yok. {yakinMod ? 'Üstteki mesafe çiplerinden daha genişini seç.' : 'Aşağıdaki “Daha fazla göster” ile büyüt.'}
          </div>
        )}
        {!sadeceHype && !yaricap && liste.length > 0 && sirali.length === 0 && (
          <div className={`lz-card p-5 text-center text-sm ${T_GOVDE}`}>
            {sadeceYeni && !q && !etiket && !yemek && !sadeceFavori && !sadeceIstek && !sadeceGidilmedi ? 'Son 7 günde yeni mekan yok' : 'Bu seçime uyan mekan yok.'}
          </div>
        )}
        {gosterilen.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {gosterilen.map((m) => (
              <MekanKarti key={m.id} m={m} km={mesafe(m)} cerceve={!yaricap} />
            ))}
          </div>
        )}
        {yaricap > 0 && !yakinMod && <DahaFazlaGoster simdiKm={yaricap} buyut={(km) => setYaricap(km)} />}

        {/* KISAYOLLAR: 2 sutun kucuk kartlar */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <KisaKart to="/oner" ikon={<Icon name="sparkle" className="w-[17px] h-[17px]" />} baslik="Bana mekan öner" alt="Yakında, isteğine göre" vurgu />
          <KisaKart to="/cevre-hype" ikon={<Icon name="star" className="w-[17px] h-[17px]" />} baslik="Çevremdeki Hype" alt="Yakında çok konuşulanlar" />
          <KisaKart to="/sakarya-bu-hafta" ikon={<Icon name="calendar" className="w-[17px] h-[17px]" />} baslik={buHaftaBaslik(etkinlikSehri())} alt="Sinema, tiyatro, konser, festival" />
          <KisaKart to="/gezimi-planla" ikon={<Icon name="sparkle" className="w-[17px] h-[17px]" />} baslik="Gezimi Planla" alt="Anlat, gün gün plan çıksın" />
          <KisaKart to="/gezi" ikon={<Icon name="pin" className="w-[17px] h-[17px]" />} baslik="Yemek gezisi" alt="Rota kur, yola çık" />
          <KisaKart to="/harita" ikon={<Icon name="pin" className="w-[17px] h-[17px]" />} baslik="Harita" alt="Mekanlarım haritada" />
          <KisaKart to="/takip" ikon={<Icon name="users" className="w-[17px] h-[17px]" />} baslik="Influencer’lar" alt="Gittikleri yerler" />
          <KisaKart
            onClick={() => {
              digerleriniKapat('istek')
              setSadeceIstek(true)
              listeyeGit()
            }}
            ikon={<Icon name="bookmark" className="w-[17px] h-[17px]" />}
            baslik="Gitmek istediğim"
            alt={istekSayisi ? `${istekSayisi} yer` : 'İşaretle, burada topla'}
          />
          <KisaKart to="/sinirsiz" ikon={<span className="text-[17px] font-bold leading-none">∞</span>} baslik="Sınırsız" alt={sinirsizSayisi ? `${sinirsizSayisi} mekanda teklif` : 'Pizza, köfte, açık büfe'} />
          <KisaKart to="/gittiklerim" ikon={<Icon name="check" className="w-[17px] h-[17px]" />} baslik="Gittiğim yerler" alt={gidilenSayisi ? `${gidilenSayisi} mekan` : 'Puanına göre sıralı'} />
          <KisaKart to="/harcamalarim" ikon={<span className="text-[14px] font-bold leading-none">TL</span>} baslik="Harcamalarım" alt={harcama} />
          <KisaKart
            onClick={() => {
              setKampanyaAcik(!kampanyaAcik)
              setTimeout(() => document.getElementById('kampanya-karti')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100)
            }}
            ikon={<Icon name="sparkle" className="w-[17px] h-[17px]" />}
            baslik={`Kampanyalar${kampanyaSayisi ? ` · ${kampanyaSayisi}` : ''}`}
            alt={kampanyaSayisi ? 'Yakından uzağa gör' : 'Yakındakileri kontrol et'}
            acik={kampanyaAcik}
          />
        </div>
        {kampanyaAcik && (
          <div id="kampanya-karti">
            <KampanyaKarti liste={liste} konum={konum} acikBasla />
          </div>
        )}
        <Buradayim />

        {/* KONUM: arama kutusu ustte tam genislik, dugmeler alt alta */}
        <div className="lz-card p-4 space-y-2.5">
          <div className={`font-semibold ${T_BASLIK}`}>{konum ? `Konum: ${konum.ad ?? 'Bulunduğun yer'}` : 'Neredesin?'}</div>
          {konum && (
            <p className={`text-[13px] ${T_GOVDE}`}>
              {yakinlar.length ? `${YAKIN_KM} km içinde kayıtlı ${yakinlar.length} mekan var` : `${YAKIN_KM} km içinde kayıtlı mekan yok.`}
            </p>
          )}
          <input
            className="lz-input text-[14px] w-full min-h-[48px]"
            placeholder="Semt yaz, örn. Serdivan"
            value={semt}
            onChange={(e) => setSemt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && semt.trim() && void semtBul()}
          />
          <button className="lz-btn-soft w-full text-[14.5px]" onClick={() => void (semt.trim() ? semtBul() : konumuAl())}>
            {semt.trim() ? 'Bu semti bul' : 'Konumumu bul'}
          </button>
          {konumMesaj && <p className={`text-[12.5px] ${T_SOLUK}`}>{konumMesaj}</p>}
          <button
            className="lz-btn-primary w-full text-[14.5px]"
            onClick={async () => {
              if (!konum) await konumuAl()
              setYaricap(yaricap || MESAFE_KM[0])
              listeyeGit()
            }}
          >
            Yakınımdaki mekanları göster
          </button>
        </div>

        {/* MEKAN EKLE: kisa yazi, aciklama acilir satirda, kutu ve dugme alt alta */}
        <div className="lz-card p-4 space-y-2.5">
          <div className={`font-semibold ${T_BASLIK}`}>Mekan ekle</div>
          <p className={`text-[13px] ${T_GOVDE}`}>Link yapıştır ya da ad + semt yaz.</p>
          <details className={`text-[12.5px] ${T_SOLUK}`}>
            <summary className="cursor-pointer font-semibold text-lz-600 min-h-[48px] flex items-center">Nasıl çalışır?</summary>
            <p className="pt-1">
              Instagram, TikTok, YouTube ya da Google Haritalar linkini yapıştır; ya da sadece adını ve semtini yaz (“Karaköy Lokantası, İstanbul”). Konum yazmasa
              da yapay zeka Google’da araştırıp yerini kendisi bulur. En kolayı: Instagram’da Paylaş → Lezzet Rotası: Mekan; hiçbir şey yazmana gerek yok.
            </p>
          </details>
          <textarea
            className="lz-input min-h-[64px] text-[14px] w-full"
            placeholder="Link ya da mekan adı + semt"
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />
          <button className="lz-btn-primary w-full" disabled={!aiVar || !link.trim() || !!ekleniyor} onClick={() => void ekle()}>
            {ekleniyor || 'Mekan ekle'}
          </button>
          {!aiVar && (
            <p className="text-[12.5px] text-rose-600 dark:text-rose-300">
              Bunun için{' '}
              <Link to="/ayarlar" className="underline font-semibold">
                Ayarlar
              </Link>
              ’dan Gemini veya Claude anahtarı gerekli.
            </p>
          )}
          {hata && <div className="rounded-2xl bg-rose-50 dark:bg-[#2a1a1d] text-rose-700 dark:text-rose-300 text-sm p-3">{hata}</div>}
        </div>
      </div>
    </div>
  )
}

// "Yakınımda ne var?" mesafe cipleri (km)
const YAKIN_CIPLER = [1, 3, 10, 30]

// Yeni mekan: son 7 gunde eklenen (7 gun dolunca kendiliginden cikar; kontrol dugmesi gerekmez)
const YENI_MEKAN_GUN = 7
function yeniMekan(m: Pick<LzMekan, 'createdAt'>, simdi = Date.now()): boolean {
  return !!m.createdAt && m.createdAt >= simdi - YENI_MEKAN_GUN * 86400000
}

// En ustteki sabit etiketler (hepsi "Tumu" ekraninda)
const SABIT_ETIKETLER = ['Popüler', 'Tatlı', 'Sokak lezzeti', 'Pastane', 'Kahve', 'Kahvaltı']

// Kisayol karti: baslik + 1 satir aciklama, ok her kartta ayni yerde (sag, ortada)
function KisaKart({ to, onClick, ikon, baslik, alt, vurgu = false, acik }: { to?: string; onClick?: () => void; ikon: ReactNode; baslik: string; alt: string; vurgu?: boolean; acik?: boolean }) {
  // Ust satirda simge ve ok (ok her kartta ayni yerde), altta tam genislikte baslik (2 satir) ve tek satir aciklama
  const ic = (
    <>
      <span className="flex items-center justify-between">
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${vurgu ? 'bg-[#221C15] text-white dark:bg-[#F4EFE6] dark:text-[#221C15]' : 'bg-lz-50 dark:bg-[#3a1d16] text-lz-600 dark:text-lz-300'}`}>{ikon}</span>
        <Icon name="back" className={`w-4 h-4 flex-shrink-0 ${acik === undefined ? 'rotate-180' : acik ? 'rotate-90' : '-rotate-90'} ${T_SOLUK}`} />
      </span>
      <span className="block min-w-0">
        <span className={`block font-semibold text-[13.5px] leading-tight line-clamp-2 [overflow-wrap:normal] [word-break:normal] ${T_BASLIK}`}>{baslik}</span>
        <span className={`block text-[11.5px] leading-tight truncate mt-0.5 ${T_SOLUK}`}>{alt}</span>
      </span>
    </>
  )
  const cls = 'lz-card p-2.5 flex flex-col gap-1.5 min-h-[88px] min-w-0 w-full text-left active:scale-[0.98] transition'
  return to ? (
    <Link to={to} className={cls}>
      {ic}
    </Link>
  ) : (
    <button className={cls} onClick={onClick}>
      {ic}
    </button>
  )
}

// Mekan karti: Tarifler kartiyla ayni duzen (fotograf ustte, sag ustte 32 px yildiz, ad 2 satir)
// cerceve: ince kirmizi cerceve yalnizca normal listede 3 km icindekilerde (Yakininda acikken hepsi zaten 1 km icinde)
function MekanKarti({ m, km, cerceve = true }: { m: LzMekan; km?: number; cerceve?: boolean }) {
  const fiyat = fiyatSeviyesi(m)
  const alt = [km !== undefined ? mesafeYaz(km) : '', fiyat ? `${fiyat} fiyat` : ''].filter(Boolean).join(' · ')
  const yakin = cerceve && km !== undefined && km <= YAKIN_KM
  return (
    <div className={`lz-card lz-gezi overflow-hidden flex flex-col min-w-0 ${yakin ? 'ring-1 ring-red-500 dark:ring-red-400' : ''}`}>
      <div className="relative">
        <Link to={`/mekan/${m.id}`} aria-label={m.ad} className="block">
          <Thumb src={m.foto} className="w-full rounded-none aspect-[4/3]" emoji="" />
        </Link>
        <button
          className={`absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 dark:bg-black/55 backdrop-blur flex items-center justify-center shadow-sm ${m.favori ? 'text-amber-400' : 'text-[#6A5F51] dark:text-[#DDD5C8]'}`}
          aria-label={m.favori ? 'Favorilerden çıkar' : 'Favorilere ekle'}
          onClick={() => void lzDb.mekanlar.update(m.id!, { favori: !m.favori })}
        >
          <svg viewBox="0 0 24 24" className="w-[16px] h-[16px]" fill={m.favori ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
            <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9L3.5 9.7l5.9-.8z" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          className={`absolute top-2 left-2 w-8 h-8 rounded-full bg-white/90 dark:bg-black/55 backdrop-blur flex items-center justify-center shadow-sm ${m.gitmekIstiyorum ? 'text-lz-600' : 'text-[#6A5F51] dark:text-[#DDD5C8]'}`}
          aria-label={m.gitmekIstiyorum ? 'Gitmek istediklerimden çıkar' : 'Gitmek istiyorum'}
          onClick={() => void lzDb.mekanlar.update(m.id!, { gitmekIstiyorum: !m.gitmekIstiyorum })}
        >
          <Icon name="bookmark" className={`w-[15px] h-[15px] ${m.gitmekIstiyorum ? 'fill-current' : ''}`} />
        </button>
        {yeniMekan(m) && (
          // Sol ust: "gitmek istiyorum" isareti kosede (8 px + 32 px), rozet onun 4 px sagindan baslar; yildiz sag ustte
          <span className="absolute top-[14px] left-[44px] text-[11px] font-extrabold tracking-[0.04em] px-2 py-1 rounded-md bg-lz-600 text-white shadow-sm" data-mekan-yeni-rozet>
            YENİ
          </span>
        )}
        <div className="absolute bottom-2 left-2 flex gap-1">
          {m.gidildi && (
            <span className="lz-muhur" data-muhur>
              Gittim
            </span>
          )}
          {m.hype?.var && <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-lz-600 text-white">Hype</span>}
          {m.reklam && <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-black/60 text-white">Reklam</span>}
        </div>
      </div>
      <Link to={`/mekan/${m.id}`} className="p-2.5 flex flex-col gap-1 flex-1 min-w-0">
        <div className={`lz-baslik font-semibold text-[15px] leading-[1.3] line-clamp-2 min-h-[2.6em] ${T_BASLIK}`}>{m.ad}</div>
        <div className={`text-[12px] truncate ${T_SOLUK}`}>
          {m.puan ? <b className="text-amber-700 dark:text-amber-300 font-semibold">{puanYaz(m)}</b> : null}
          {m.puan && (m.tur || m.ilce) ? ' · ' : ''}
          {[m.tur, m.ilce].filter(Boolean).join(' · ')}
        </div>
        <div className={`text-[12px] font-semibold min-h-[1.4em] truncate ${km !== undefined ? 'text-lz-600' : T_SOLUK}`}>{alt || (m.lat === undefined ? 'Yeri belirsiz' : '')}</div>
      </Link>
    </div>
  )
}

// Durum seridi: gercek konuma (GPS > yazilan semt > son GPS) gore 1 km icindeki kayitli mekan sayisi.
// Konum yoksa sayi uydurulmaz: durum 'kapali'.
export const YAKIN_SERIT_KM = MESAFE_KM[0]
export function useYakinMekanSayisi(): { durum: Merkez['durum']; sayi: number } {
  const hepsi = useLiveQuery(() => lzDb.mekanlar.toArray(), [], [] as LzMekan[]) ?? []
  const mz = useMerkez()
  useEffect(() => {
    void merkezAl()
    // Uygulamaya donulunce konum tazelenir (100 m kurali gecerli)
    const bak = () => document.visibilityState === 'visible' && void merkezAl()
    document.addEventListener('visibilitychange', bak)
    return () => document.removeEventListener('visibilitychange', bak)
  }, [])
  return { durum: mz.durum, sayi: yaricapIcinde(hepsi, mz.konum, YAKIN_SERIT_KM).length }
}

export function YakinMekanSeridi() {
  const { sayi: yakin } = useYakinMekanSayisi()
  if (!yakin) return null
  return (
    <Link to="/mekanlar" className="lz-card p-3 flex items-center gap-3 ring-2 ring-lz-500/50">
      <Icon name="pin" className="w-5 h-5 text-lz-600" />
      <span className={`flex-1 text-[13.5px] font-medium ${T_BASLIK}`}>Yakınında kayıtlı {yakin} mekan var</span>
      <span className="text-lz-600 text-[13px] font-semibold">Göster</span>
    </Link>
  )
}

// Kampanyalar: dugmeye basinca favori (yoksa tum) mekanlarin guncel kampanyalarina bakilir
function KampanyaKarti({ liste, konum, acikBasla = false }: { liste: LzMekan[]; konum: Konum | null; acikBasla?: boolean }) {
  const [sonuc, setSonuc] = useState('')
  const d = useKampanyaDurumu()
  // Kampanyalar bulundugum yerden uzaga dogru (konumu olmayanlar en sonda)
  const uzaklik = (m: LzMekan) => (konum && m.lat !== undefined && m.lon !== undefined ? mesafeKm(konum, { lat: m.lat, lon: m.lon }) : undefined)
  const kampanyali = liste
    .filter((m) => m.kampanya && Date.now() - m.kampanya.zaman < 7 * 24 * 3600 * 1000)
    .sort((a, b) => (uzaklik(a) ?? 1e9) - (uzaklik(b) ?? 1e9))
  const favSayisi = liste.filter((m) => m.favori).length
  // Varsayilan kapali (cok yer kapliyordu); basinca acilir
  const [acik, setAcik] = useState(acikBasla)
  if (!liste.length) return null
  const son = sonKontrol()
  if (!acik && !d.calisiyor)
    return (
      <button className="lz-card p-3.5 flex items-center gap-3 w-full text-left" onClick={() => setAcik(true)}>
        <span className="w-9 h-9 rounded-xl bg-violet-50 dark:bg-[#1f1a2e] text-violet-600 flex items-center justify-center">
          <Icon name="sparkle" className="w-[18px] h-[18px]" />
        </span>
        <span className="flex-1 min-w-0">
          <span className={`block font-semibold ${T_BASLIK}`}>Kampanyalar{kampanyali.length ? ` · ${kampanyali.length}` : ''}</span>
          <span className={`block text-[12.5px] ${T_SOLUK}`}>{kampanyali.length ? 'Yakından uzağa; dokun, gör' : 'Yakınındaki mekanların kampanyalarını kontrol et'}</span>
        </span>
        <Icon name="back" className={`w-5 h-5 -rotate-90 ${T_SOLUK}`} />
      </button>
    )
  return (
    <div className="lz-card p-4 space-y-2.5">
      <button className={`w-full flex items-center text-left font-semibold ${T_BASLIK}`} onClick={() => setAcik(false)}>
        <span className="flex-1">Kampanyalar{kampanyali.length ? ` · ${kampanyali.length}` : ''}</span>
        <Icon name="back" className={`w-5 h-5 rotate-90 ${T_SOLUK}`} />
      </button>
      <button
        className="lz-btn-primary w-full text-[15px]"
        disabled={d.calisiyor}
        onClick={async () => {
          setSonuc('')
          void bildirimIzniIste()
          try {
            const r = await kampanyaKontrolEt(konum ?? undefined)
            setSonuc(r.bulunan.length ? `${r.bulunan.length} mekanda kampanya bulundu.` : `${r.bakilan} mekana bakıldı, şu an kampanya bulunamadı.`)
          } catch (e) {
            setSonuc((e as Error).message)
          }
        }}
      >
        {d.calisiyor ? d.mesaj : 'Kampanyaları kontrol et'}
      </button>
      <p className={`text-[12px] ${T_SOLUK}`}>
        {konum ? 'Sana en yakın 15 mekanın' : favSayisi ? `${Math.min(favSayisi, 15)} favori mekanının` : 'Mekanlarının'} önümüzdeki 7 gündeki (hafta sonu dahil) kampanya, indirim ve etkinliklerine
        yapay zeka Google’da bakar; bulunanlar aşağıda listelenir, günde en fazla 2 kampanya bildirimi gelir.{son ? ` Son kontrol: ${new Date(son).toLocaleDateString('tr')}.` : ''}
      </p>
      {sonuc && <p className={`text-[13px] font-medium ${T_GOVDE}`}>{sonuc}</p>}
      {kampanyali.map((m) => (
        <Link key={m.id} to={`/mekan/${m.id}`} className="block rounded-2xl bg-emerald-50 dark:bg-[#10261e] text-emerald-900 dark:text-emerald-200 text-[13.5px] p-3">
          {uzaklik(m) !== undefined && <span className="float-right ml-2 text-[12px] font-semibold">{mesafeYaz(uzaklik(m)!)}</span>}
          <b>{m.ad}</b>: {m.kampanya!.ozet}
          {m.kampanya!.gecerlilik ? ` (${m.kampanya!.gecerlilik})` : ''}
        </Link>
      ))}
    </div>
  )
}

// Begeni skoru: cok yorumlu yuksek Google puani one; su an hype olan ve benim yuksek puan verdigim biraz daha one; reklam biraz geri
function mekanSkoru(m: LzMekan): number {
  const z = (m.ziyaretler ?? []).filter((x) => x.puan > 0)
  const benim = z.length ? z.reduce((t, x) => t + x.puan, 0) / z.length : 0
  let s = guvenSkoru({ puan: m.puan ?? 0, yorumSayisi: m.yorumSayisi ?? 0, reklam: m.reklam })
  if (m.hype?.var) s *= 1.15
  if (benim) s += benim * 0.5
  return s
}

// Yemek bu mekanda geciyor mu: onerilenler, benim yediklerim, paylasanlarin denedikleri
function yemekGeciyor(m: LzMekan, yemek: string): boolean {
  const y = yemek.toLocaleLowerCase('tr').trim()
  const metin = [
    ...m.oneriler,
    ...(m.ziyaretler ?? []).map((z) => z.yedim),
    m.paylasanYorumu?.yedi ?? '',
    ...(m.paylasimlar ?? []).map((p) => p.yorum?.yedi ?? '')
  ]
    .join(' | ')
    .toLocaleLowerCase('tr')
  // Tam ad ya da ilk kelimesi ("Kuşbaşılı pide" -> "kuşbaşılı pide" / "pide")
  return metin.includes(y) || y.split(/\s+/).filter((k) => k.length >= 4).some((k) => metin.includes(k))
}

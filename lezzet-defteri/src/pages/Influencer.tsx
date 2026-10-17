import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { lzDb } from '../db'
import type { LzMekan } from '../types'
import { Header, Icon, KisiAvatar, T_BASLIK, T_GOVDE, T_SOLUK, Toast, useToast } from '../components/ui'
import { aiMekanOner, apiAnahtari, type MekanOnerisi } from '../lib/ai'
import { adrestenKonum, konumdanAdres, mesafeKm, telefonKonumu, type Konum } from '../lib/mekan'
import { hesapBirak, hesapFoto, hesapFotoGetir, hesapFotoKaydet, hesapNormal } from '../lib/hesaplar'
import { fotoOku } from '../lib/image'
import { ReklamRozeti, BEGENI_KURALI, YeniListe, adNormal, guvenSkoru, hesapParca, onunMekanlari } from './Takip'

// Fenomenin profili: sosyal medya hesabi; youtube kanalinda arama, @ad ise Instagram profili
function profilLinki(h: string): string {
  const { ad, platform } = hesapParca(h)
  if (ad.startsWith('@')) return `https://www.instagram.com/${ad.slice(1)}/`
  if (/youtube/i.test(platform)) return `https://www.youtube.com/results?search_query=${encodeURIComponent(ad)}&sp=EgIQAg%253D%253D`
  return `https://www.google.com/search?q=${encodeURIComponent(`${ad} ${platform}`.trim())}`
}

// INFLUENCER SAYFASI: kayitli mekanlari (gittin/gitmedin, ne dedi), son gittigi yeni yerler
export default function Influencer() {
  const h = decodeURIComponent(useParams().h ?? '')
  const navigate = useNavigate()
  const mekanlar = useLiveQuery(() => lzDb.mekanlar.toArray(), [], [] as LzMekan[]) ?? []
  const [yeniler, setYeniler] = useState<MekanOnerisi[] | null>(null)
  const [durum, setDurum] = useState('')
  const [hata, setHata] = useState('')
  const [toast, goster] = useToast()
  const { ad, platform } = hesapParca(h)
  // Profil fotografi: kayitli degilse Instagram'dan bir kez getirilir
  const [foto, setFoto] = useState(hesapFoto(h))
  useEffect(() => {
    if (!foto) void hesapFotoGetir(h).then((f) => f && setFoto(f))
  }, [h])
  const onun = onunMekanlari(mekanlar, h)
  const gidilen = onun.filter((m) => m.gidildi).length

  // AYRINTILI ARAMA: zaman, yer, tur ve "en cok ovdukleri" secilerek tek istekte; 24 saat onbellek
  const [zaman, setZaman] = useState<'son' | 'tum'>('tum')
  const [yerSecim, setYerSecim] = useState<'her' | 'yakin' | 'sehir'>('her')
  const [sehir, setSehir] = useState('')
  const [km, setKm] = useState(10)
  const [tur, setTur] = useState('Hepsi')
  const [sira, setSira] = useState<'begeni' | 'ovdu' | 'yeni'>('begeni')
  const [baslik, setBaslik] = useState('')

  const ara = async (hizli?: 'yeni') => {
    setHata('')
    setYeniler(null)
    const z = hizli === 'yeni' ? 'son' : zaman
    try {
      let yer = 'Türkiye'
      let mesafe = 0
      let k: Konum | undefined
      if (!hizli && yerSecim === 'yakin') {
        setDurum('Konumun alınıyor…')
        k = await telefonKonumu(10000).catch(() => {
          throw new Error('Konum alınamadı; konumu aç ya da “Şehir” seç.')
        })
        yer = (await konumdanAdres(k)) || `${k.lat.toFixed(3)}, ${k.lon.toFixed(3)}`
        mesafe = km
      } else if (!hizli && yerSecim === 'sehir' && sehir.trim()) {
        // Yazilan semt haritada bulunursa o noktanin cevresi (secilen km) aranir
        yer = sehir.trim()
        setDurum('Semt bulunuyor…')
        k = await adrestenKonum(yer).catch(() => undefined)
        if (k) mesafe = km
      }
      const t = hizli ? 'Hepsi' : tur
      const istek = [
        z === 'son' ? 'Bu hesabın SON 60 GÜNDE paylaştığı/gittiği mekanlar, en yeniden eskiye.' : 'Bu hesabın bugüne kadar paylaştığı/tanıttığı mekanlar.',
        t !== 'Hepsi' && `Yalnızca ${t} mekanları.`,
        !hizli && sira === 'ovdu' && 'YALNIZCA en çok övdüğü, "kesinlikle gidin" dediği ya da yüksek puan verdiği yerler; en beğendiğinden başla.',
        !hizli && sira === 'begeni' && BEGENI_KURALI,
        !hizli && yerSecim === 'sehir' && sehir.trim() && `Yalnızca ${sehir.trim()} ve yakın çevresindekiler.`,
        'populerlik alanına paylaşım tarihini ve mekan hakkında ne dediğini yaz.',
        hizli || yerSecim === 'her' ? 'Bulunduğum yere yakınlık şart değil.' : ''
      ]
        .filter(Boolean)
        .join(' ')
      const anahtar = `lz-inf|${h}|${istek}|${mesafe}|${k ? `${k.lat.toFixed(2)},${k.lon.toFixed(2)}` : yer}`
      let l: MekanOnerisi[] | undefined
      try {
        const o = JSON.parse(localStorage.getItem(anahtar) || 'null') as { t: number; l: MekanOnerisi[] } | null
        if (o && Date.now() - o.t < 24 * 3600 * 1000) l = o.l
      } catch {
        /* yok */
      }
      if (!l) {
        setDurum(`${ad} paylaşımları araştırılıyor…`)
        l = await aiMekanOner(istek, yer, mekanlar.map((m) => m.ad), h, '', undefined, mesafe)
        try {
          localStorage.setItem(anahtar, JSON.stringify({ t: Date.now(), l }))
        } catch {
          /* yok */
        }
      }
      // Yakindaysa mesafe hesaplanip disindakiler atilir
      const sonuc = k
        ? l.filter((o) => !(o.enlem || o.boylam) || mesafeKm(k!, { lat: o.enlem, lon: o.boylam }) <= mesafe + 0.5)
        : l
      const liste = hizli
        ? sonuc.filter((o) => !mekanlar.some((m) => adNormal(m.ad) === adNormal(o.ad)))
        : sira === 'begeni'
          ? sonuc.filter((o) => !o.puan || o.puan >= 4.3).sort((a, b) => guvenSkoru(b) - guvenSkoru(a))
          : sonuc
      setYeniler(liste)
      setBaslik(
        hizli
          ? 'Son gittiği yeni yerler'
          : [z === 'son' ? 'Son 2 ay' : 'Tüm zamanlar', t !== 'Hepsi' && t, sira === 'ovdu' && 'en çok övdükleri', sira === 'begeni' && 'en beğenilenler, Google onaylı', yerSecim === 'yakin' ? `${mesafe} km içinde` : yerSecim === 'sehir' && `${sehir.trim()}${mesafe ? ` · ${mesafe} km` : ''}`]
              .filter(Boolean)
              .join(' · ')
      )
      if (!liste.length) goster(hizli && l.length ? 'Gittiği yerlerin hepsi zaten kayıtlı' : 'Bu seçime uyan mekan bulunamadı')
    } catch (e) {
      setHata((e as Error).message)
    }
    setDurum('')
  }
  const Secim = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) => (
    <button className={`lz-chip text-[12.5px] ${on ? 'lz-chip-on' : ''}`} onClick={onClick}>
      {children}
    </button>
  )

  return (
    <div>
      <Header title={ad} subtitle={platform || 'Influencer'} back />
      <div className="px-4 space-y-3 pb-8">
        <div className="lz-card p-4 flex items-center gap-4">
          {/* Fotografa dokun: galeriden sec (otomatik bulunamadiysa ya da degistirmek icin) */}
          <label className="relative flex-shrink-0 cursor-pointer" aria-label="Profil fotoğrafını değiştir">
            <KisiAvatar ad={hesapNormal(h)} foto={foto} className="w-16 h-16 text-[22px]" />
            <span className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-white dark:bg-[#26262a] border border-[#e4e3e0] dark:border-[#3a3a40] flex items-center justify-center text-[#52525b] dark:text-[#d4d4d8]">
              <Icon name="edit" className="w-3.5 h-3.5" />
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (!f) return
                const d = await fotoOku(f, 400).catch(() => '')
                if (!d) return goster('Fotoğraf açılamadı')
                hesapFotoKaydet(h, d)
                setFoto(d)
                goster('Profil fotoğrafı kaydedildi')
              }}
            />
          </label>
          <div className="flex-1 grid grid-cols-3 text-center">
            {(
              [
                [onun.length, 'mekan'],
                [gidilen, 'gittin'],
                [onun.length - gidilen, 'gitmedin']
              ] as const
            ).map(([n, e]) => (
              <div key={e}>
                <div className={`text-[20px] font-bold ${T_BASLIK}`}>{n}</div>
                <div className={`text-[12px] ${T_SOLUK}`}>{e}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <a href={profilLinki(h)} target="_blank" rel="noreferrer" className="lz-btn-soft text-[14px]">
            Profilini aç
          </a>
          <button className="lz-btn-primary text-[14px]" disabled={!apiAnahtari() || !!durum} onClick={() => void ara('yeni')}>
            Yeni gittiği yerler
          </button>
        </div>

        <div className="lz-card p-4 space-y-3">
          <div className={`font-semibold ${T_BASLIK}`}>Gittiği yerlerde ara</div>
          <div className="space-y-1.5">
            <div className="lz-label">Ne zaman</div>
            <div className="flex flex-wrap gap-1.5">
              <Secim on={zaman === 'tum'} onClick={() => setZaman('tum')}>Tüm zamanlar</Secim>
              <Secim on={zaman === 'son'} onClick={() => setZaman('son')}>Son 2 ay</Secim>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="lz-label">Nerede</div>
            <div className="flex flex-wrap gap-1.5">
              <Secim on={yerSecim === 'her'} onClick={() => setYerSecim('her')}>Her yer</Secim>
              <Secim on={yerSecim === 'yakin'} onClick={() => setYerSecim('yakin')}>Yakınımda</Secim>
              <Secim on={yerSecim === 'sehir'} onClick={() => setYerSecim('sehir')}>Şehir / semt</Secim>
            </div>
            {yerSecim !== 'her' && (
              <div className="flex gap-1.5">
                {[3, 5, 10, 25].map((x) => (
                  <button key={x} className={`lz-chip justify-center flex-1 text-[12.5px] ${km === x ? 'lz-chip-on' : ''}`} onClick={() => setKm(x)}>
                    {x} km
                  </button>
                ))}
              </div>
            )}
            {yerSecim === 'sehir' && <input className="lz-input py-2 text-[14px]" placeholder="Semt ya da şehir yaz: Moda Kadıköy, Nilüfer Bursa" value={sehir} onChange={(e) => setSehir(e.target.value)} />}
          </div>
          <div className="space-y-1.5">
            <div className="lz-label">Ne yemek</div>
            <div className="flex flex-wrap gap-1.5">
              {['Hepsi', 'Kahvaltı', 'Kebap / et', 'Balık', 'Tatlı / pastane', 'Sokak lezzeti', 'Esnaf lokantası', 'Fine dining', 'Kahve'].map((x) => (
                <Secim key={x} on={tur === x} onClick={() => setTur(x)}>
                  {x}
                </Secim>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="lz-label">Nasıl sıralansın</div>
            <div className="flex flex-wrap gap-1.5">
              <Secim on={sira === 'begeni'} onClick={() => setSira('begeni')}>En beğenilen + Google onaylı</Secim>
              <Secim on={sira === 'ovdu'} onClick={() => setSira('ovdu')}>En çok övdüğü</Secim>
              <Secim on={sira === 'yeni'} onClick={() => setSira('yeni')}>En yeni</Secim>
            </div>
            {sira === 'begeni' && (
              <p className={`text-[12px] ${T_SOLUK}`}>Paylaşımı en çok beğeni ve olumlu yorum alan yerler; Google puanı 4,3 altında olanlar elenir, çok yorumlu ve yüksek puanlı olan üstte.</p>
            )}
          </div>
          <button
            className="lz-btn-primary w-full"
            disabled={!apiAnahtari() || !!durum || (yerSecim === 'sehir' && !sehir.trim())}
            onClick={() => void ara()}
          >
            Ara
          </button>
        </div>
        {durum && (
          <div className="lz-card p-3.5 flex items-center gap-3">
            <span className="w-5 h-5 rounded-full border-[2.5px] border-lz-600 border-t-transparent animate-spin flex-shrink-0" />
            <span className={`text-[14px] font-medium ${T_GOVDE}`}>{durum}</span>
          </div>
        )}
        {hata && <div className="rounded-2xl bg-rose-50 dark:bg-[#2a1a1d] text-rose-700 dark:text-rose-300 text-sm p-3">{hata}</div>}
        {yeniler && yeniler.length > 0 && (
          <div className="lz-card p-4 space-y-2">
            <div className={`font-semibold ${T_BASLIK}`}>{baslik}</div>
            <YeniListe liste={yeniler} mekanlar={mekanlar} goster={goster} />
          </div>
        )}

        <div className="lz-card p-4 space-y-1">
          <div className={`font-semibold mb-1 ${T_BASLIK}`}>Gittiği yerler</div>
          {!onun.length && <p className={`text-[13px] ${T_SOLUK}`}>Bu kişinin videosundan kaydedilmiş mekan yok.</p>}
          {onun.map((m) => (
            <Link key={m.id} to={`/mekan/${m.id}`} className="flex items-start gap-2.5 py-2 border-b last:border-0 border-[#efefed] dark:border-[#26262a]">
              <span className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${m.gidildi ? 'bg-emerald-500' : 'bg-[#d4d4d8]'}`} />
              <span className="flex-1 min-w-0">
                <span className={`block font-semibold text-[14.5px] ${T_BASLIK}`}>
                  {m.ad}
                  {m.reklam && <ReklamRozeti />}
                </span>
                <span className={`block text-[12px] ${T_SOLUK}`}>{[m.tur, m.ilce, m.sehir].filter(Boolean).join(' · ')}</span>
                {(m.paylasanYorumu?.karar || m.paylasanYorumu?.begendi) && (
                  <span className={`block text-[12.5px] mt-0.5 ${T_GOVDE}`}>“{m.paylasanYorumu.karar || m.paylasanYorumu.begendi}”</span>
                )}
              </span>
              <span className={`text-[12px] font-semibold mt-0.5 ${m.gidildi ? 'text-emerald-600' : T_SOLUK}`}>{m.gidildi ? 'Gittin' : 'Gitmedin'}</span>
            </Link>
          ))}
        </div>
        <button
          className={`w-full text-[13px] py-2 ${T_SOLUK} underline`}
          onClick={() => {
            if (!confirm(`${ad} takipten çıkarılsın mı?`)) return
            hesapBirak(h)
            navigate('/takip', { replace: true })
          }}
        >
          Takipten çık
        </button>
      </div>
      <Toast text={toast} />
    </div>
  )
}

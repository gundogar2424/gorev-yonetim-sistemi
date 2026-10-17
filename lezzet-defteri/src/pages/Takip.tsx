import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { lzDb } from '../db'
import type { LzMekan } from '../types'
import { Header, KisiAvatar, T_BASLIK, T_GOVDE, T_SOLUK, Toast, useToast } from '../components/ui'
import { aiMekanOner, apiAnahtari, type MekanOnerisi } from '../lib/ai'
import { adayReddet, adaylar, hesapBirak, hesapFoto, hesapFotoGetir, hesapNormal, hesapTakipEt, hesaplariOku, otoKontrol, otoKontrolAyarla, sonYeniKontrol, yeniMekanlariBul } from '../lib/hesaplar'
import { instagramLinki, oneriKaydet } from '../lib/mekan'
import { PLATFORM_AD } from '../lib/importer'

// "En beğenilen + Google onaylı": paylaşımı çok beğeni/olumlu yorum almış VE Google puanı yüksek yerler
export const BEGENI_KURALI =
  'SIRALAMA: Bu hesabın paylaşımları arasından paylaşımı EN ÇOK beğeni ve yorum alan, altındaki yorumlarda olumlu konuşulan mekanları seç; ' +
  'bunları Google Haritalar puanı ve yorum sayısıyla doğrula: Google puanı 4,3 altı ya da yorumları kötü olanları ALMA. puan ve yorumSayisi ' +
  'alanlarına Google değerlerini yaz (bulamazsan 0, UYDURMA). populerlik alanına paylaşımın beğeni/yorum durumunu ve hem takipçi yorumlarının ' +
  'hem Google yorumlarının genel havasını kısa yaz (ör. "Paylaşım 48 bin beğeni; takipçiler ve Google yorumları lezzeti övüyor").'
// Google puani ve yorum sayisina gore guven skoru (cok yorumlu 4,6 > az yorumlu 4,9)
// Reklam/is birligi paylasimi biraz geriye duser
export function guvenSkoru(o: { puan: number; yorumSayisi: number; reklam?: boolean }): number {
  return (o.puan || 0) * Math.log10(10 + (o.yorumSayisi || 0)) * (o.reklam ? 0.85 : 1)
}
export function ReklamRozeti() {
  return (
    <span className="inline-block align-middle ml-1.5 rounded-md bg-amber-100 dark:bg-[#2a2113] text-amber-800 dark:text-amber-300 text-[10.5px] font-bold px-1.5 py-0.5">
      Reklam
    </span>
  )
}

export const adNormal = (x: string) => x.toLocaleLowerCase('tr').replace(/[^\p{L}\p{N}]+/gu, '')
// "Buğra Karaman (YouTube)" -> ad ve platform
export function hesapParca(h: string): { ad: string; platform: string } {
  return { ad: h.replace(/\s*\([^)]*\)$/, ''), platform: h.match(/\(([^)]*)\)$/)?.[1] ?? (h.startsWith('@') ? 'Instagram / TikTok' : '') }
}
export function onunMekanlari(mekanlar: LzMekan[], h: string): LzMekan[] {
  return mekanlar.filter((m) => m.paylasan && hesapNormal(m.paylasan) === hesapNormal(h)).sort((a, b) => b.createdAt - a.createdAt)
}

// Fenomenin son gittigi, henuz kayitli olmayan yerler
export function YeniListe({ liste, mekanlar, goster }: { liste: MekanOnerisi[]; mekanlar: LzMekan[]; goster: (s: string) => void }) {
  return (
    <div className="space-y-2">
      {liste.map((o, i) => {
        const k = mekanlar.find((m) => adNormal(m.ad) === adNormal(o.ad))
        return (
          <div key={i} className="rounded-2xl bg-[#f3f3f1] dark:bg-[#26262a] p-3 space-y-1">
            <div className={`font-semibold text-[14.5px] ${T_BASLIK}`}>
              {!k && <span className="text-[10.5px] font-bold tracking-wide text-lz-600 mr-1.5">YENİ</span>}
              {o.ad}
              {o.reklam && <ReklamRozeti />}
            </div>
            <div className={`text-[12px] ${T_SOLUK}`}>
              {o.puan ? <b className="text-amber-600 dark:text-amber-300">★ {o.puan.toFixed(1).replace('.', ',')}{o.yorumSayisi ? ` (${o.yorumSayisi.toLocaleString('tr')})` : ''} · </b> : null}
              {[o.tur, o.ilce, o.sehir].filter(Boolean).join(' · ')}
            </div>
            {o.populerlik && <p className={`text-[12.5px] ${T_GOVDE}`}>{o.populerlik}</p>}
            <div className="flex gap-2 pt-1">
              {k ? (
                <Link to={`/mekan/${k.id}`} className="lz-btn-soft text-[12.5px] px-3 py-1.5">
                  ✓ Kayıtlı
                </Link>
              ) : (
                <button
                  className="lz-btn-primary text-[12.5px] px-3 py-1.5"
                  onClick={async () => {
                    await oneriKaydet(o, true)
                    goster(`${o.ad} gitmek istediğin yerlere eklendi`)
                  }}
                >
                  ＋ Gitmek istiyorum
                </button>
              )}
              <a href={instagramLinki(o)} target="_blank" rel="noreferrer" className="lz-btn-soft text-[12.5px] px-3 py-1.5">
                Instagram
              </a>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// INFLUENCER'LAR: videosunu paylastigin yemek fenomenleri (kendiliginden takip edilir) — liste
export default function Takip() {
  const mekanlar = useLiveQuery(() => lzDb.mekanlar.toArray(), [], [] as LzMekan[]) ?? []
  const [hesaplar, setHesaplar] = useState(hesaplariOku())
  const [yeniler, setYeniler] = useState<MekanOnerisi[] | null>(null)
  const [durum, setDurum] = useState('')
  const [hata, setHata] = useState('')
  const [oto, setOto] = useState(otoKontrol())
  const [yeni, setYeni] = useState('')
  const [duzenle, setDuzenle] = useState(false)
  const [baslikT, setBaslikT] = useState('Son gittikleri yeni yerler')
  const [toast, goster] = useToast()
  const aiVar = !!apiAnahtari()

  // Videosu kaydedilmis ama takip edilmeyen kisiler "takip edilsin mi?" listesine girer (reddedilenler haric)
  const [adayListe, setAdayListe] = useState(adaylar())
  useEffect(() => {
    for (const m of mekanlar) if (m.paylasan) hesapTakipEt(m.paylasan, PLATFORM_AD[m.platform] ?? '', true)
    setAdayListe(adaylar())
  }, [mekanlar])
  const adayKarar = (h: string, evet: boolean) => {
    if (evet) hesapTakipEt(h)
    else adayReddet(h)
    setAdayListe(adaylar())
    setHesaplar(hesaplariOku())
    goster(evet ? `${h.replace(/\s*\([^)]*\)$/, '')} takip ediliyor` : 'Takip edilmeyecek, bir daha sorulmayacak')
  }

  // Profil fotografi olmayan @hesaplarin fotografi sirayla getirilir (her biri gunde en fazla bir deneme)
  const [, setFotoSayac] = useState(0)
  useEffect(() => {
    let iptal = false
    void (async () => {
      for (const h of hesaplar) {
        if (iptal || hesapFoto(h)) continue
        if (await hesapFotoGetir(h)) setFotoSayac((x) => x + 1)
      }
    })()
    return () => {
      iptal = true
    }
  }, [hesaplar])

  const hepsiBegenilen = async () => {
    setHata('')
    setDurum('Influencer’ların en beğenilen yerleri Google puanlarıyla karşılaştırılıyor…')
    try {
      const l = await aiMekanOner(`Bu hesapların tanıttığı mekanlar. ${BEGENI_KURALI}`, 'Türkiye', mekanlar.map((m) => m.ad), hesaplar.join(', '))
      setYeniler(l.filter((o) => !o.puan || o.puan >= 4.3).sort((a, b) => guvenSkoru(b) - guvenSkoru(a)))
      setBaslikT('En beğenilenler · Google onaylı')
      if (!l.length) goster('Uygun mekan bulunamadı')
    } catch (e) {
      setHata((e as Error).message)
    }
    setDurum('')
  }
  const hepsiYeni = async () => {
    setBaslikT('Son gittikleri yeni yerler')
    setHata('')
    setDurum('Influencer’ların son paylaşımları araştırılıyor…')
    try {
      const l = await yeniMekanlariBul()
      setYeniler(l)
      if (!l.length) goster('Yeni (kaydetmediğin) mekan bulunamadı')
    } catch (e) {
      setHata((e as Error).message)
    }
    setDurum('')
  }

  return (
    <div>
      <Header title="Influencer’lar" subtitle={hesaplar.length ? `${hesaplar.length} yemek fenomeni takip ediliyor` : 'Takip ettiğin yemek fenomenleri'} back />
      <div className="px-4 space-y-3 pb-8">
        <div className="lz-card p-4 space-y-2.5">
          <p className={`text-[12.5px] ${T_SOLUK}`}>
            Bir fenomenin mekan videosunu <b>Paylaş → Lezzet Rotası</b> ile eklediğinde sana “takip edilsin mi?” diye sorulur. Elle de ekleyebilirsin.
          </p>
          <div className="flex gap-2">
            <input className="lz-input py-2 text-[14px] min-w-0" placeholder="@kullaniciadi, profil linki ya da adı" value={yeni} onChange={(e) => setYeni(e.target.value)} />
            <button
              className="lz-btn-soft px-4 text-sm"
              disabled={!yeni.trim()}
              onClick={() => {
                if (hesapTakipEt(yeni)) goster('Takibe alındı')
                setHesaplar(hesaplariOku())
                setYeni('')
              }}
            >
              Ekle
            </button>
          </div>
          {hesaplar.length > 0 && (
            <>
              <button className="lz-btn-primary w-full" disabled={!aiVar || !!durum} onClick={() => void hepsiBegenilen()}>
                En beğenilen yerleri (Google onaylı)
              </button>
              <button className="lz-btn-soft w-full" disabled={!aiVar || !!durum} onClick={() => void hepsiYeni()}>
                Hepsinin son gittiği yeni yerler
              </button>
              <label className={`flex items-start gap-2.5 text-[12.5px] ${T_GOVDE}`}>
                <input
                  type="checkbox"
                  className="w-4 h-4 mt-0.5"
                  checked={oto}
                  onChange={(e) => {
                    otoKontrolAyarla(e.target.checked)
                    setOto(e.target.checked)
                  }}
                />
                <span>
                  Yeni bir yere gidince bildirim gelsin <span className={T_SOLUK}>(uygulamayı açınca 3 günde bir tek aramayla bakar)</span>
                  {sonYeniKontrol().zaman ? <span className={`block ${T_SOLUK}`}>Son bakış: {new Date(sonYeniKontrol().zaman).toLocaleDateString('tr')}</span> : null}
                </span>
              </label>
            </>
          )}
        </div>
        {adayListe.length > 0 && (
          <div className="lz-card p-4 space-y-2.5 ring-2 ring-lz-500/40">
            <div className={`font-semibold ${T_BASLIK}`}>Takip edilsin mi?</div>
            <p className={`text-[12.5px] ${T_SOLUK}`}>Bu kişilerin videosundan mekan kaydettin. Takip edersen yeni gittiği yerler sana önerilir.</p>
            {adayListe.map((h) => {
              const { ad, platform } = hesapParca(h)
              const n = onunMekanlari(mekanlar, h).length
              return (
                <div key={h} className="flex items-center gap-3">
                  <KisiAvatar ad={hesapNormal(h)} foto={hesapFoto(h)} className="w-11 h-11 text-[15px]" />
                  <span className="flex-1 min-w-0">
                    <span className={`block font-semibold text-[14.5px] truncate ${T_BASLIK}`}>{ad}</span>
                    <span className={`block text-[12px] ${T_SOLUK}`}>{[platform, n ? `${n} mekan kaydettin` : ''].filter(Boolean).join(' · ')}</span>
                  </span>
                  <button className="lz-btn-soft text-[12.5px] px-3 py-1.5" onClick={() => adayKarar(h, false)}>
                    Hayır
                  </button>
                  <button className="lz-btn-primary text-[12.5px] px-3 py-1.5" onClick={() => adayKarar(h, true)}>
                    Takip et
                  </button>
                </div>
              )
            })}
          </div>
        )}
        {durum && (
          <div className="lz-card p-3.5 flex items-center gap-3">
            <span className="w-5 h-5 rounded-full border-[2.5px] border-lz-600 border-t-transparent animate-spin flex-shrink-0" />
            <span className={`text-[14px] font-medium ${T_GOVDE}`}>{durum}</span>
          </div>
        )}
        {hata && <div className="rounded-2xl bg-rose-50 dark:bg-[#2a1a1d] text-rose-700 dark:text-rose-300 text-sm p-3">{hata}</div>}
        {yeniler && yeniler.length > 0 && (
          <div className="lz-card p-4 space-y-2">
            <div className={`font-semibold ${T_BASLIK}`}>{baslikT}</div>
            <YeniListe liste={yeniler} mekanlar={mekanlar} goster={goster} />
          </div>
        )}

        {/* Fotografli izgara: profil resimlerinden gorup sec */}
        {hesaplar.length > 0 && (
          <div className="flex items-center px-1">
            <span className={`flex-1 text-[13px] font-semibold ${T_SOLUK}`}>{duzenle ? 'Kaldırmak istediklerine ✕ ile dokun' : `${hesaplar.length} influencer`}</span>
            <button className={`lz-chip text-[12.5px] ${duzenle ? 'lz-chip-on' : ''}`} onClick={() => setDuzenle(!duzenle)}>
              {duzenle ? 'Bitti' : 'Düzenle'}
            </button>
          </div>
        )}
        {hesaplar.length > 0 && (
          <div className="grid grid-cols-3 gap-2.5">
            {hesaplar.map((h) => {
              const { ad, platform } = hesapParca(h)
              const onun = onunMekanlari(mekanlar, h)
              const gidilen = onun.filter((m) => m.gidildi).length
              return (
                <Link
                  key={h}
                  to={`/influencer/${encodeURIComponent(h)}`}
                  onClick={(e) => duzenle && e.preventDefault()}
                  className={`lz-card relative p-2 flex flex-col items-center text-center gap-1.5 active:scale-[0.97] transition ${duzenle ? 'animate-[pulse_2s_ease-in-out_infinite]' : ''}`}
                >
                  {duzenle && (
                    <button
                      className="absolute -top-1.5 -right-1.5 z-10 w-7 h-7 rounded-full bg-rose-600 text-white text-[14px] font-bold shadow flex items-center justify-center"
                      aria-label={`${ad} takipten çıkar`}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        if (!confirm(`${ad.replace(/^@/, '')} takipten çıkarılsın mı? (Kaydettiğin mekanları silinmez.)`)) return
                        hesapBirak(h)
                        setHesaplar(hesaplariOku())
                        goster(`${ad.replace(/^@/, '')} takipten çıkarıldı`)
                      }}
                    >
                      ✕
                    </button>
                  )}
                  <KisiAvatar ad={hesapNormal(h)} foto={hesapFoto(h)} className="w-full aspect-square h-auto text-[26px]" />
                  <span className={`w-full font-semibold text-[12.5px] leading-tight truncate ${T_BASLIK}`}>{ad.replace(/^@/, '')}</span>
                  <span className={`w-full text-[11px] leading-tight truncate ${T_SOLUK}`}>
                    {onun.length ? `${onun.length} mekan · ${gidilen} gittin` : platform || 'mekan yok'}
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </div>
      <Toast text={toast} />
    </div>
  )
}

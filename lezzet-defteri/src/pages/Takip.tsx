import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { lzDb } from '../db'
import type { LzMekan } from '../types'
import { Header, Icon, KisiAvatar, T_BASLIK, T_GOVDE, T_SOLUK, Toast, useToast } from '../components/ui'
import { apiAnahtari, type MekanOnerisi } from '../lib/ai'
import { hesapFoto, hesapFotoGetir, hesapNormal, hesapTakipEt, hesaplariOku, otoKontrol, otoKontrolAyarla, sonYeniKontrol, yeniMekanlariBul } from '../lib/hesaplar'
import { instagramLinki, oneriKaydet } from '../lib/mekan'
import { PLATFORM_AD } from '../lib/importer'

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
            </div>
            <div className={`text-[12px] ${T_SOLUK}`}>{[o.tur, o.ilce, o.sehir].filter(Boolean).join(' · ')}</div>
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
                    await oneriKaydet(o)
                    goster(`${o.ad} Mekanlarım’a kaydedildi`)
                  }}
                >
                  ＋ Kaydet
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
  const [toast, goster] = useToast()
  const aiVar = !!apiAnahtari()

  // Daha once videosu kaydedilmis fenomenler de takibe alinir (takipten cikilanlar haric)
  useEffect(() => {
    let degisti = false
    for (const m of mekanlar) if (m.paylasan && hesapTakipEt(m.paylasan, PLATFORM_AD[m.platform] ?? '', true)) degisti = true
    if (degisti) setHesaplar(hesaplariOku())
  }, [mekanlar])

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

  const hepsiYeni = async () => {
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
            Bir fenomenin mekan videosunu <b>Paylaş → Lezzet Defteri</b> ile eklediğinde kendiliğinden buraya gelir. Elle de ekleyebilirsin.
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
              <button className="lz-btn-primary w-full" disabled={!aiVar || !!durum} onClick={() => void hepsiYeni()}>
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
        {durum && (
          <div className="lz-card p-3.5 flex items-center gap-3">
            <span className="w-5 h-5 rounded-full border-[2.5px] border-lz-600 border-t-transparent animate-spin flex-shrink-0" />
            <span className={`text-[14px] font-medium ${T_GOVDE}`}>{durum}</span>
          </div>
        )}
        {hata && <div className="rounded-2xl bg-rose-50 dark:bg-[#2a1a1d] text-rose-700 dark:text-rose-300 text-sm p-3">{hata}</div>}
        {yeniler && yeniler.length > 0 && (
          <div className="lz-card p-4 space-y-2">
            <div className={`font-semibold ${T_BASLIK}`}>Son gittikleri yeni yerler</div>
            <YeniListe liste={yeniler} mekanlar={mekanlar} goster={goster} />
          </div>
        )}

        {hesaplar.map((h) => {
          const { ad, platform } = hesapParca(h)
          const onun = onunMekanlari(mekanlar, h)
          const gidilen = onun.filter((m) => m.gidildi).length
          return (
            <Link key={h} to={`/influencer/${encodeURIComponent(h)}`} className="lz-card p-3.5 flex items-center gap-3 active:scale-[0.99] transition">
              <KisiAvatar ad={hesapNormal(h)} foto={hesapFoto(h)} className="w-12 h-12 text-[16px]" />
              <span className="flex-1 min-w-0">
                <span className={`block font-bold text-[15.5px] truncate ${T_BASLIK}`}>{ad}</span>
                <span className={`block text-[12.5px] ${T_SOLUK}`}>
                  {[platform, onun.length ? `${onun.length} mekan · ${gidilen} gittin` : 'kayıtlı mekanı yok'].filter(Boolean).join(' · ')}
                </span>
              </span>
              <Icon name="back" className={`w-5 h-5 rotate-180 ${T_SOLUK}`} />
            </Link>
          )
        })}
      </div>
      <Toast text={toast} />
    </div>
  )
}

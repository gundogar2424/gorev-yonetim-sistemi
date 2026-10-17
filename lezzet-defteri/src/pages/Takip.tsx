import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { lzDb } from '../db'
import type { LzMekan } from '../types'
import { Header, SofraRozet, T_BASLIK, T_GOVDE, T_SOLUK, Toast, useToast } from '../components/ui'
import { aiMekanOner, apiAnahtari, type MekanOnerisi } from '../lib/ai'
import { hesapBirak, hesapTakipEt, hesapNormal, hesaplariOku, otoKontrol, otoKontrolAyarla, sonYeniKontrol, yeniMekanlariBul } from '../lib/hesaplar'
import { instagramLinki, oneriKaydet } from '../lib/mekan'
import { PLATFORM_AD } from '../lib/importer'

const normal = (x: string) => x.toLocaleLowerCase('tr').replace(/[^\p{L}\p{N}]+/gu, '')

// TAKIP ETTIKLERIM: videosunu paylastigin yemek fenomenleri; her birinin kaydettigin mekanlari
// (gittin / gitmedin) ve istersen son zamanlarda gittigi yeni yerler.
export default function Takip() {
  const mekanlar = useLiveQuery(() => lzDb.mekanlar.toArray(), [], [] as LzMekan[]) ?? []
  const [hesaplar, setHesaplar] = useState(hesaplariOku())
  const [yeniler, setYeniler] = useState<Record<string, MekanOnerisi[]>>({})
  const [durum, setDurum] = useState('')
  const [hata, setHata] = useState('')
  const [oto, setOto] = useState(otoKontrol())
  const [toast, goster] = useToast()
  const aiVar = !!apiAnahtari()
  // Daha once videosu kaydedilmis fenomenler de kendiliginden takibe alinir (takipten cikilanlar haric)
  useEffect(() => {
    let degisti = false
    for (const m of mekanlar) if (m.paylasan && hesapTakipEt(m.paylasan, PLATFORM_AD[m.platform] ?? '', true)) degisti = true
    if (degisti) setHesaplar(hesaplariOku())
  }, [mekanlar])
  const kayitliMi = (ad: string) => mekanlar.find((m) => normal(m.ad) === normal(ad))

  // Tek kisinin son gittigi yerler (kayitli olmayanlar)
  const kisiYeni = async (h: string) => {
    setHata('')
    setDurum(`${h} son paylaşımları araştırılıyor…`)
    try {
      const l = await aiMekanOner(
        'Bu hesabın SON 60 GÜNDE paylaştığı/gittiği mekanlar, en yeniden eskiye. populerlik alanına paylaşım tarihini ve ne dediğini yaz. Bulunduğum yere yakınlık şart değil.',
        'Türkiye',
        mekanlar.map((m) => m.ad),
        h
      )
      const yeni = l.filter((o) => !kayitliMi(o.ad))
      setYeniler((y) => ({ ...y, [h]: yeni }))
      if (!yeni.length) goster(l.length ? 'Gittiği yerlerin hepsi zaten kayıtlı' : 'Son paylaşımlarında mekan bulunamadı')
    } catch (e) {
      setHata((e as Error).message)
    }
    setDurum('')
  }
  const hepsiYeni = async () => {
    setHata('')
    setDurum('Takip ettiklerinin son paylaşımları araştırılıyor…')
    try {
      const l = await yeniMekanlariBul()
      setYeniler((y) => ({ ...y, '*': l }))
      if (!l.length) goster('Yeni (kaydetmediğin) mekan bulunamadı')
    } catch (e) {
      setHata((e as Error).message)
    }
    setDurum('')
  }
  const kaydet = async (o: MekanOnerisi) => {
    await oneriKaydet(o)
    goster(`${o.ad} Mekanlarım’a kaydedildi`)
  }

  const YeniListe = ({ liste }: { liste: MekanOnerisi[] }) => (
    <div className="space-y-2">
      {liste.map((o, i) => {
        const k = kayitliMi(o.ad)
        return (
          <div key={i} className="rounded-2xl bg-[#f3f3f1] dark:bg-[#26262a] p-3 space-y-1">
            <div className={`font-semibold text-[14.5px] ${T_BASLIK}`}>
              <span className="text-[10.5px] font-bold uppercase tracking-wide text-lz-600 mr-1.5">Yeni</span>
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
                <button className="lz-btn-primary text-[12.5px] px-3 py-1.5" onClick={() => void kaydet(o)}>
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

  return (
    <div>
      <Header title="Takip ettiklerim" subtitle={hesaplar.length ? `${hesaplar.length} yemek fenomeni` : 'Videosunu paylaştığın fenomenler'} back />
      <div className="px-4 space-y-3 pb-8">
        {!hesaplar.length && (
          <div className={`lz-card p-5 text-[13.5px] ${T_GOVDE}`}>
            Henüz kimseyi takip etmiyorsun. Bir fenomenin mekan videosunu <b>Paylaş → Lezzet Defteri</b> ile eklediğinde kendiliğinden buraya
            gelir. Elle eklemek için: <Link to="/oner" className="text-lz-600 font-semibold underline">Bana mekan öner › Hesaplar</Link>.
          </div>
        )}
        {hesaplar.length > 0 && (
          <div className="lz-card p-4 space-y-2.5">
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
            {yeniler['*'] && <YeniListe liste={yeniler['*']} />}
          </div>
        )}
        {durum && (
          <div className="lz-card p-3.5 flex items-center gap-3">
            <span className="w-5 h-5 rounded-full border-[2.5px] border-lz-600 border-t-transparent animate-spin flex-shrink-0" />
            <span className={`text-[14px] font-medium ${T_GOVDE}`}>{durum}</span>
          </div>
        )}
        {hata && <div className="rounded-2xl bg-rose-50 dark:bg-[#2a1a1d] text-rose-700 dark:text-rose-300 text-sm p-3">{hata}</div>}

        {hesaplar.map((h) => {
          const onun = mekanlar.filter((m) => m.paylasan && hesapNormal(m.paylasan) === hesapNormal(h)).sort((a, b) => b.createdAt - a.createdAt)
          const gidilen = onun.filter((m) => m.gidildi).length
          return (
            <div key={h} className="lz-card p-4 space-y-2.5">
              <div className="flex items-center gap-3">
                <SofraRozet ad={hesapNormal(h)} className="w-11 h-11 text-[15px]" />
                <div className="flex-1 min-w-0">
                  <div className={`font-bold text-[16px] truncate ${T_BASLIK}`}>{h.replace(/\s*\([^)]*\)$/, '')}</div>
                  <div className={`text-[12.5px] ${T_SOLUK}`}>
                    {h.match(/\(([^)]*)\)$/)?.[1] ? `${h.match(/\(([^)]*)\)$/)![1]} · ` : ''}
                    {onun.length ? `${onun.length} mekanı kayıtlı · ${gidilen} tanesine gittin` : 'Kayıtlı mekanı yok'}
                  </div>
                </div>
                <button
                  className={`text-[12px] ${T_SOLUK} underline`}
                  onClick={() => {
                    if (!confirm(`${h} takipten çıkarılsın mı?`)) return
                    hesapBirak(h)
                    setHesaplar(hesaplariOku())
                  }}
                >
                  Takipten çık
                </button>
              </div>
              {onun.map((m) => (
                <Link key={m.id} to={`/mekan/${m.id}`} className="flex items-center gap-2 py-1">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${m.gidildi ? 'bg-emerald-500' : 'bg-[#d4d4d8]'}`} />
                  <span className={`flex-1 min-w-0 truncate text-[14px] ${T_GOVDE}`}>
                    {m.ad} <span className={`text-[12px] ${T_SOLUK}`}>{m.ilce || m.sehir}</span>
                  </span>
                  <span className={`text-[12px] font-semibold ${m.gidildi ? 'text-emerald-600' : T_SOLUK}`}>{m.gidildi ? 'Gittin' : 'Gitmedin'}</span>
                </Link>
              ))}
              <button className="lz-btn-soft w-full text-[13.5px] py-2.5" disabled={!aiVar || !!durum} onClick={() => void kisiYeni(h)}>
                Son gittiği yeni yerler
              </button>
              {yeniler[h] && <YeniListe liste={yeniler[h]} />}
            </div>
          )
        })}
      </div>
      <Toast text={toast} />
    </div>
  )
}

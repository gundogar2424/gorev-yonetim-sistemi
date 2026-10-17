import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { lzDb } from '../db'
import type { LzMekan } from '../types'
import { Header, SofraRozet, T_BASLIK, T_GOVDE, T_SOLUK, Toast, useToast } from '../components/ui'
import { aiMekanOner, apiAnahtari, type MekanOnerisi } from '../lib/ai'
import { hesapBirak, hesapNormal } from '../lib/hesaplar'
import { YeniListe, adNormal, hesapParca, onunMekanlari } from './Takip'

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
  const onun = onunMekanlari(mekanlar, h)
  const gidilen = onun.filter((m) => m.gidildi).length

  const yeniAra = async () => {
    setHata('')
    setDurum(`${ad} son paylaşımları araştırılıyor…`)
    try {
      const l = await aiMekanOner(
        'Bu hesabın SON 60 GÜNDE paylaştığı/gittiği mekanlar, en yeniden eskiye. populerlik alanına paylaşım tarihini ve ne dediğini yaz. Bulunduğum yere yakınlık şart değil.',
        'Türkiye',
        mekanlar.map((m) => m.ad),
        h
      )
      const yeni = l.filter((o) => !mekanlar.some((m) => adNormal(m.ad) === adNormal(o.ad)))
      setYeniler(yeni)
      if (!yeni.length) goster(l.length ? 'Gittiği yerlerin hepsi zaten kayıtlı' : 'Son paylaşımlarında mekan bulunamadı')
    } catch (e) {
      setHata((e as Error).message)
    }
    setDurum('')
  }

  return (
    <div>
      <Header title={ad} subtitle={platform || 'Influencer'} back />
      <div className="px-4 space-y-3 pb-8">
        <div className="lz-card p-4 flex items-center gap-4">
          <SofraRozet ad={hesapNormal(h)} className="w-16 h-16 text-[22px]" />
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
          <button className="lz-btn-primary text-[14px]" disabled={!apiAnahtari() || !!durum} onClick={() => void yeniAra()}>
            Yeni gittiği yerler
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
            <div className={`font-semibold ${T_BASLIK}`}>Son gittiği yeni yerler</div>
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
                <span className={`block font-semibold text-[14.5px] ${T_BASLIK}`}>{m.ad}</span>
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

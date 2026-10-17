import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Header, Icon, T_BASLIK, T_GOVDE, T_SOLUK, Toast, useToast } from '../components/ui'
import { aiHypeTarifler, apiAnahtari, type HypeTarif } from '../lib/ai'
import { siraEkle } from '../lib/sira'

const KEY = 'lz-hype-tarif' // { [filtre]: { t, liste } } — 24 saat onbellek (kredi tasarrufu)
const GUN = 24 * 3600 * 1000
const TURLER = ['Hepsi', 'Tatlı', 'Ana yemek', 'Pratik', 'Diyet / fit', 'Kahvaltılık']

type Onbellek = Record<string, { t: number; liste: HypeTarif[] }>
function oku(): Onbellek {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') as Onbellek
  } catch {
    return {}
  }
}

// HYPE TARIFLER: su an sosyal medyada viral olan ev tarifleri; linki olan dogrudan deftere (siraya) eklenir
export default function HypeTarifler() {
  const [tur, setTur] = useState('Hepsi')
  const [liste, setListe] = useState<HypeTarif[]>(() => oku()['Hepsi']?.liste ?? [])
  const [zaman, setZaman] = useState(() => oku()['Hepsi']?.t ?? 0)
  const [durum, setDurum] = useState('')
  const [hata, setHata] = useState('')
  const [eklenen, setEklenen] = useState<string[]>([])
  const [toast, goster] = useToast()
  const aiVar = !!apiAnahtari()

  const getir = async (t: string, yenile = false) => {
    setTur(t)
    setHata('')
    const eski = oku()[t]
    if (!yenile && eski && Date.now() - eski.t < GUN) {
      setListe(eski.liste)
      setZaman(eski.t)
      return
    }
    setListe([])
    setDurum('Sosyal medyada şu an viral olan tarifler araştırılıyor…')
    try {
      const l = await aiHypeTarifler(t === 'Hepsi' ? '' : t)
      setListe(l)
      setZaman(Date.now())
      try {
        localStorage.setItem(KEY, JSON.stringify({ ...oku(), [t]: { t: Date.now(), liste: l } }))
      } catch {
        /* yok */
      }
      if (!l.length) setHata('Şu an viral tarif bulunamadı; biraz sonra tekrar dene.')
    } catch (e) {
      setHata((e as Error).message)
    }
    setDurum('')
  }

  const ekle = async (x: HypeTarif) => {
    await siraEkle(x.link, 'tarif')
    setEklenen((e) => [...e, x.ad])
    goster('Sıraya eklendi; tarif arka planda deftere yazılıyor')
  }
  const ara = (x: HypeTarif) => `https://www.youtube.com/results?search_query=${encodeURIComponent(`${x.ad} tarifi`)}`

  return (
    <div>
      <Header title="Hype tarifler" subtitle="Şu an sosyal medyada viral olanlar" back />
      <div className="px-4 space-y-3 pb-8">
        <div className="lz-card p-4 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {TURLER.map((t) => (
              <button key={t} className={`lz-chip text-[13px] ${tur === t ? 'lz-chip-on' : ''}`} disabled={!!durum} onClick={() => void getir(t)}>
                {t}
              </button>
            ))}
          </div>
          <button className="lz-btn-primary w-full" disabled={!aiVar || !!durum} onClick={() => void getir(tur, liste.length > 0)}>
            <Icon name="sparkle" className="w-[18px] h-[18px]" /> {liste.length ? 'Yeniden ara' : 'Viral tarifleri bul'}
          </button>
          {zaman > 0 && !durum && (
            <p className={`text-[12px] ${T_SOLUK}`}>
              Son arama: {new Date(zaman).toLocaleString('tr', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })} · aynı gün tekrar bakınca kredi harcanmaz
            </p>
          )}
          {!aiVar && (
            <p className="text-[12.5px] text-rose-600">
              Bunun için <Link to="/ayarlar" className="underline font-semibold">Ayarlar</Link>’dan Gemini anahtarı gerekli.
            </p>
          )}
        </div>
        {durum && (
          <div className="lz-card p-3.5 flex items-center gap-3">
            <span className="w-5 h-5 rounded-full border-[2.5px] border-lz-600 border-t-transparent animate-spin flex-shrink-0" />
            <span className={`text-[14px] font-medium ${T_GOVDE}`}>{durum}</span>
          </div>
        )}
        {hata && <div className="rounded-2xl bg-rose-50 dark:bg-[#2a1a1d] text-rose-700 dark:text-rose-300 text-sm p-3">{hata}</div>}
        {liste.map((x, i) => (
          <div key={i} className="lz-card p-4 space-y-1.5">
            <div className="flex items-start gap-3">
              <span className="w-7 h-7 rounded-full bg-lz-50 dark:bg-[#3a1d16] text-lz-600 text-[13px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className={`font-bold text-[16px] leading-snug ${T_BASLIK}`}>{x.ad}</div>
                {(x.hesap || x.platform) && <div className={`text-[12.5px] ${T_SOLUK}`}>{[x.hesap, x.platform].filter(Boolean).join(' · ')}</div>}
              </div>
            </div>
            <p className={`text-[13.5px] ${T_GOVDE}`}>{x.neden}</p>
            {x.malzemeler && <p className={`text-[13px] ${T_SOLUK}`}>Malzemeler: {x.malzemeler}</p>}
            <div className="grid grid-cols-2 gap-2 pt-1">
              {x.link ? (
                <>
                  <a href={x.link} target="_blank" rel="noreferrer" className="lz-btn-soft text-[13px] px-2 py-2.5">
                    Videoyu aç
                  </a>
                  <button className="lz-btn-primary text-[13px] px-2 py-2.5" disabled={eklenen.includes(x.ad)} onClick={() => void ekle(x)}>
                    {eklenen.includes(x.ad) ? '✓ Sırada' : 'Deftere ekle'}
                  </button>
                </>
              ) : (
                <a href={ara(x)} target="_blank" rel="noreferrer" className="lz-btn-soft text-[13px] px-2 py-2.5 col-span-2">
                  Videosunu YouTube’da ara
                </a>
              )}
            </div>
          </div>
        ))}
        {liste.length > 0 && (
          <p className={`text-[11.5px] text-center px-2 ${T_SOLUK}`}>
            Liste yapay zekanın Google araması. Videosunu açıp beğendiğini Paylaş → Lezzet Defteri ile de ekleyebilirsin.
          </p>
        )}
      </div>
      <Toast text={toast} />
    </div>
  )
}

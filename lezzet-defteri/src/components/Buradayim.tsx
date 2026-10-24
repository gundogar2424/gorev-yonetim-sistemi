import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon, Sheet, T_BASLIK, T_GOVDE, T_SOLUK } from './ui'
import { haritaLinkiMi, mekanLinktenEkle, telefonKonumu, mesafeYaz, type Konum } from '../lib/mekan'
import { linkAyikla } from '../lib/importer'
import { haritaLinkindenYer, yakindakiYerler, yeriKaydet, type YakinYer } from '../lib/burada'

// SU AN BURADAYIM: konumdan etraftaki mekanlar listelenir; secilen yer kaydedilip "Buraya gittim" formu acilir
export default function Buradayim() {
  const navigate = useNavigate()
  const [acik, setAcik] = useState(false)
  const [durum, setDurum] = useState('')
  const [hata, setHata] = useState('')
  const [liste, setListe] = useState<YakinYer[]>([])
  const [konum, setKonum] = useState<Konum>()
  const [ad, setAd] = useState('')

  const bul = async () => {
    setAcik(true)
    setHata('')
    setListe([])
    setDurum('Konumun alınıyor…')
    try {
      const k = await telefonKonumu(12000)
      setKonum(k)
      setDurum('Etraftaki mekanlar bulunuyor…')
      const l = await yakindakiYerler(k)
      setListe(l)
      if (!l.length) setHata('Yakında kayıtlı bir mekan bulunamadı. Adını aşağıya yazabilirsin.')
    } catch (e) {
      setHata((e as Error).message || 'Konum alınamadı; konumu açıp tekrar dene.')
    }
    setDurum('')
  }
  // Elle: ad ya da Google Haritalar linki
  const elle = async () => {
    const g = ad.trim()
    if (!haritaLinkiMi(g)) return sec({ ad: g, tur: '', adres: '', lat: konum!.lat, lon: konum!.lon, km: 0 })
    setDurum('Harita linki okunuyor…')
    setHata('')
    try {
      const y = await haritaLinkindenYer(linkAyikla(g) || g)
      if (y) {
        if (!y.lat && !y.lon && konum) Object.assign(y, { lat: konum.lat, lon: konum.lon })
        return sec(y)
      }
      // Okunamadiysa yapay zeka ile (normal "Mekan ekle" yolu)
      setDurum('Mekan araştırılıyor…')
      const s = await mekanLinktenEkle(g, (m) => setDurum(m))
      setAcik(false)
      navigate(`/mekan/${s.id}`, { state: { gittim: true } })
    } catch (e) {
      setHata((e as Error).message || 'Link okunamadı.')
    }
    setDurum('')
  }
  const sec = async (y: YakinYer) => {
    if (!konum && !y.lat) return
    setDurum(`${y.ad} kaydediliyor…`)
    const id = await yeriKaydet(y, konum ?? { lat: y.lat, lon: y.lon })
    setDurum('')
    setAcik(false)
    navigate(`/mekan/${id}`, { state: { gittim: true } })
  }

  return (
    <>
      <button className="lz-card p-3.5 flex items-center gap-3 w-full text-left" onClick={() => void bul()}>
        <span className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-[#10261e] text-emerald-600 flex items-center justify-center">
          <Icon name="pin" className="w-[18px] h-[18px]" />
        </span>
        <span className="flex-1 min-w-0">
          <span className={`block font-semibold ${T_BASLIK}`}>Şu an buradayım</span>
          <span className={`block text-[12.5px] ${T_SOLUK}`}>Bulunduğun mekanı konumdan bul, ziyaretini ve ne yediğini kaydet</span>
        </span>
        <Icon name="back" className={`w-5 h-5 rotate-180 ${T_SOLUK}`} />
      </button>
      <Sheet open={acik} onClose={() => setAcik(false)} title="Neredesin?">
        <div className="space-y-2">
          {durum && (
            <div className="flex items-center gap-2.5 py-2">
              <span className="w-5 h-5 rounded-full border-[2.5px] border-lz-600 border-t-transparent animate-spin" />
              <span className={`text-[14px] ${T_GOVDE}`}>{durum}</span>
            </div>
          )}
          {hata && <p className="text-[13px] text-rose-600 dark:text-rose-300">{hata}</p>}
          {liste.map((y, i) => (
            <button key={i} className="lz-card p-3 w-full flex items-center gap-3 text-left" disabled={!!durum} onClick={() => void sec(y)}>
              <span className="flex-1 min-w-0">
                <span className={`block font-semibold text-[14.5px] ${T_BASLIK}`}>
                  {y.ad}
                  {y.kayitliId && <span className="ml-1.5 text-[11px] font-bold text-emerald-600">KAYITLI</span>}
                </span>
                <span className={`block text-[12px] ${T_SOLUK}`}>
                  {[y.puan ? `★ ${y.puan.toFixed(1).replace('.', ',')}` : '', y.tur, y.adres].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span className="text-[12.5px] font-semibold text-lz-600 whitespace-nowrap">{mesafeYaz(y.km)}</span>
            </button>
          ))}
          {!durum && (
            <div className="pt-2 space-y-2">
              <div className={`text-[12.5px] ${T_SOLUK}`}>Listede yok mu? Adını yaz ya da Google Haritalar’dan “Paylaş” ile kopyaladığın linki yapıştır:</div>
              <div className="flex gap-2">
                <input className="lz-input py-2 text-[14px] flex-1" placeholder="Mekanın adı ya da harita linki" value={ad} onChange={(e) => setAd(e.target.value)} />
                <button
                  className="lz-btn-primary px-4 text-[14px]"
                  disabled={!ad.trim() || (!konum && !haritaLinkiMi(ad))}
                  onClick={() => void elle()}
                >
                  Kaydet
                </button>
              </div>
            </div>
          )}
        </div>
      </Sheet>
    </>
  )
}

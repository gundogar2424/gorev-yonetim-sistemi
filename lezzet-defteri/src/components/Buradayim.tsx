import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AltSayfa, Icon, T_BASLIK, T_GOVDE, T_SOLUK } from './ui'
import { haritaLinkiMi, mekanLinktenEkle, type Konum } from '../lib/mekan'
import { linkAyikla } from '../lib/importer'
import { birlestir, haritaLinkindenYer, kayitliYakinlar, yakindakiYerler, yeriKaydet, type YakinYer } from '../lib/burada'
import { akilliKonum, onceYaz, yurumeYaz } from '../lib/cevre'

// SU AN BURADAYIM: konumdan etraftaki mekanlar listelenir; secilen yer kaydedilip "Buraya gittim" formu acilir
export default function Buradayim() {
  const navigate = useNavigate()
  const [acik, setAcik] = useState(false)
  const [durum, setDurum] = useState('')
  // Hata sari uyari olarak gosterilir; tekrar: hangi adim yeniden denenecek
  const [hata, setHata] = useState<{ baslik: string; alt: string; tekrar?: 'konum' | 'harita' } | null>(null)
  const [liste, setListe] = useState<YakinYer[]>([])
  const [konum, setKonum] = useState<Konum>()
  const [ad, setAd] = useState('')
  const [guncel, setGuncel] = useState(0) // cevre listesinin alindigi an

  // Cevredeki mekanlar: kayitlilar hemen listede kalir, cevre arkadan dolar (24 saat onbellek; Yenile sifirdan)
  const haritadanBul = async (k: Konum, yenile = false) => {
    setHata(null)
    setDurum('Çevredeki mekanlar yükleniyor…')
    const yavasT = setTimeout(() => setDurum('Çevre yavaş geliyor; kayıtlı mekanlar listede…'), 3000)
    try {
      const r = await yakindakiYerler(k, yenile)
      setListe(r.liste)
      setGuncel(r.zaman)
      if (!r.liste.length) setHata({ baslik: 'Yakında mekan bulunamadı.', alt: 'Mekanın adını aşağıya yaz, biz bulalım.' })
    } catch {
      setHata({ baslik: 'Harita servisine ulaşılamadı.', alt: 'İnternetini kontrol et ya da mekanın adını yaz, biz bulalım.', tekrar: 'harita' })
    }
    clearTimeout(yavasT)
    setDurum('')
  }
  const bul = async () => {
    setAcik(true)
    setHata(null)
    setDurum('Konumun alınıyor…')
    let k: Konum
    try {
      k = (await akilliKonum(12000)).konum
      setKonum(k)
    } catch (e) {
      setListe([])
      setHata({ baslik: 'Konum alınamadı.', alt: `${(e as Error).message || 'Konumu açıp tekrar dene'}. Ya da mekanın adını yaz, biz bulalım.`, tekrar: 'konum' })
      setDurum('')
      return
    }
    // Kayitli mekanlar telefondan aninda
    setListe(birlestir(await kayitliYakinlar(k), []))
    await haritadanBul(k)
  }
  // Elle: ad ya da Google Haritalar linki
  const elle = async () => {
    const g = ad.trim()
    if (!g) return
    // Ad yazildi ve konum var: bulundugun yere kaydedilir
    if (!haritaLinkiMi(g) && konum) return sec({ ad: g, tur: '', adres: '', lat: konum.lat, lon: konum.lon, km: 0 })
    // Konum yoksa ad yapay zekayla araştırılır (Mekan ekle ile ayni yol)
    if (!haritaLinkiMi(g)) {
      setHata(null)
      setDurum('Mekan araştırılıyor…')
      try {
        const s = await mekanLinktenEkle(g, (m) => setDurum(m))
        setAcik(false)
        navigate(`/mekan/${s.id}`, { state: { gittim: true } })
      } catch (e) {
        setHata({ baslik: 'Mekan bulunamadı.', alt: (e as Error).message || 'Adına semti de ekleyip tekrar dene.' })
      }
      setDurum('')
      return
    }
    setDurum('Harita linki okunuyor…')
    setHata(null)
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
      setHata({ baslik: 'Link okunamadı.', alt: (e as Error).message || 'Mekanın adını yazmayı dene.' })
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
      <AltSayfa open={acik} onClose={() => setAcik(false)} title="Neredesin?">
        <div className="space-y-2.5">
          {durum && (
            <div className="flex items-center gap-2.5 py-2">
              <span className="w-5 h-5 rounded-full border-[2.5px] border-lz-600 border-t-transparent animate-spin" />
              <span className={`text-[14px] ${T_GOVDE}`}>{durum}</span>
            </div>
          )}
          {hata && (
            // Hata kirmizi degil: sari uyari, altinda gri ipucu ve Tekrar dene
            <div className="rounded-2xl bg-amber-50 dark:bg-[#33270f] p-3 space-y-2">
              <p className="text-[14px] font-semibold text-amber-900 dark:text-amber-200">{hata.baslik}</p>
              <p className={`text-[12.5px] ${T_SOLUK}`}>{hata.alt}</p>
              {hata.tekrar && (
                <button
                  className="lz-btn-soft w-full text-[14px]"
                  disabled={!!durum}
                  onClick={() => void (hata.tekrar === 'harita' && konum ? haritadanBul(konum, true) : bul())}
                >
                  ↻ Tekrar dene
                </button>
              )}
            </div>
          )}
          {guncel > 0 && konum && !durum && (
            <p className={`text-[12px] ${T_SOLUK}`}>
              Son güncelleme {onceYaz(guncel)} ·{' '}
              <button className="text-lz-600 font-semibold underline min-h-[32px]" onClick={() => void haritadanBul(konum, true)}>
                Yenile
              </button>
            </p>
          )}
          {liste.map((y, i) => (
            <button key={i} className="lz-card p-3 w-full flex items-center gap-3 text-left min-h-[56px]" disabled={/kaydediliyor|araştırılıyor|okunuyor/.test(durum)} onClick={() => void sec(y)}>
              <span className="flex-1 min-w-0">
                <span className={`block font-semibold text-[14.5px] ${T_BASLIK}`}>
                  {y.ad}
                  {y.kayitliId && <span className="ml-1.5 text-[11px] font-bold text-emerald-600">KAYITLI</span>}
                </span>
                <span className={`block text-[12px] ${T_SOLUK}`}>
                  {[y.puan ? `★ ${y.puan.toFixed(1).replace('.', ',')}` : '', y.tur, y.adres].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span className="flex flex-col items-end gap-0.5 flex-shrink-0">
                <span className="text-[12px] font-semibold text-lz-600 whitespace-nowrap">{yurumeYaz(y.km)}</span>
                {y.acik !== undefined && (
                  <span className={`text-[10.5px] font-bold px-1.5 rounded ${y.acik ? 'bg-emerald-600 text-white' : 'bg-[#6A5F51] text-white'}`}>{y.acik ? 'Açık' : 'Kapalı'}</span>
                )}
              </span>
            </button>
          ))}
          {!durum && (
            <div className="pt-1 space-y-2">
              <label htmlFor="burada-ad" className={`block text-[13px] font-semibold ${T_BASLIK}`}>
                Mekan adı ya da harita linki
              </label>
              {/* Kutu ve dugme alt alta: dar ekranda da ikisi tam gorunur */}
              <input
                id="burada-ad"
                className="lz-input text-[14.5px] w-full min-h-[48px]"
                placeholder="Örn. Serdivan’da kebapçı"
                value={ad}
                onChange={(e) => setAd(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && ad.trim() && void elle()}
              />
              <button
                className={`w-full min-h-[48px] rounded-xl text-[15px] font-bold text-white transition-transform ${ad.trim() ? 'bg-lz-600 active:scale-[0.98]' : 'bg-lz-600 opacity-40'}`}
                disabled={!ad.trim()}
                onClick={() => void elle()}
              >
                Kaydet
              </button>
            </div>
          )}
        </div>
      </AltSayfa>
    </>
  )
}

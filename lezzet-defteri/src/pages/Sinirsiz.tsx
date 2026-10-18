import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { lzDb } from '../db'
import type { LzMekan } from '../types'
import { Header, T_BASLIK, T_GOVDE, T_SOLUK, Thumb, Toast, useToast } from '../components/ui'
import { aiMekanOner, apiAnahtari, type MekanOnerisi } from '../lib/ai'
import { instagramLinki, konumdanAdres, mesafeKm, mesafeYaz, oneriKaydet, telefonKonumu, type Konum } from '../lib/mekan'

const SINIRSIZ = /sınırsız|limitsiz|açık büfe|doyasıya|bitirdikçe|yenileyebilir/i
// Serpme kahvalti sinirsiz yemek sayilmaz (acik bufe kahvalti sayilir)
const serpme = (t: string) => /serpme/i.test(t) && !/açık büfe/i.test(t)
// Mekanin sinirsiz teklifi: once kampanya, sonra notlar / onerilenler
export function sinirsizTeklif(m: LzMekan): string {
  for (const p of [m.kampanya?.ozet ?? '', m.notlar, ...m.oneriler, m.paylasanYorumu?.begendi ?? '', m.paylasanYorumu?.yedi ?? '']) {
    const c = p ? p.split(/(?<=[.!?\n])\s*/).find((x) => SINIRSIZ.test(x) && !serpme(x)) : ''
    if (c) return c.trim().slice(0, 160)
  }
  return ''
}

// SINIRSIZ: sinirsiz pizza/kofte/kahvalti, acik bufe… sunan yerler — kayitlilar ve yakinda yeni arama
export default function Sinirsiz() {
  const mekanlar = useLiveQuery(() => lzDb.mekanlar.toArray(), [], [] as LzMekan[]) ?? []
  const kayitli = mekanlar.filter((m) => sinirsizTeklif(m))
  const [km, setKm] = useState(10)
  const [konum, setKonum] = useState<Konum>()
  const [sonuc, setSonuc] = useState<(MekanOnerisi & { km?: number })[] | null>(null)
  const [durum, setDurum] = useState('')
  const [hata, setHata] = useState('')
  const [toast, goster] = useToast()
  const mesafe = (m: { lat?: number; lon?: number }) => (konum && m.lat !== undefined && m.lon !== undefined ? mesafeKm(konum, { lat: m.lat, lon: m.lon }) : undefined)

  const ara = async () => {
    setHata('')
    setSonuc(null)
    try {
      setDurum('Konumun alınıyor…')
      const k = await telefonKonumu(10000).catch(() => {
        throw new Error('Konum alınamadı; konumu açıp tekrar dene.')
      })
      setKonum(k)
      const yer = (await konumdanAdres(k)) || `${k.lat.toFixed(3)}, ${k.lon.toFixed(3)}`
      setDurum('Sınırsız yemek veren yerler araştırılıyor…')
      const l = await aiMekanOner(
        'SINIRSIZ / LİMİTSİZ yemek sunan mekanlar: sınırsız pizza, köfte, kanat, çiğ köfte, makarna, döner, tatlı, açık büfe restoran gibi. ' +
          'açık büfe kahvaltı da olur; ama SERPME KAHVALTIYI KESİNLİKLE ALMA. YALNIZCA şu an böyle bir teklifi olduğu güncel kaynaklarla anlaşılan yerler. neden alanına teklifin ' +
          'kendisini, FİYATINI ve geçerli gün/saatleri yaz (ör. "390 TL’ye sınırsız pizza, her gün 13:00–17:30").',
        yer,
        mekanlar.map((m) => m.ad),
        '',
        '',
        undefined,
        km
      )
      const r = l
        .map((o) => ({ ...o, km: o.enlem || o.boylam ? mesafeKm(k, { lat: o.enlem, lon: o.boylam }) : undefined }))
        .filter((o) => !km || o.km === undefined || o.km <= km + 0.5)
        .filter((o) => !serpme(`${o.ad} ${o.tur} ${o.neden}`))
        .sort((a, b) => (a.km ?? 999) - (b.km ?? 999))
      setSonuc(r)
      if (!r.length) setHata(`${km ? `${km} km içinde` : 'Yakınında'} sınırsız teklif bulunamadı; mesafeyi büyütmeyi dene.`)
    } catch (e) {
      setHata((e as Error).message)
    }
    setDurum('')
  }

  return (
    <div>
      <Header title="Sınırsız" subtitle="Sınırsız / açık büfe yemek veren yerler" back />
      <div className="px-4 space-y-3 pb-8">
        <div className="lz-card p-4 space-y-2.5">
          <div className={`font-semibold ${T_BASLIK}`}>Yakınımda sınırsız yemek</div>
          <div className="flex gap-1.5">
            {[1, 3, 5, 10, 0].map((x) => (
              <button key={x} className={`lz-chip justify-center flex-1 !px-1 text-[12.5px] ${km === x ? 'lz-chip-on' : ''}`} onClick={() => setKm(x)}>
                {x ? `${x} km` : 'Sınırsız'}
              </button>
            ))}
          </div>
          <button className="lz-btn-primary w-full" disabled={!apiAnahtari() || !!durum} onClick={() => void ara()}>
            {durum || 'Sınırsız yemek veren yerleri bul'}
          </button>
          <p className={`text-[12px] ${T_SOLUK}`}>Genel arama: kayıtlı ya da takip ettiğin yerlerle sınırlı değil; senin mekanların aşağıda ayrıca listelenir. Tek aramalık kredi harcar (1 TL’nin altında). Teklifler değişebilir; gitmeden mekanın Instagram’ından teyit et.</p>
        </div>
        {hata && <div className="rounded-2xl bg-rose-50 dark:bg-[#2a1a1d] text-rose-700 dark:text-rose-300 text-sm p-3">{hata}</div>}
        {sonuc?.map((o, i) => {
          const k = mekanlar.find((m) => m.ad.toLocaleLowerCase('tr') === o.ad.toLocaleLowerCase('tr'))
          return (
            <div key={i} className="lz-card p-4 space-y-1.5">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className={`font-bold text-[16px] ${T_BASLIK}`}>{o.ad}</div>
                  <div className={`text-[12.5px] ${T_SOLUK}`}>
                    {o.puan ? <b className="text-amber-600 dark:text-amber-300">★ {o.puan.toFixed(1).replace('.', ',')} · </b> : null}
                    {[o.tur, o.ilce, o.sehir].filter(Boolean).join(' · ')}
                  </div>
                </div>
                {o.km !== undefined && <span className="text-[13px] font-semibold text-lz-600 whitespace-nowrap">{mesafeYaz(o.km)}</span>}
              </div>
              <div className="rounded-xl bg-emerald-50 dark:bg-[#10261e] text-emerald-900 dark:text-emerald-200 px-3 py-2 text-[13.5px] font-medium">{o.neden}</div>
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

        <div className={`px-1 pt-2 text-[15px] font-bold ${T_BASLIK}`}>
          Kayıtlı mekanlarımda <span className={`text-[13px] font-medium ${T_SOLUK}`}>{kayitli.length}</span>
        </div>
        {!kayitli.length && (
          <div className={`lz-card p-4 text-[13.5px] ${T_GOVDE}`}>
            Kayıtlı mekanlarında henüz sınırsız teklif yok. Mekanlarım’da <b>Kampanyaları kontrol et</b>’e basınca bulunanlar da buraya gelir.
          </div>
        )}
        {kayitli
          .sort((a, b) => (mesafe(a) ?? 999) - (mesafe(b) ?? 999))
          .map((m) => (
            <Link key={m.id} to={`/mekan/${m.id}`} className="lz-card p-3 flex gap-3">
              <Thumb src={m.foto} className="w-14 h-14 rounded-xl" />
              <span className="flex-1 min-w-0">
                <span className={`block font-semibold ${T_BASLIK}`}>{m.ad}</span>
                <span className={`block text-[12px] ${T_SOLUK}`}>{[m.tur, m.ilce, m.sehir].filter(Boolean).join(' · ')}</span>
                <span className="block text-[12.5px] mt-0.5 text-emerald-700 dark:text-emerald-300 line-clamp-2">{sinirsizTeklif(m)}</span>
              </span>
              {mesafe(m) !== undefined && <span className="text-[12.5px] font-semibold text-lz-600 whitespace-nowrap self-end">{mesafeYaz(mesafe(m)!)}</span>}
            </Link>
          ))}
      </div>
      <Toast text={toast} />
    </div>
  )
}

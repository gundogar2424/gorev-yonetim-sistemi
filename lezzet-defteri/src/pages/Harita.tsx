import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import { lzDb } from '../db'
import type { LzMekan } from '../types'
import { Header, Icon, T_BASLIK, T_SOLUK } from '../components/ui'
import { DahaFazlaGoster } from '../components/DahaFazla'
import { mesafeKm, type Konum } from '../lib/mekan'
import { yeriKaydet, type YakinYer } from '../lib/burada'
import { YARICAPLAR, akilliKonum, cevreGetir, onceYaz, sonKonum, yurumeYaz } from '../lib/cevre'
import { OnbellekliKaro, evCevresiniSakla } from '../lib/karoOnbellek'

// HARITA: iki katman.
//  1) Kayitli mekanlar telefondan aninda (ag beklenmez)
//  2) Cevredeki yeni mekanlar arka planda dolar (1 km ile baslar, 24 saat onbellek, Google 4 sn sonra OpenStreetMap)
// Harita ustte, liste altta suruklenen panelde. Pin -> panelde o mekanin karti. Kaydirinca "Bu bolgede ara".

type Suzgec = 'hepsi' | 'istek' | 'favori' | 'gittim' | 'kampanya'
const SUZGEC: [Suzgec, string][] = [
  ['hepsi', 'Hepsi'],
  ['istek', 'Gitmek istediklerim'],
  ['favori', 'Favoriler'],
  ['gittim', 'Gittiklerim'],
  ['kampanya', 'Kampanyalı']
]
// Nokta rengi: gittim yesil, kampanya mor, gitmek istiyorum/favori kirmizi, kayitli diger gri, cevredeki yeni turuncu-kahve
function renk(m: LzMekan): string {
  if (m.gidildi) return '#16a34a'
  if (m.kampanya && Date.now() - m.kampanya.zaman < 7 * 864e5) return '#7c3aed'
  if (m.gitmekIstiyorum || m.favori) return '#d93d20'
  return '#6A5F51'
}
const sade = (x: string) => x.toLocaleLowerCase('tr').replace(/[^\p{L}\p{N}]+/gu, '')

// Pin: renkli nokta + acik/kapali rozeti (biliniyorsa)
function pinIkonu(dolgu: string, acik: boolean | undefined, secili: boolean, yeni: boolean): L.DivIcon {
  const boy = secili ? 22 : 16
  const rozet =
    acik === undefined
      ? ''
      : `<span style="position:absolute;left:${boy - 4}px;top:-8px;font:700 9px/1 Inter,sans-serif;padding:2px 4px;border-radius:5px;color:#fff;background:${acik ? '#16a34a' : '#4A4239'};white-space:nowrap">${acik ? 'Açık' : 'Kapalı'}</span>`
  return L.divIcon({
    className: '',
    iconSize: [boy, boy],
    iconAnchor: [boy / 2, boy / 2],
    html: `<span style="position:relative;display:block;width:${boy}px;height:${boy}px;border-radius:50%;background:${dolgu};border:${yeni ? '2px dashed #fff' : '2.5px solid #fff'};box-shadow:0 1px 4px rgba(0,0,0,.35)">${rozet}</span>`
  })
}

interface Satir {
  anahtar: string
  ad: string
  tur: string
  km: number
  lat: number
  lon: number
  acik?: boolean
  kayitli?: LzMekan
  yer?: YakinYer
}

export default function Harita() {
  const navigate = useNavigate()
  const mekanHam = useLiveQuery(() => lzDb.mekanlar.toArray(), [])
  const mekanlar = mekanHam ?? []
  const [sehir, setSehir] = useState('')
  const [suzgec, setSuzgec] = useState<Suzgec>('hepsi')
  const ilk = sonKonum()
  const [konum, setKonum] = useState<Konum | undefined>(ilk ? { lat: ilk.lat, lon: ilk.lon } : undefined)
  const [merkez, setMerkez] = useState<Konum | undefined>(ilk ? { lat: ilk.lat, lon: ilk.lon } : undefined) // aramanin merkezi
  const [konumMesaj, setKonumMesaj] = useState('')
  const [adim, setAdim] = useState(0) // YARICAPLAR[adim]
  const [cevre, setCevre] = useState<YakinYer[]>([])
  const [guncel, setGuncel] = useState(0)
  const [yukleniyor, setYukleniyor] = useState(false)
  const [yavas, setYavas] = useState(false) // 3 sn'yi gecti
  const [uyari, setUyari] = useState('')
  const [buBolge, setBuBolge] = useState(false) // harita kaydirildi: "Bu bolgede ara"
  const [secili, setSecili] = useState('')
  const [panel, setPanel] = useState<'kucuk' | 'orta' | 'buyuk'>('orta')
  const [ekleniyor, setEkleniyor] = useState('')
  const kutu = useRef<HTMLDivElement>(null)
  const harita = useRef<L.Map>()
  const kume = useRef<L.MarkerClusterGroup>()
  const ust = useRef<L.LayerGroup>()
  const elleHareket = useRef(false)
  const istekNo = useRef(0)
  const yaricap = YARICAPLAR[adim]

  // Cevreyi getir (onbellek 24 saat; yenile = sifirdan). Kayitli mekanlar bu sirada ekranda kalir.
  const cevreYukle = async (k: Konum, r: number, yenile = false) => {
    const no = ++istekNo.current
    setYukleniyor(true)
    setUyari('')
    setYavas(false)
    const yavasT = setTimeout(() => no === istekNo.current && setYavas(true), 3000)
    try {
      const c = await cevreGetir(k, r, yenile)
      if (no !== istekNo.current) return
      setCevre(c.yerler)
      setGuncel(c.zaman)
    } catch {
      if (no !== istekNo.current) return
      setUyari('Harita servisine ulaşılamadı.')
    }
    clearTimeout(yavasT)
    if (no === istekNo.current) {
      setYukleniyor(false)
      setYavas(false)
    }
  }

  // Konum: 100 m'den az hareket edildiyse ayni konum (onbellek gecerli kalir)
  useEffect(() => {
    void (async () => {
      try {
        const { konum: k, eski } = await akilliKonum(10000)
        setKonum(k)
        setMerkez((m) => m ?? k)
        if (eski) setKonumMesaj('Konum alınamadı; son bilinen konum kullanılıyor.')
        if (!ilk || mesafeKm(ilk, k) * 1000 >= 100) setMerkez(k)
      } catch {
        setKonumMesaj('Konum alınamadı; haritayı kaydırıp “Bu bölgede ara”ya dokunabilirsin.')
      }
    })()
  }, [])
  // Merkez ya da yaricap degisince cevre (arka planda)
  useEffect(() => {
    if (merkez) void cevreYukle(merkez, yaricap)
  }, [merkez?.lat, merkez?.lon, yaricap])

  // Harita bir kez kurulur
  useEffect(() => {
    if (!kutu.current || harita.current) return
    const baslangic: L.LatLngExpression = ilk ? [ilk.lat, ilk.lon] : [39.0, 35.0]
    const h = L.map(kutu.current, { zoomControl: false, attributionControl: true }).setView(baslangic, ilk ? 15 : 6)
    L.control.zoom({ position: 'topright' }).addTo(h)
    const altliklar: [string, L.TileLayerOptions][] = [
      ['https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }],
      ['https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', { maxZoom: 19, subdomains: 'abc', attribution: '© OpenStreetMap France' }],
      ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: '© Esri · OpenStreetMap' }]
    ]
    let sira = 0
    let hata = 0
    let yuklendi = false
    const kur = (): L.TileLayer => {
      const [url, ayar] = altliklar[sira]
      // Ilk altlik telefondaki karo onbellegiyle (internet yokken de sokaklar gorunur)
      const t = sira === 0 ? new OnbellekliKaro(url, ayar) : L.tileLayer(url, ayar)
      t.on('tileload', () => (yuklendi = true))
      t.on('tileerror', () => {
        // Internet yokken baska altliga gecilmez (onbellekteki karolar kalsin)
        if (!navigator.onLine || yuklendi || ++hata < 4 || sira >= altliklar.length - 1) return
        sira++
        hata = 0
        h.removeLayer(t)
        kur()
      })
      return t.addTo(h)
    }
    kur()
    setTimeout(() => h.invalidateSize(), 300)
    // Ev cevresinin karolari haftada bir arka planda saklanir
    setTimeout(() => void evCevresiniSakla().catch(() => undefined), 5000)
    // Yogun yerde pinler kume olur, ustunde sayi yazar; kumeye dokununca yakinlasir
    kume.current = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 44,
      spiderfyOnMaxZoom: true,
      iconCreateFunction: (c) =>
        L.divIcon({
          className: '',
          iconSize: [36, 36],
          html: `<span style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;background:#d93d20;color:#fff;font:700 13px Inter,sans-serif;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)">${c.getChildCount()}</span>`
        })
    }).addTo(h)
    ust.current = L.layerGroup().addTo(h)
    // Kullanici kaydirinca/yakinlasinca "Bu bolgede ara" (otomatik arama yok)
    // Yalnizca parmakla kaydirma ya da yakinlastirma sayilir (programin setView/fitBounds'u degil)
    let birak = 0
    const elle = () => {
      elleHareket.current = true
      window.clearTimeout(birak)
      birak = window.setTimeout(() => (elleHareket.current = false), 1500)
    }
    h.on('dragstart', elle)
    kutu.current.addEventListener('wheel', elle, { passive: true })
    kutu.current.addEventListener('touchmove', elle, { passive: true })
    h.on('moveend', () => {
      if (elleHareket.current) setBuBolge(true)
    })
    // Program fitBounds/setView yaparken bayrak dusurulur
    harita.current = h
    return () => {
      h.remove()
      harita.current = undefined
    }
  }, [])

  // Gorunen kayitli mekanlar (sehir ve suzgec)
  const sehirler = [...new Set(mekanlar.map((m) => m.sehir.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'))
  const s2 = (x: string) => x.toLocaleLowerCase('tr').trim()
  const gorunen = mekanlar.filter(
    (m) =>
      m.lat !== undefined &&
      m.lon !== undefined &&
      (!sehir || s2(m.sehir) === s2(sehir) || s2(m.ilce) === s2(sehir)) &&
      (suzgec === 'hepsi' ||
        (suzgec === 'istek' && m.gitmekIstiyorum) ||
        (suzgec === 'favori' && m.favori) ||
        (suzgec === 'gittim' && m.gidildi) ||
        (suzgec === 'kampanya' && m.kampanya && Date.now() - m.kampanya.zaman < 7 * 864e5))
  )
  const yersiz = mekanlar.filter((m) => m.lat === undefined || m.lon === undefined).length

  // Liste satirlari: aramanin merkezinden yaricap icindeki kayitlilar + cevredeki yeniler (ayni ad bir kez)
  const satirlar: Satir[] = useMemo(() => {
    const m0 = merkez ?? konum
    const l: Satir[] = []
    for (const m of gorunen) {
      const km = m0 ? mesafeKm(m0, { lat: m.lat!, lon: m.lon! }) : 0
      if (m0 && !sehir && km * 1000 > yaricap) continue
      l.push({ anahtar: `k${m.id}`, ad: m.ad, tur: m.tur, km, lat: m.lat!, lon: m.lon!, kayitli: m })
    }
    if (suzgec === 'hepsi' && !sehir) {
      for (const y of cevre) {
        const ayni = l.find((x) => sade(x.ad) === sade(y.ad) && mesafeKm(x, y) < 0.3)
        if (ayni) {
          if (ayni.acik === undefined) ayni.acik = y.acik
          continue
        }
        l.push({ anahtar: `c${y.lat.toFixed(5)},${y.lon.toFixed(5)}`, ad: y.ad, tur: y.tur, km: m0 ? mesafeKm(m0, y) : y.km, lat: y.lat, lon: y.lon, acik: y.acik, yer: y })
      }
    }
    return l.sort((a, b) => a.km - b.km)
  }, [JSON.stringify(gorunen.map((m) => [m.id, m.gitmekIstiyorum, m.favori, m.gidildi])), cevre, merkez?.lat, merkez?.lon, konum?.lat, yaricap, sehir, suzgec])

  // Pinleri ciz (kayitlilar hemen; cevre gelince eklenir)
  useEffect(() => {
    const h = harita.current
    const g = kume.current
    const u = ust.current
    if (!h || !g || !u) return
    g.clearLayers()
    u.clearLayers()
    const sinir: L.LatLngExpression[] = []
    for (const m of gorunen) {
      const sat = satirlar.find((x) => x.kayitli?.id === m.id)
      const mk = L.marker([m.lat!, m.lon!], { icon: pinIkonu(renk(m), sat?.acik, secili === `k${m.id}`, false), title: m.ad })
      mk.on('click', () => sec(`k${m.id}`))
      g.addLayer(mk)
      sinir.push([m.lat!, m.lon!])
    }
    for (const sat of satirlar.filter((x) => x.yer)) {
      const mk = L.marker([sat.lat, sat.lon], { icon: pinIkonu('#A0603F', sat.acik, secili === sat.anahtar, true), title: sat.ad })
      mk.on('click', () => sec(sat.anahtar))
      g.addLayer(mk)
    }
    const m0 = merkez ?? konum
    if (konum) {
      L.circleMarker([konum.lat, konum.lon], { radius: 9, color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }).bindTooltip('Buradasın').addTo(u)
    }
    if (m0) {
      // 1 km cemberi ince cizgiyle
      L.circle([m0.lat, m0.lon], { radius: 1000, color: '#2563eb', weight: 1, opacity: 0.6, fill: false, dashArray: '4 4', interactive: false }).addTo(u)
    }
    // Sehir secildiyse o sehrin mekanlari gorunsun
    if (sehir && sinir.length) {
      elleHareket.current = false
      h.fitBounds(L.latLngBounds(sinir), { padding: [30, 30], maxZoom: 16 })
    }
  }, [satirlar, secili, konum?.lat, sehir])

  // Merkez ilk kez belli olunca harita oraya
  useEffect(() => {
    const h = harita.current
    if (!h || !merkez || sehir) return
    elleHareket.current = false
    h.setView([merkez.lat, merkez.lon], Math.max(h.getZoom(), 15))
  }, [merkez?.lat, merkez?.lon])

  const sec = (anahtar: string) => {
    setSecili(anahtar)
    setPanel((p) => (p === 'kucuk' ? 'orta' : p))
    setTimeout(() => document.getElementById(`satir-${anahtar}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60)
  }
  const buBolgedeAra = () => {
    const h = harita.current
    if (!h) return
    const c = h.getCenter()
    setBuBolge(false)
    setAdim(0)
    setMerkez({ lat: c.lat, lon: c.lng })
  }
  const gitmekIstiyorum = async (sat: Satir) => {
    if (!sat.yer) return
    setEkleniyor(sat.anahtar)
    const id = await yeriKaydet(sat.yer, konum)
    await lzDb.mekanlar.update(id, { gitmekIstiyorum: true })
    setEkleniyor('')
    setSecili(`k${id}`)
  }

  // Panel surukleme: tutma cubugunu yukari/asagi cek
  const surukle = useRef<{ y: number; p: typeof panel } | null>(null)
  const PANEL_H = { kucuk: '26%', orta: '46%', buyuk: '78%' } as const
  const seciliSatir = satirlar.find((x) => x.anahtar === secili)
  const liste = seciliSatir ? [seciliSatir, ...satirlar.filter((x) => x !== seciliSatir)] : satirlar
  const sonraki = YARICAPLAR[adim + 1]

  return (
    <div className="flex flex-col" style={{ height: 'calc(100dvh - 64px - env(safe-area-inset-bottom))' }}>
      <Header title="Harita" subtitle={`${gorunen.length} kayıtlı mekan${sehir ? ` · ${sehir}` : ''}`} back />
      <div className="relative flex-1 min-h-0">
        {/* Harita ustte tam genislik */}
        <div ref={kutu} className="absolute inset-0 z-0" />
        {/* Harita acilirken bos ekran yerine iskelet pinler */}
        {mekanHam === undefined && (
          <div className="absolute inset-0 z-[400] pointer-events-none" aria-hidden="true">
            {[
              [30, 30],
              [55, 42],
              [42, 60],
              [68, 25],
              [22, 52]
            ].map(([x, y], i) => (
              <span key={i} className="lz-iskelet absolute w-4 h-4 !rounded-full" style={{ left: `${x}%`, top: `${y}%` }} />
            ))}
          </div>
        )}
        {/* Ust bilgi: yukleniyor / son guncelleme / uyari */}
        <div className="absolute top-2 left-2 right-14 z-[500] flex flex-col items-start gap-1.5 pointer-events-none">
          {yukleniyor && (
            <span className="pointer-events-auto inline-flex items-center gap-1.5 text-[12px] font-semibold rounded-full bg-white/95 dark:bg-[#231E18]/95 px-3 py-1.5 shadow">
              <span className="w-3.5 h-3.5 rounded-full border-2 border-lz-600 border-t-transparent animate-spin" /> Çevre yükleniyor…
            </span>
          )}
          {yukleniyor && yavas && (
            <div className="pointer-events-auto rounded-xl bg-amber-50 dark:bg-[#33270f] px-3 py-2 shadow max-w-full">
              <p className="text-[13px] font-semibold text-amber-900 dark:text-amber-200">Çevre yavaş geliyor.</p>
              <p className={`text-[11.5px] ${T_SOLUK}`}>Kayıtlı mekanların ekranda; harita kullanılabilir.</p>
            </div>
          )}
          {!yukleniyor && guncel > 0 && merkez && (
            <span className={`pointer-events-auto text-[12px] rounded-full bg-white/95 dark:bg-[#231E18]/95 px-3 py-1 shadow ${T_SOLUK}`}>
              Son güncelleme {onceYaz(guncel)} ·{' '}
              <button className="text-lz-600 font-semibold underline" onClick={() => void cevreYukle(merkez, yaricap, true)}>
                Yenile
              </button>
            </span>
          )}
          {uyari && (
            <div className="pointer-events-auto rounded-xl bg-amber-50 dark:bg-[#33270f] px-3 py-2 shadow max-w-full">
              <p className="text-[13px] font-semibold text-amber-900 dark:text-amber-200">{uyari}</p>
              <p className={`text-[11.5px] ${T_SOLUK}`}>Kayıtlı mekanların görünmeye devam ediyor.</p>
              {merkez && (
                <button className="text-[12.5px] font-semibold text-lz-600 underline mt-0.5" onClick={() => void cevreYukle(merkez, yaricap, true)}>
                  ↻ Tekrar dene
                </button>
              )}
            </div>
          )}
        </div>
        {/* Kaydirinca ortada "Bu bolgede ara" */}
        {buBolge && (
          <button
            className="absolute z-[500] left-1/2 -translate-x-1/2 top-14 lz-btn-primary !min-h-[48px] !py-2 !px-4 text-[14px] shadow-lg"
            onClick={buBolgedeAra}
          >
            <Icon name="search" className="w-4 h-4" /> Bu bölgede ara
          </button>
        )}

        {/* Liste: alttan surüklenen panel */}
        <div
          className="absolute inset-x-0 bottom-0 z-[600] bg-[#FAF6EC] dark:bg-[#221C15] rounded-t-[22px] shadow-[0_-6px_24px_rgba(0,0,0,0.18)] flex flex-col transition-[height] duration-200"
          style={{ height: PANEL_H[panel] }}
        >
          <div
            className="pt-2 pb-1 flex justify-center cursor-grab touch-none select-none"
            onPointerDown={(e) => {
              surukle.current = { y: e.clientY, p: panel }
              ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
            }}
            onPointerUp={(e) => {
              const s = surukle.current
              surukle.current = null
              if (!s) return
              const dy = e.clientY - s.y
              const sira = ['kucuk', 'orta', 'buyuk'] as const
              const i = sira.indexOf(s.p)
              if (Math.abs(dy) < 8) setPanel(sira[(i + 1) % 3])
              else setPanel(sira[Math.max(0, Math.min(2, i + (dy < 0 ? 1 : -1)))])
            }}
            role="button"
            aria-label="Listeyi büyüt / küçült"
          >
            <span className="w-11 h-1.5 rounded-full bg-[#c4c4c8] dark:bg-[#3A3228]" />
          </div>
          <div className="px-4 pb-2 space-y-2">
            <div className="flex items-center gap-2">
              <span className={`flex-1 text-[13px] font-semibold ${T_BASLIK}`}>
                {satirlar.length} mekan · {yaricap / 1000} km içinde
              </span>
              <select className="lz-input !py-1.5 !min-h-[48px] text-[13px] w-auto max-w-[45%]" value={sehir} onChange={(e) => setSehir(e.target.value)}>
                <option value="">Yakınımdakiler</option>
                {sehirler.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SUZGEC.map(([k, ad]) => (
                <button key={k} className={`lz-chip !min-h-[48px] text-[12.5px] ${suzgec === k ? 'lz-chip-on' : ''}`} onClick={() => setSuzgec(k)}>
                  {ad}
                </button>
              ))}
            </div>
            {(konumMesaj || yersiz > 0) && (
              <p className={`text-[11.5px] ${T_SOLUK}`}>
                {konumMesaj}
                {yersiz > 0 ? ` ${yersiz} mekanın haritadaki yeri bilinmiyor; mekan sayfasındaki “düzelt” ile eklenebilir.` : ''}
              </p>
            )}
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-24 space-y-2">
            {liste.map((s) => (
              <div
                key={s.anahtar}
                id={`satir-${s.anahtar}`}
                className={`lz-card p-3 flex items-center gap-3 ${s.anahtar === secili ? 'ring-2 ring-lz-500' : ''}`}
                onClick={() => {
                  setSecili(s.anahtar)
                  harita.current?.setView([s.lat, s.lon], Math.max(harita.current.getZoom(), 16))
                }}
              >
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: s.kayitli ? renk(s.kayitli) : '#A0603F' }} />
                <div className="flex-1 min-w-0">
                  <div className={`font-semibold text-[14px] leading-snug line-clamp-2 ${T_BASLIK}`}>{s.ad}</div>
                  <div className={`text-[12px] truncate ${T_SOLUK}`}>
                    {[s.tur, s.kayitli ? 'Kayıtlı' : 'Yeni'].filter(Boolean).join(' · ')}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[12px] font-semibold text-lz-600">{yurumeYaz(s.km)}</span>
                    {s.acik !== undefined && (
                      <span className={`text-[10.5px] font-bold px-1.5 rounded text-white ${s.acik ? 'bg-emerald-600' : 'bg-[#4A4239]'}`}>{s.acik ? 'Açık' : 'Kapalı'}</span>
                    )}
                  </div>
                </div>
                {s.kayitli ? (
                  <Link
                    to={`/mekan/${s.kayitli.id}`}
                    className="lz-btn-soft !min-h-[48px] !px-3 text-[13px] flex-shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Aç ›
                  </Link>
                ) : (
                  <button
                    className="lz-btn-primary !min-h-[48px] !px-3 text-[12.5px] flex-shrink-0"
                    disabled={ekleniyor === s.anahtar}
                    onClick={(e) => {
                      e.stopPropagation()
                      void gitmekIstiyorum(s)
                    }}
                  >
                    {ekleniyor === s.anahtar ? 'Ekleniyor…' : '+ Gitmek istiyorum'}
                  </button>
                )}
              </div>
            ))}
            {!liste.length && !yukleniyor && (
              <p className={`text-[13px] text-center py-4 ${T_SOLUK}`}>Bu alanda mekan yok. {sonraki ? 'Daha geniş bakmayı dene.' : ''}</p>
            )}
            {!sehir && merkez && <DahaFazlaGoster simdiKm={yaricap / 1000} kapali={yukleniyor} buyut={() => setAdim(adim + 1)} />}
            {/* Cevremdeki Hype: yakinda cok konusulan, henuz kayitli olmayan yerler (ayri ekran) */}
            <button className="lz-btn-soft w-full text-[14px]" onClick={() => navigate('/cevre-hype')} data-cevre-hype>
              ★ Çevremdeki Hype
            </button>
            {!merkez && (
              <button className="lz-btn-soft w-full text-[14px]" onClick={() => navigate('/mekanlar')}>
                Mekanlarım’a dön
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}


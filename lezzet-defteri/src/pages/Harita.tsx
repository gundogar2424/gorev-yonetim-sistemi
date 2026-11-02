import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { lzDb } from '../db'
import type { LzMekan } from '../types'
import { Header, T_SOLUK } from '../components/ui'
import { konumdanAdres, telefonKonumu, type Konum } from '../lib/mekan'

type Suzgec = 'hepsi' | 'istek' | 'favori' | 'gittim' | 'kampanya'
const SUZGEC: [Suzgec, string][] = [
  ['hepsi', 'Hepsi'],
  ['istek', 'Gitmek istediklerim'],
  ['favori', 'Favoriler'],
  ['gittim', 'Gittiklerim'],
  ['kampanya', 'Kampanyalı']
]
// Nokta rengi: gittim yesil, kampanya mor, gitmek istiyorum kirmizi, digerleri gri
function renk(m: LzMekan): string {
  if (m.gidildi) return '#16a34a'
  if (m.kampanya && Date.now() - m.kampanya.zaman < 7 * 864e5) return '#7c3aed'
  if (m.gitmekIstiyorum || m.favori) return '#d93d20'
  return '#71717a'
}
const kac = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

// HARITA: kayitli mekanlar sehir/ilce secilerek haritada nokta nokta; benim konumum mavi nokta
export default function Harita() {
  const navigate = useNavigate()
  const mekanlar = useLiveQuery(() => lzDb.mekanlar.toArray(), [], [] as LzMekan[]) ?? []
  const [sehir, setSehir] = useState('')
  const [suzgec, setSuzgec] = useState<Suzgec>('hepsi')
  const [konum, setKonum] = useState<Konum>()
  const [mesaj, setMesaj] = useState('Konumun alınıyor…')
  const kutu = useRef<HTMLDivElement>(null)
  const harita = useRef<L.Map>()
  const katman = useRef<L.LayerGroup>()

  // Konum: bulundugum sehir kendiliginden secilir
  useEffect(() => {
    void (async () => {
      try {
        const k = await telefonKonumu(12000)
        setKonum(k)
        setMesaj('')
        const bolge = await konumdanAdres(k)
        const il = bolge.split(',').map((x) => x.trim()).filter(Boolean).pop() ?? ''
        if (il) setSehir((s) => s || il)
      } catch {
        setMesaj('Konum alınamadı; şehir seçerek bakabilirsin.')
      }
    })()
  }, [])

  // Harita bir kez kurulur (ucretsiz CARTO / OpenStreetMap altligi)
  useEffect(() => {
    if (!kutu.current || harita.current) return
    const h = L.map(kutu.current, { zoomControl: true, attributionControl: true }).setView([39.0, 35.0], 6)
    // Harita altligi: biri telefonda acilmazsa (engel / hata) siradakine gecilir
    const altliklar: [string, L.TileLayerOptions][] = [
      ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: '© Esri · OpenStreetMap' }],
      ['https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19, subdomains: 'abcd', attribution: '© OpenStreetMap · © CARTO' }],
      ['https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }]
    ]
    let sira = 0
    let hata = 0
    let yuklendi = false
    const kur = (): L.TileLayer => {
      const [url, ayar] = altliklar[sira]
      const t = L.tileLayer(url, ayar)
      t.on('tileload', () => (yuklendi = true))
      t.on('tileerror', () => {
        if (yuklendi || ++hata < 4 || sira >= altliklar.length - 1) return
        sira++
        hata = 0
        h.removeLayer(t)
        kur()
      })
      return t.addTo(h)
    }
    kur()
    // Sayfa yerlesince boyut yeniden olculur (yoksa harita kismen gri kalir)
    setTimeout(() => h.invalidateSize(), 300)
    katman.current = L.layerGroup().addTo(h)
    harita.current = h
    // Noktadaki "Aç" baglantisi uygulama icinde mekan sayfasina gider
    h.on('popupopen', (e) => {
      const a = (e.popup.getElement() as HTMLElement | undefined)?.querySelector('a[data-id]')
      a?.addEventListener('click', (ev) => {
        ev.preventDefault()
        navigate(`/mekan/${(a as HTMLElement).dataset.id}`)
      })
    })
    return () => {
      h.remove()
      harita.current = undefined
    }
  }, [])

  const sade = (x: string) => x.toLocaleLowerCase('tr').trim()
  const sehirler = [...new Set(mekanlar.map((m) => m.sehir.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'))
  const gorunen = mekanlar.filter(
    (m) =>
      m.lat !== undefined &&
      m.lon !== undefined &&
      (!sehir || sade(m.sehir) === sade(sehir) || sade(m.ilce) === sade(sehir)) &&
      (suzgec === 'hepsi' ||
        (suzgec === 'istek' && m.gitmekIstiyorum) ||
        (suzgec === 'favori' && m.favori) ||
        (suzgec === 'gittim' && m.gidildi) ||
        (suzgec === 'kampanya' && m.kampanya && Date.now() - m.kampanya.zaman < 7 * 864e5))
  )
  const yersiz = mekanlar.filter((m) => (m.lat === undefined || m.lon === undefined) && (!sehir || sade(m.sehir) === sade(sehir))).length

  // Noktalari ciz ve hepsini gosterecek sekilde yaklas
  useEffect(() => {
    const h = harita.current
    const g = katman.current
    if (!h || !g) return
    g.clearLayers()
    const sinir: L.LatLngExpression[] = []
    for (const m of gorunen) {
      const p: L.LatLngExpression = [m.lat!, m.lon!]
      sinir.push(p)
      L.circleMarker(p, { radius: 8, color: '#fff', weight: 2, fillColor: renk(m), fillOpacity: 1 })
        .bindPopup(
          `<b>${kac(m.ad)}</b><br><span style="color:#71717a">${kac([m.tur, m.ilce].filter(Boolean).join(' · '))}</span>` +
            (m.kampanya ? `<br><span style="color:#7c3aed">${kac(m.kampanya.ozet.slice(0, 80))}</span>` : '') +
            `<br><a href="#" data-id="${m.id}" style="color:#d93d20;font-weight:600">Mekanı aç ›</a>`
        )
        .addTo(g)
    }
    if (konum) {
      L.circleMarker([konum.lat, konum.lon], { radius: 9, color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }).bindPopup('Buradasın').addTo(g)
      if (!sehir || !sinir.length) sinir.push([konum.lat, konum.lon])
    }
    if (sinir.length === 1) h.setView(sinir[0], 15)
    else if (sinir.length) h.fitBounds(L.latLngBounds(sinir), { padding: [30, 30], maxZoom: 16 })
  }, [JSON.stringify(gorunen.map((m) => m.id)), konum?.lat, sehir])

  return (
    <div className="flex flex-col" style={{ height: 'calc(100dvh - 72px)' }}>
      <Header title="Harita" subtitle={`${gorunen.length} mekan${sehir ? ` · ${sehir}` : ''}`} back />
      <div className="px-4 pb-2 space-y-2">
        <select className="lz-input py-2 text-[14px] w-full" value={sehir} onChange={(e) => setSehir(e.target.value)}>
          <option value="">Tüm şehirler</option>
          {sehir && !sehirler.includes(sehir) && <option value={sehir}>{sehir}</option>}
          {sehirler.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4">
          {SUZGEC.map(([k, ad]) => (
            <button key={k} className={`lz-chip whitespace-nowrap text-[12.5px] ${suzgec === k ? 'lz-chip-on' : ''}`} onClick={() => setSuzgec(k)}>
              {ad}
            </button>
          ))}
        </div>
        <div className={`flex gap-3 flex-wrap text-[11.5px] ${T_SOLUK}`}>
          {[
            ['#2563eb', 'Ben'],
            ['#d93d20', 'Gitmek istediğim / favori'],
            ['#16a34a', 'Gittim'],
            ['#7c3aed', 'Kampanyalı'],
            ['#71717a', 'Diğer']
          ].map(([c, ad]) => (
            <span key={ad} className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: c }} /> {ad}
            </span>
          ))}
        </div>
        {(mesaj || yersiz > 0) && (
          <p className={`text-[11.5px] ${T_SOLUK}`}>
            {mesaj}
            {yersiz > 0 ? ` ${yersiz} mekanın haritadaki yeri bilinmiyor; mekan sayfasındaki “düzelt” ile eklenebilir.` : ''}
          </p>
        )}
      </div>
      <div ref={kutu} className="flex-1 mx-4 mb-3 rounded-3xl overflow-hidden border border-[#e4e3e0] dark:border-[#2e2e33] z-0" />
    </div>
  )
}

// Harita gorunumu (Leaflet). Altlik: CARTO (OpenStreetMap verisi; acik ve
// koyu temasi var). Her yer kategorisinin simgesiyle bir igne olarak cizilir;
// igneye dokununca ayrinti ekrani acilir.
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '../etraf.css'
import { CATEGORY_BY_ID } from '../lib/categories'
import type { LatLng, Place } from '../lib/types'

interface Props {
  places: Place[]
  center: LatLng | null
  radiusM: number
  isFav: (p: Place) => boolean
  onOpen: (p: Place) => void
}

const TILES = {
  light: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
}
const ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © <a href="https://carto.com/attributions">CARTO</a>'

function pinIcon(p: Place, fav: boolean): L.DivIcon {
  const emoji = CATEGORY_BY_ID[p.category].emoji
  return L.divIcon({
    className: '', // Leaflet'in varsayilan beyaz kutusu olmasin
    html:
      `<div class="et-pin${fav ? ' et-pin-fav' : ''}"><span>${emoji}</span></div>` +
      (fav ? '<div class="et-pin-star">★</div>' : ''),
    iconSize: [36, 44],
    iconAnchor: [18, 42]
  })
}

const meIcon = L.divIcon({ className: '', html: '<div class="et-me"></div>', iconSize: [20, 20], iconAnchor: [10, 10] })

export default function MapView({ places, center, radiusM, isFav, onOpen }: Props) {
  const elRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const onOpenRef = useRef(onOpen)
  onOpenRef.current = onOpen

  // Haritayi bir kez kur
  useEffect(() => {
    if (!elRef.current) return
    const dark = document.documentElement.classList.contains('dark')
    const map = L.map(elRef.current, { zoomControl: false, attributionControl: true })
    L.tileLayer(dark ? TILES.dark : TILES.light, { attribution: ATTRIBUTION, maxZoom: 20, subdomains: 'abcd' }).addTo(map)
    L.control.zoom({ position: 'bottomright' }).addTo(map)
    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Igneleri ve konumu ciz; gorunumu hepsini kapsayacak sekilde ayarla
  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return
    layer.clearLayers()
    const bounds = L.latLngBounds([])
    if (center) {
      L.circle([center.lat, center.lng], {
        radius: radiusM,
        color: '#d94424',
        weight: 1.5,
        opacity: 0.5,
        fillOpacity: 0.04,
        interactive: false
      }).addTo(layer)
      L.marker([center.lat, center.lng], { icon: meIcon, interactive: false, zIndexOffset: 1000 }).addTo(layer)
      bounds.extend([center.lat, center.lng])
    }
    for (const p of places) {
      const fav = isFav(p)
      L.marker([p.lat, p.lng], { icon: pinIcon(p, fav), title: p.name, zIndexOffset: fav ? 500 : 0 })
        .on('click', () => onOpenRef.current(p))
        .addTo(layer)
      bounds.extend([p.lat, p.lng])
    }
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [36, 36], maxZoom: 17 })
    else map.setView([39.0, 35.0], 5) // hicbir sey yoksa Turkiye
  }, [places, center, radiusM, isFav])

  return (
    <div
      ref={elRef}
      className="et-map relative z-0 isolate w-full rounded-2xl overflow-hidden border border-slate-200/70 dark:border-[#2f2926]"
      style={{ height: 'max(360px, calc(100dvh - 330px))' }}
    />
  )
}

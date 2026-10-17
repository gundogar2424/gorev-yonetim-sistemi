import { useEffect, useRef, useState } from 'react'
import { Sheet, T_SOLUK } from './ui'

const W = 300 // kirpma alani genisligi (px)

// KARE KIRPMA: secilen resim (ör. ekran goruntusu) parmakla kaydirilir, cubukla yakinlastirilir;
// cercevenin icindeki kisim (oran: genislik/yukseklik) 800 px genislikte kaydedilir.
export default function KirpSheet({ src, oran = 1, onClose, onKaydet }: { src: string; oran?: number; onClose: () => void; onKaydet: (dataUrl: string) => void }) {
  const H = Math.round(W / oran)
  const [img, setImg] = useState<HTMLImageElement>()
  const [z, setZ] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const surukle = useRef<{ x: number; y: number; px: number; py: number } | null>(null)

  useEffect(() => {
    if (!src) return
    const i = new Image()
    i.onload = () => {
      setImg(i)
      setZ(1)
      const b = Math.max(W / i.width, H / i.height)
      // Ekran goruntusunde yuz genelde ust-ortada: baslangic yatayda orta, dikeyde uste yakin
      setPos({ x: (W - i.width * b) / 2, y: Math.max(H - i.height * b, 0) })
    }
    i.src = src
  }, [src])

  if (!src) return null
  const b = img ? Math.max(W / img.width, H / img.height) : 1
  const dw = (img?.width ?? W) * b * z
  const dh = (img?.height ?? H) * b * z
  const sinirla = (p: { x: number; y: number }, w = dw, h = dh) => ({ x: Math.min(0, Math.max(W - w, p.x)), y: Math.min(0, Math.max(H - h, p.y)) })

  const yakinlas = (yeni: number) => {
    // Merkez sabit kalacak sekilde yakinlastir
    const k = yeni / z
    const cx = W / 2
    const cy = H / 2
    setPos(sinirla({ x: cx - (cx - pos.x) * k, y: cy - (cy - pos.y) * k }, dw * k, dh * k))
    setZ(yeni)
  }
  const kaydet = () => {
    if (!img) return
    const c = document.createElement('canvas')
    c.width = 800
    c.height = Math.round(800 / oran)
    const r = 800 / W
    c.getContext('2d')!.drawImage(img, pos.x * r, pos.y * r, dw * r, dh * r)
    onKaydet(c.toDataURL('image/jpeg', 0.86))
  }

  return (
    <Sheet open onClose={onClose} title="Fotoğrafı ayarla">
      <div className="space-y-4 pb-2">
        <div
          className="relative mx-auto overflow-hidden rounded-2xl bg-black touch-none select-none"
          style={{ width: W, height: H }}
          onPointerDown={(e) => {
            ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
            surukle.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y }
          }}
          onPointerMove={(e) => {
            const s = surukle.current
            if (s) setPos(sinirla({ x: s.px + e.clientX - s.x, y: s.py + e.clientY - s.y }))
          }}
          onPointerUp={() => (surukle.current = null)}
        >
          {img && <img src={src} alt="" draggable={false} className="absolute max-w-none" style={{ left: pos.x, top: pos.y, width: dw, height: dh }} />}
          {/* Kare cerceve (avatarla ayni koseler) */}
          <div className="absolute inset-0 pointer-events-none rounded-xl border-2 border-white/90" style={{ boxShadow: '0 0 0 999px rgba(0,0,0,0.35)' }} />
        </div>
        <p className={`text-center text-[12.5px] ${T_SOLUK}`}>Parmağınla kaydır, görünmesini istediğin kısmı çerçeveye getir</p>
        <label className="flex items-center gap-3 px-2">
          <span className={`text-[13px] ${T_SOLUK}`}>Yakınlaştır</span>
          <input type="range" min={1} max={5} step={0.05} value={z} onChange={(e) => yakinlas(Number(e.target.value))} className="flex-1 accent-[#d93d20]" />
        </label>
        <button className="lz-btn-primary w-full" disabled={!img} onClick={kaydet}>
          Kaydet
        </button>
      </div>
    </Sheet>
  )
}

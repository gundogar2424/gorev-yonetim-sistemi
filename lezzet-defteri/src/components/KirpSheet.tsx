import { useEffect, useRef, useState } from 'react'
import { Sheet, T_SOLUK } from './ui'

const S = 280 // kirpma alani (px)

// YUVARLAK KIRPMA: secilen resim (ör. ekran goruntusu) parmakla kaydirilir, cubukla yakinlastirilir;
// yuvarlagin icindeki kisim 400x400 olarak kaydedilir.
export default function KirpSheet({ src, onClose, onKaydet }: { src: string; onClose: () => void; onKaydet: (dataUrl: string) => void }) {
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
      const b = S / Math.min(i.width, i.height)
      // Ekran goruntusunde yuz genelde ust-ortada: baslangic yatayda orta, dikeyde uste yakin
      setPos({ x: (S - i.width * b) / 2, y: Math.max(S - i.height * b, -i.height * b * 0.15) })
    }
    i.src = src
  }, [src])

  if (!src) return null
  const b = img ? S / Math.min(img.width, img.height) : 1
  const dw = (img?.width ?? S) * b * z
  const dh = (img?.height ?? S) * b * z
  const sinirla = (p: { x: number; y: number }, w = dw, h = dh) => ({ x: Math.min(0, Math.max(S - w, p.x)), y: Math.min(0, Math.max(S - h, p.y)) })

  const yakinlas = (yeni: number) => {
    // Merkez sabit kalacak sekilde yakinlastir
    const k = yeni / z
    const cx = S / 2
    setPos(sinirla({ x: cx - (cx - pos.x) * k, y: cx - (cx - pos.y) * k }, dw * k, dh * k))
    setZ(yeni)
  }
  const kaydet = () => {
    if (!img) return
    const c = document.createElement('canvas')
    c.width = c.height = 400
    const r = 400 / S
    c.getContext('2d')!.drawImage(img, pos.x * r, pos.y * r, dw * r, dh * r)
    onKaydet(c.toDataURL('image/jpeg', 0.86))
  }

  return (
    <Sheet open onClose={onClose} title="Fotoğrafı ayarla">
      <div className="space-y-4 pb-2">
        <div
          className="relative mx-auto overflow-hidden rounded-2xl bg-black touch-none select-none"
          style={{ width: S, height: S }}
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
          {/* Yuvarlak pencere: disi karartilir */}
          <div className="absolute inset-0 pointer-events-none rounded-full" style={{ boxShadow: '0 0 0 999px rgba(0,0,0,0.55)' }} />
          <div className="absolute inset-0 pointer-events-none rounded-full border-2 border-white/80" />
        </div>
        <p className={`text-center text-[12.5px] ${T_SOLUK}`}>Parmağınla kaydır, yüzü yuvarlağın içine getir</p>
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

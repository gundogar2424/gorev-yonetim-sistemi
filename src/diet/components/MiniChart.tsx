// Hafif, kutuphanesiz SVG cizgi grafigi. Tarihe gore degerleri cizer.
interface Point {
  label: string // x ekseni etiketi (orn. tarih)
  value: number
}

interface Props {
  points: Point[]
  color?: string // cizgi rengi
  unit?: string // deger birimi (orn. "kg")
  height?: number
}

// Catmull-Rom -> kubik bezier: kirik/sivri kose yerine yumusak egri cizer.
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return pts.length ? `M ${pts[0].x} ${pts[0].y}` : ''
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
  const t = 0.16 // yumusaklik (0 = duz cizgi)
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] || p2
    const c1x = p1.x + (p2.x - p0.x) * t
    const c1y = p1.y + (p2.y - p0.y) * t
    const c2x = p2.x - (p3.x - p1.x) * t
    const c2y = p2.y - (p3.y - p1.y) * t
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }
  return d
}

export default function MiniChart({ points, color = '#059669', unit = '', height = 180 }: Props) {
  if (points.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-6">Henüz veri yok.</p>
  }
  if (points.length === 1) {
    return (
      <div className="text-center py-6">
        <p className="text-3xl font-extrabold" style={{ color }}>
          {points[0].value}
          {unit && <span className="text-base font-semibold text-slate-400"> {unit}</span>}
        </p>
        <p className="text-xs text-slate-400 mt-1">{points[0].label}</p>
        <p className="text-xs text-slate-400">Grafik için en az 2 ölçüm gerekir.</p>
      </div>
    )
  }

  const W = 320
  const H = height
  const padL = 40
  const padR = 14
  const padT = 22 // deger etiketleri sigsin
  const padB = 28

  const values = points.map((p) => p.value)
  const rawMin = Math.min(...values)
  const rawMax = Math.max(...values)

  // Kucuk degisimleri ABARTMA: minimum bir gorus araligi uygula, sonra ust/alt
  // nefes payi birak. Boylece 36.0 -> 36.5 gibi ufak fark sivri tepe olmaz.
  let min = rawMin
  let max = rawMax
  const minSpan = Math.max(Math.abs(rawMax) * 0.06, 1) // en az %6 ya da 1 birim
  if (max - min < minSpan) {
    const mid = (min + max) / 2
    min = mid - minSpan / 2
    max = mid + minSpan / 2
  }
  const breathe = (max - min) * 0.15
  min -= breathe
  max += breathe
  const range = max - min || 1

  const innerW = W - padL - padR
  const innerH = H - padT - padB

  const x = (i: number) => padL + (innerW * i) / (points.length - 1)
  const y = (v: number) => padT + innerH - (innerH * (v - min)) / range

  const coords = points.map((p, i) => ({ x: x(i), y: y(p.value) }))
  const linePath = smoothPath(coords)
  const areaPath = `${linePath} L ${x(points.length - 1).toFixed(1)} ${padT + innerH} L ${x(0).toFixed(1)} ${padT + innerH} Z`

  // Ondalik: kucuk araliklarda 1 hane (kilo/kol), buyukte 0 (seker/tansiyon)
  const dec = rawMax - rawMin < 3 ? 1 : 0
  const fmt = (v: number) => v.toFixed(dec)

  // x ekseninde en fazla ~5 etiket goster
  const step = Math.ceil(points.length / 5)
  // deger etiketi: az noktada hepsini, cokta sadece secili x'lerde goster
  const showVal = (i: number) => points.length <= 8 || i % step === 0 || i === points.length - 1

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }}>
      {/* yatay yardimci cizgiler + min/orta/max etiketleri */}
      {[0, 0.5, 1].map((t) => {
        const yy = padT + innerH - innerH * t
        const val = fmt(min + range * t)
        return (
          <g key={t}>
            <line x1={padL} y1={yy} x2={W - padR} y2={yy} stroke="#e2e8f0" strokeWidth="1" />
            <text x={padL - 6} y={yy + 4} textAnchor="end" fontSize="11" fill="#94a3b8">
              {val}
            </text>
          </g>
        )
      })}

      <path d={areaPath} fill={color} opacity="0.12" />
      <path d={linePath} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />

      {coords.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r="3.5" fill="#fff" stroke={color} strokeWidth="2.5" />
      ))}

      {/* nokta uzerinde deger — okunakli olsun diye beyaz haleli */}
      {coords.map((c, i) => {
        if (!showVal(i)) return null
        const ty = c.y < padT + 16 ? c.y + 16 : c.y - 9
        return (
          <text
            key={i}
            x={c.x}
            y={ty}
            textAnchor="middle"
            fontSize="11"
            fontWeight="700"
            fill={color}
            stroke="#fff"
            strokeWidth="3"
            paintOrder="stroke"
          >
            {fmt(points[i].value)}
          </text>
        )
      })}

      {points.map((p, i) =>
        i % step === 0 || i === points.length - 1 ? (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="#94a3b8">
            {p.label}
          </text>
        ) : null
      )}
    </svg>
  )
}

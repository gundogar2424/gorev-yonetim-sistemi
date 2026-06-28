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

export default function MiniChart({ points, color = '#059669', unit = '', height = 160 }: Props) {
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
  const padL = 36
  const padR = 12
  const padT = 12
  const padB = 26

  const values = points.map((p) => p.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const innerW = W - padL - padR
  const innerH = H - padT - padB

  const x = (i: number) => padL + (innerW * i) / (points.length - 1)
  const y = (v: number) => padT + innerH - (innerH * (v - min)) / range

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L ${x(points.length - 1).toFixed(1)} ${padT + innerH} L ${x(0).toFixed(1)} ${padT + innerH} Z`

  // x ekseninde en fazla ~5 etiket goster
  const step = Math.ceil(points.length / 5)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }}>
      {/* yatay yardimci cizgiler + min/orta/max etiketleri */}
      {[0, 0.5, 1].map((t) => {
        const yy = padT + innerH - innerH * t
        const val = (min + range * t).toFixed(max - min < 5 ? 1 : 0)
        return (
          <g key={t}>
            <line x1={padL} y1={yy} x2={W - padR} y2={yy} stroke="#e2e8f0" strokeWidth="1" />
            <text x={padL - 4} y={yy + 3} textAnchor="end" fontSize="9" fill="#94a3b8">
              {val}
            </text>
          </g>
        )
      })}

      <path d={areaPath} fill={color} opacity="0.12" />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

      {points.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.value)} r="3" fill={color} />
      ))}

      {points.map((p, i) =>
        i % step === 0 || i === points.length - 1 ? (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="9" fill="#94a3b8">
            {p.label}
          </text>
        ) : null
      )}
    </svg>
  )
}

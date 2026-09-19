// Basit SVG cizgi grafigi (kutuphane yok). Degerler eski -> yeni.
export default function LineChart({ values, labels, unit = '', ref: refLine }: { values: number[]; labels?: string[]; unit?: string; ref?: number }) {
  const W = 320
  const H = 140
  const P = { l: 34, r: 10, t: 12, b: 24 }
  if (values.length === 0) return null
  const max = Math.max(...values, refLine ?? 0, 1)
  const min = 0
  const iw = W - P.l - P.r
  const ih = H - P.t - P.b
  const x = (i: number) => P.l + (values.length === 1 ? iw / 2 : (i / (values.length - 1)) * iw)
  const y = (v: number) => P.t + ih - ((v - min) / (max - min)) * ih
  const d = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const ticks = [0, max / 2, max]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Grafik">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="currentColor" strokeOpacity={0.12} />
          <text x={P.l - 6} y={y(t) + 4} fontSize={10} textAnchor="end" fill="currentColor" fillOpacity={0.55}>
            {Math.round(t)}
            {unit}
          </text>
        </g>
      ))}
      {refLine != null && <line x1={P.l} x2={W - P.r} y1={y(refLine)} y2={y(refLine)} stroke="#c9560c" strokeOpacity={0.5} strokeDasharray="4 4" />}
      <path d={d} fill="none" stroke="#c9560c" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {values.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r={3.5} fill="#c9560c" />
      ))}
      {labels &&
        labels.map((l, i) =>
          i === 0 || i === labels.length - 1 || (labels.length > 6 && i % Math.ceil(labels.length / 4) === 0) ? (
            <text key={i} x={x(i)} y={H - 6} fontSize={10} textAnchor="middle" fill="currentColor" fillOpacity={0.55}>
              {l}
            </text>
          ) : null
        )}
    </svg>
  )
}

import { POINTS } from '../lib/content'

interface Props {
  active?: string // vurgulanan nokta id'si
  beat?: number // her vurusta degisir -> nokta "atar"
  onSelect?: (id: string) => void
  className?: string
}

// Bas + ust govde cizimi; 8 dokunma noktasi uzerinde isaretli. Sade cizgi
// (yuz detayi az) ki nokta hemen bulunsun. viewBox 0 0 300 360.
export default function BodyMap({ active, beat = 0, onSelect, className }: Props) {
  return (
    <svg viewBox="0 0 300 360" className={className} role="img" aria-label="Dokunma noktaları">
      <g fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 dark:text-[#5f7a78]">
        {/* bas */}
        <ellipse cx="150" cy="112" rx="62" ry="80" />
        {/* kaslar */}
        <path d="M112 90 q16 -10 34 -2" />
        <path d="M188 90 q-16 -10 -34 -2" />
        {/* gozler */}
        <path d="M108 108 q18 -12 36 0 q-18 12 -36 0z" />
        <path d="M156 108 q18 -12 36 0 q-18 12 -36 0z" />
        {/* burun */}
        <path d="M150 112 v26 q-8 6 0 8 q8 -2 0 -8" />
        {/* agiz */}
        <path d="M134 162 q16 10 32 0" />
        {/* boyun */}
        <path d="M126 186 v26" />
        <path d="M174 186 v26" />
        {/* omuzlar + govde */}
        <path d="M126 212 q-40 6 -70 30 q-12 16 -14 60 v58" />
        <path d="M174 212 q40 6 70 30 q12 16 14 60 v58" />
        {/* kopruculuk kemikleri */}
        <path d="M150 226 q-22 -4 -50 8" />
        <path d="M150 226 q22 -4 50 8" />
        {/* kol (sol taraf, koltuk alti gorunsun) */}
        <path d="M56 242 q-26 40 -20 118" />
        <path d="M92 258 q-14 40 -8 100" />
      </g>
      {POINTS.map((p) => {
        const on = p.id === active
        return (
          <g key={p.id} onClick={onSelect ? () => onSelect(p.id) : undefined} style={{ cursor: onSelect ? 'pointer' : 'default' }}>
            {on && <circle cx={p.cx} cy={p.cy} r="14" className="eft-ring fill-eft-500/40" />}
            <circle
              key={on ? `b${beat}` : 'off'}
              cx={p.cx}
              cy={p.cy}
              r={on ? 12 : 8}
              className={on ? 'eft-beat fill-eft-600 stroke-white' : 'fill-white dark:fill-[#172625] stroke-eft-500'}
              strokeWidth={on ? 3 : 2.5}
            />
            {onSelect && (
              // dokunma alani buyuk olsun
              <circle cx={p.cx} cy={p.cy} r="24" fill="transparent" />
            )}
          </g>
        )
      })}
    </svg>
  )
}

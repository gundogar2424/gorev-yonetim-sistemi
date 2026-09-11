interface Props {
  beat?: number
  className?: string
}

// Karate noktasi: elin dis kenari (serce parmak alti). Sol el, avuc ici
// izleyene donuk; dis kenar sagda gorunur. viewBox 0 0 300 300.
export default function HandMap({ beat = 0, className }: Props) {
  const cx = 214
  const cy = 196
  return (
    <svg viewBox="0 0 300 300" className={className} role="img" aria-label="Karate noktası">
      <g fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 dark:text-[#5f7a78]">
        {/* avuc */}
        <path d="M96 150 v90 q0 40 46 44 h40 q34 0 38 -34 v-84" />
        {/* parmaklar (isaret -> serce) */}
        <path d="M96 150 v-70 q0 -14 14 -14 q14 0 14 14 v70" />
        <path d="M124 150 v-92 q0 -14 14 -14 q14 0 14 14 v92" />
        <path d="M152 150 v-84 q0 -14 14 -14 q14 0 14 14 v84" />
        <path d="M180 166 v-58 q0 -14 14 -14 q14 0 14 14 v58" />
        {/* basparmak */}
        <path d="M96 180 l-40 -30 q-14 -12 -2 -24 q12 -10 26 2 l40 32" />
      </g>
      <circle cx={cx} cy={cy} r="16" className="eft-ring fill-eft-500/40" />
      <circle key={`b${beat}`} cx={cx} cy={cy} r="13" className="eft-beat fill-eft-600 stroke-white" strokeWidth={3} />
    </svg>
  )
}

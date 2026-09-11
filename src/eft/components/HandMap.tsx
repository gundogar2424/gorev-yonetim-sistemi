interface Props {
  beat?: number
  className?: string
}

// Karate noktasi: elin dis kenari (serce parmak alti). Sol el, avuc ici
// izleyene donuk; dis kenar sagda gorunur. Dolgulu, hafif golgeli cizim.
// viewBox 0 0 300 300.
export default function HandMap({ beat = 0, className }: Props) {
  const cx = 232
  const cy = 200
  return (
    <svg viewBox="0 0 300 300" className={className} role="img" aria-label="Karate noktası">
      <defs>
        <linearGradient id="eftSkinHand" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="[stop-color:#f4f7f7] dark:[stop-color:#27393c]" />
          <stop offset="1" className="[stop-color:#e2eaea] dark:[stop-color:#1c2c2e]" />
        </linearGradient>
        <filter id="eftShadowHand" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#0b3b3a" floodOpacity="0.28" />
        </filter>
      </defs>
      <g fill="url(#eftSkinHand)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" className="stroke-[#c9d4d4] dark:stroke-[#3d5654]">
        {/* parmaklar (alt uclari avucun altinda kalir) */}
        <path d="M100 170 L100 74 C100 63 108 56 117 56 C126 56 134 63 134 74 L134 170 Z" />
        <path d="M136 170 L136 56 C136 45 144 38 153 38 C162 38 170 45 170 56 L170 170 Z" />
        <path d="M172 170 L172 68 C172 57 180 50 189 50 C198 50 206 57 206 68 L206 170 Z" />
        <path d="M208 176 L208 96 C208 86 215 79 223 79 C231 79 238 86 238 96 L238 176 Z" />
        {/* basparmak */}
        <path d="M104 206 C84 194 62 170 56 144 C53 128 64 116 78 121 C90 126 100 146 106 168 Z" />
        {/* avuc: ust kenar parmak diplerini izler */}
        <path d="M100 158 C110 150 126 150 136 154 C146 150 162 150 172 154 C182 150 198 150 208 156 C218 152 230 152 238 158 L238 232 C238 262 220 282 190 282 L156 282 C122 282 100 262 100 232 Z" />
      </g>
      {/* avuc cizgileri */}
      <g fill="none" strokeWidth={2} strokeLinecap="round" className="stroke-[#c9d4d4] dark:stroke-[#3d5654]">
        <path d="M118 192 C140 202 160 206 190 198" />
        <path d="M124 216 C150 228 176 230 208 222" />
      </g>
      {/* karate noktasi */}
      <circle cx={cx} cy={cy} r="18" className="eft-ring fill-eft-500/40" />
      <g filter="url(#eftShadowHand)">
        <circle key={`b${beat}`} cx={cx} cy={cy} r="14" strokeWidth={3} className="eft-beat fill-eft-600 stroke-white" />
      </g>
    </svg>
  )
}

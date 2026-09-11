import { POINTS } from '../lib/content'

interface Props {
  active?: string // vurgulanan nokta id'si
  beat?: number // her vurusta degisir -> nokta "atar"
  onSelect?: (id: string) => void
  className?: string
}

// Manken: bas + boyun + omuzlar + ust govde, dolgulu ve hafif golgeli.
// 8 dokunma noktasi numarali daireler; aktif olan buyur ve halka yayar.
// viewBox 0 0 300 360. Renkler acik/koyu temaya gore siniflarla degisir.
export default function BodyMap({ active, beat = 0, onSelect, className }: Props) {
  return (
    <svg viewBox="0 0 300 360" className={className} role="img" aria-label="Dokunma noktaları">
      <defs>
        <linearGradient id="eftSkin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="[stop-color:#f4f7f7] dark:[stop-color:#27393c]" />
          <stop offset="1" className="[stop-color:#e2eaea] dark:[stop-color:#1c2c2e]" />
        </linearGradient>
        <filter id="eftShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#0b3b3a" floodOpacity="0.28" />
        </filter>
      </defs>

      {/* beden */}
      <g fill="url(#eftSkin)" strokeWidth={2} strokeLinejoin="round" className="stroke-[#c9d4d4] dark:stroke-[#3d5654]">
        {/* kollar */}
        <path d="M88 246 C68 246 54 260 49 282 C45 306 44 334 46 360 L76 360 C74 332 75 302 82 272 Z" />
        <path d="M212 246 C232 246 246 260 251 282 C255 306 256 334 254 360 L224 360 C226 332 225 302 218 272 Z" />
        {/* boyun */}
        <path d="M131 172 C133 194 130 208 126 220 L174 220 C170 208 167 194 169 172 Z" />
        {/* govde */}
        <path d="M126 220 C104 224 90 234 84 248 C78 262 76 296 78 360 L222 360 C224 296 222 262 216 248 C210 234 196 224 174 220 Z" />
        {/* kulaklar */}
        <ellipse cx="93" cy="112" rx="7" ry="12" />
        <ellipse cx="207" cy="112" rx="7" ry="12" />
        {/* bas */}
        <path d="M150 34 C184 34 206 64 206 104 C206 138 194 164 176 180 C166 189 158 194 150 194 C142 194 134 189 124 180 C106 164 94 138 94 104 C94 64 116 34 150 34 Z" />
      </g>

      {/* yuz hatlari + kopruculuk kemikleri */}
      <g fill="none" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="stroke-[#9fb0b0] dark:stroke-[#5f7a78]">
        <path d="M113 99 C121 91 135 91 142 97" />
        <path d="M187 99 C179 91 165 91 158 97" />
        <path d="M115 113 C121 106 133 106 139 113 C133 119 121 119 115 113 Z" />
        <path d="M185 113 C179 106 167 106 161 113 C167 119 179 119 185 113 Z" />
        <path d="M150 122 C148 132 145 140 142 146 C146 151 154 151 158 146 C155 140 152 132 150 122" />
        <path d="M138 168 C144 173 156 173 162 168" />
        <path d="M150 234 C138 230 118 234 104 244" />
        <path d="M150 234 C162 230 182 234 196 244" />
      </g>
      <circle cx="127" cy="113" r="2.6" className="fill-[#9fb0b0] dark:fill-[#5f7a78]" />
      <circle cx="173" cy="113" r="2.6" className="fill-[#9fb0b0] dark:fill-[#5f7a78]" />

      {/* noktalar */}
      <g fontFamily="system-ui, sans-serif" fontWeight={700} textAnchor="middle">
        {POINTS.map((p, i) => {
          const on = p.id === active
          return (
            <g key={p.id} onClick={onSelect ? () => onSelect(p.id) : undefined} style={{ cursor: onSelect ? 'pointer' : 'default' }}>
              {on && <circle cx={p.cx} cy={p.cy} r="16" className="eft-ring fill-eft-500/40" />}
              <g filter="url(#eftShadow)">
                <circle
                  key={on ? `b${beat}` : 'off'}
                  cx={p.cx}
                  cy={p.cy}
                  r={on ? 14 : 10}
                  strokeWidth={on ? 3 : 2.5}
                  className={on ? 'eft-beat fill-eft-600 stroke-white' : 'fill-white dark:fill-[#172625] stroke-eft-500'}
                />
              </g>
              <text
                x={p.cx}
                y={p.cy + (on ? 4.2 : 3.6)}
                fontSize={on ? 12 : 10}
                className={on ? 'fill-white' : 'fill-eft-700 dark:fill-eft-300'}
                style={{ pointerEvents: 'none' }}
              >
                {i + 1}
              </text>
              {onSelect && <circle cx={p.cx} cy={p.cy} r="24" fill="transparent" />}
            </g>
          )
        })}
      </g>
    </svg>
  )
}

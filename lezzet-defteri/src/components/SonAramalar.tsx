import { useState } from 'react'
import { sonAramaSil, sonAramalar } from '../lib/arama'
import { T_SOLUK } from './ui'

// Arama kutusu bosken ve odaktayken son arananlar: tek dokunusla tekrar ara
export function SonAramalar({ tur, sec }: { tur: string; sec: (q: string) => void }) {
  const [liste, setListe] = useState(sonAramalar(tur))
  if (!liste.length) return null
  return (
    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
      <span className={`text-[12px] flex-shrink-0 ${T_SOLUK}`}>Son aranan:</span>
      {liste.map((x) => (
        <button key={x} className="lz-chip" onMouseDown={(e) => e.preventDefault()} onClick={() => sec(x)}>
          {x}
        </button>
      ))}
      <button
        className={`text-[12px] underline flex-shrink-0 min-h-[48px] px-1 ${T_SOLUK}`}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          sonAramaSil(tur)
          setListe([])
        }}
      >
        Temizle
      </button>
    </div>
  )
}

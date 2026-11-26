import type { ReactNode } from 'react'
import { ppModAdi, sureYazi, type PpAdim } from '../lib/pisirici'

// PILAV PISIRICI gorsel parcalari: ikonlu rozetler, MAX cizgili tencere, adim karti.
// Renk: turuncu kahve (#B06A4F)
const IKON = 'w-[15px] h-[15px] flex-shrink-0'
const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

export function KapakAcikIkon() {
  return (
    <svg viewBox="0 0 24 24" className={IKON} {...S} aria-hidden="true">
      <path d="M4 14h16v4a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z" />
      <path d="M6 10.5 15.5 4l1.2 1.7" />
      <path d="m14 3.2 3.8-.6" />
    </svg>
  )
}
export function KapakKapaliIkon() {
  return (
    <svg viewBox="0 0 24 24" className={IKON} {...S} aria-hidden="true">
      <path d="M4 13h16v5a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z" />
      <path d="M3 13a9 5 0 0 1 18 0" />
      <path d="M12 6.5V5" />
    </svg>
  )
}
export function SepetIkon() {
  return (
    <svg viewBox="0 0 24 24" className={IKON} {...S} aria-hidden="true">
      <path d="M3 9h18l-2 10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" />
      <path d="M8 13v4M12 13v4M16 13v4" />
    </svg>
  )
}
export function DamlaIkon() {
  return (
    <svg viewBox="0 0 24 24" className={IKON} {...S} aria-hidden="true">
      <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />
    </svg>
  )
}
export function IsiIkon() {
  return (
    <svg viewBox="0 0 24 24" className={IKON} {...S} aria-hidden="true">
      <path d="M8 4c-1.5 2 1.5 3 0 5M12 3c-1.5 2 1.5 3 0 5M16 4c-1.5 2 1.5 3 0 5" />
      <path d="M4 13h16v4a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" />
    </svg>
  )
}
export function SaatIkon() {
  return (
    <svg viewBox="0 0 24 24" className={IKON} {...S} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

function Rozet({ ikon, children, dolu = false }: { ikon?: ReactNode; children: ReactNode; dolu?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12.5px] font-semibold ${
        dolu ? 'bg-pp text-white' : 'bg-pp-50 text-pp-700 dark:bg-[#3a2820] dark:text-[#e8bfae]'
      }`}
    >
      {ikon}
      {children}
    </span>
  )
}

// Her bilgi ayri rozet: mod, sure, kapak, sepet, su, Keep Warm
export function PpRozetleri({ a }: { a: PpAdim }) {
  if (!a.mod) return <Rozet>Elle · cihaz dışı</Rozet>
  return (
    <span className="flex flex-wrap gap-1.5">
      <Rozet dolu>{ppModAdi(a.mod)}</Rozet>
      {a.dakika > 0 && <Rozet ikon={<SaatIkon />}>{sureYazi(a.dakika)}</Rozet>}
      {a.kapak === 'acik' && <Rozet ikon={<KapakAcikIkon />}>Kapak açık</Rozet>}
      {a.kapak === 'kapali' && <Rozet ikon={<KapakKapaliIkon />}>Kapak kapalı</Rozet>}
      {a.sepet && <Rozet ikon={<SepetIkon />}>Sepet</Rozet>}
      {a.su && <Rozet ikon={<DamlaIkon />}>{a.su} su</Rozet>}
      {a.keepWarm && (
        <Rozet ikon={<IsiIkon />}>
          {a.keepWarm === 'low' ? 'Keep Warm Low' : a.keepWarm === 'high' ? 'Keep Warm High' : `Keep Warm ${a.keepWarm === 'acik' ? 'açık' : 'kapalı'}`}
        </Rozet>
      )}
    </span>
  )
}

// MAX uyarisi: kucuk tencere cizimi, MAX cizgisi kirmizi
export function MaxTencere({ metin }: { metin: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-amber-50 dark:bg-[#33270f] p-3">
      <svg viewBox="0 0 64 56" className="w-14 h-12 flex-shrink-0" role="img" aria-label="MAX çizgisi">
        <path d="M10 14h44v30a8 8 0 0 1-8 8H18a8 8 0 0 1-8-8z" fill="#ffffff" stroke="#56380e" strokeWidth="2.5" />
        <path d="M12 30h40v14a6 6 0 0 1-6 6H18a6 6 0 0 1-6-6z" fill="#e9b949" opacity="0.55" />
        <line x1="6" y1="22" x2="58" y2="22" stroke="#d93d20" strokeWidth="3" strokeDasharray="5 3" />
        <text x="58" y="19" textAnchor="end" fontSize="9" fontWeight="700" fill="#d93d20" fontFamily="Inter, sans-serif">MAX</text>
        <path d="M6 14h6M52 14h6" stroke="#56380e" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <p className="text-[13px] text-amber-900 dark:text-amber-200">{metin}</p>
    </div>
  )
}

export function PpAdimKarti({ a, no }: { a: PpAdim; no: number }) {
  return (
    <li className="lz-card p-4 space-y-2">
      <div className="flex items-start gap-3">
        <span className="w-8 h-8 rounded-full bg-pp text-white text-[13px] font-bold flex items-center justify-center flex-shrink-0">{no}</span>
        <div className="flex-1 min-w-0 space-y-2">
          {a.ingredients && <div className="text-[13.5px] font-semibold text-[#18181b] dark:text-white">Hazneye: {a.ingredients}</div>}
          <div className="text-[15px] leading-relaxed text-[#3f3f46] dark:text-[#d4d4d8]">{a.text}</div>
          <PpRozetleri a={a} />
          {a.butonlar && (
            <div className="text-[13.5px] rounded-xl bg-black/[0.04] dark:bg-white/[0.06] p-2.5 text-[#3f3f46] dark:text-[#d4d4d8]">
              <b>Düğmeler:</b> {a.butonlar}
            </div>
          )}
          {a.bitince && (
            <div className="text-[13.5px] rounded-xl border-2 border-pp/60 p-2.5 text-pp-700 dark:text-[#e8bfae] font-semibold">⏹ Bitince: {a.bitince}</div>
          )}
          {a.tip && <div className="text-[13.5px] rounded-xl bg-amber-50 dark:bg-[#33270f] text-amber-900 dark:text-amber-200 p-2.5">💡 {a.tip}</div>}
        </div>
      </div>
    </li>
  )
}

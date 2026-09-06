import type { TmStep } from '../types'

// ADIM CANLANDIRMASI — pisirme modunda, o adimda kapta NE OLDUGUNU gosterir:
// bicak hangi yone, ne hizda donuyor; isitma var mi; Varoma'da buhar cikiyor mu.
//
// Neden: "ters bıçak · devir 4" yazisini okumak yerine tek bakista gormek,
// cihazin basinda elin hamurluyken cok daha hizli. Hareket YALNIZCA sayac
// calisirken oynar; duraklatinca donar, yon oku yerinde kalir. Telefonun
// "hareketi azalt" ayari aciksa hicbir sey oynamaz (index.css'te).

// Devir -> bir turun kac saniye surdugu. Gercek rpm degil (devir 10 = 5800 rpm,
// ekranda gorunmez); okunakli kalacak sekilde oranti korunarak kisaltildi.
const TUR_SURESI: Record<string, number> = {
  yumusak: 3.6,
  '0.5': 3,
  '1': 2.4,
  '2': 2,
  '3': 1.6,
  '4': 1.2,
  '5': 0.9,
  '6': 0.7,
  '7': 0.55,
  '8': 0.45,
  '9': 0.35,
  '10': 0.28,
  turbo: 0.18
}

interface Props {
  step: TmStep
  running: boolean
}

export default function StepVisual({ step, running }: Props) {
  const sure = step.speed ? (TUR_SURESI[step.speed] ?? 1.2) : 0
  const isitma = step.temp !== ''
  const varoma = step.temp === 'varoma' || step.mode === 'buhar'
  const sicak = isitma && !varoma

  return (
    <div className="tm-card p-2 flex items-center justify-center">
      <svg viewBox="0 0 200 170" className="h-[92px] w-auto" role="img" aria-label="Adım görseli">
        {/* Varoma / buhar */}
        {varoma && (
          <g className="tm-steam" stroke="#94a3b8" strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.8">
            <path d="M78 34 q-10 -12 0 -24" />
            <path d="M100 30 q-10 -12 0 -24" />
            <path d="M122 34 q-10 -12 0 -24" />
          </g>
        )}

        {/* Kap (ustten gorunus) */}
        <ellipse cx="100" cy="92" rx="72" ry="56" fill="#e8ecf1" className="dark:opacity-20" />
        <ellipse cx="100" cy="92" rx="62" ry="47" fill="#ffffff" className="dark:opacity-10" />

        {/* Isitma: kabin altindan yukselen sicaklik dalgalari */}
        {sicak && (
          <g className="tm-heat" stroke="#f97316" strokeWidth="5" strokeLinecap="round" fill="none">
            <path d="M62 150 q8 -12 0 -24" />
            <path d="M100 154 q8 -12 0 -24" />
            <path d="M138 150 q8 -12 0 -24" />
          </g>
        )}

        {/* Bicak: donme hizi devirden, yon ters bicaktan gelir */}
        <g
          className={sure && running ? 'tm-blade' : undefined}
          style={
            sure
              ? {
                  animationDuration: `${sure}s`,
                  animationDirection: step.reverse ? 'reverse' : 'normal',
                  transformOrigin: '100px 92px'
                }
              : undefined
          }
        >
          <path d="M100 92 L58 78 L62 96 Z" fill="#00873a" />
          <path d="M100 92 L142 106 L138 88 Z" fill="#00873a" />
          <path d="M100 92 L92 52 L110 56 Z" fill="#00ac46" />
          <path d="M100 92 L108 132 L90 128 Z" fill="#00ac46" />
          <circle cx="100" cy="92" r="9" fill="#0a4a22" />
        </g>

        {/* Yon oku: sayac dursa bile hangi yone donecegi gorunur */}
        {sure > 0 && (
          <g fill="none" stroke={step.reverse ? '#f59e0b' : '#94a3b8'} strokeWidth="4" strokeLinecap="round">
            {step.reverse ? (
              <>
                <path d="M46 92 a54 42 0 0 0 18 32" />
                <path d="M64 124 l-12 -3 M64 124 l2 -12" />
              </>
            ) : (
              <>
                <path d="M154 92 a54 42 0 0 1 -18 32" />
                <path d="M136 124 l12 -3 M136 124 l-2 -12" />
              </>
            )}
          </g>
        )}

        {/* Bicak donmeyen adim: bekleme/elle is oldugunu belirt */}
        {!sure && !isitma && (
          <text x="100" y="98" textAnchor="middle" className="fill-slate-400" fontSize="16">
            bıçak dönmez
          </text>
        )}
      </svg>
    </div>
  )
}

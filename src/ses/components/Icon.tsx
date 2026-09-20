// Tek bir cizgi-ikon seti. Emoji yerine bunlar kullanilir: emoji her cihazda
// farkli goruntulenir ve arayuze "hazir sablon" hissi verir. Hepsi ayni
// gorsel dilde: 24x24 kutu, 1.6 kalinlik, yuvarlatilmis uc, currentColor.
export type IconName =
  | 'play'
  | 'pause'
  | 'skip'
  | 'check'
  | 'chevron'
  | 'back'
  | 'external'
  | 'search'
  | 'alert'
  | 'info'
  | 'target'
  | 'flame'
  | 'clock'
  | 'mic'
  | 'wave'
  | 'lungs'
  | 'speaker'
  | 'straw'
  | 'video'
  | 'chart'
  | 'calendar'
  | 'star'
  | 'sparkle'
  | 'stethoscope'
  | 'speech'

const PATHS: Record<IconName, string[]> = {
  play: ['M8 5.5v13l11-6.5z'],
  pause: ['M9 5v14', 'M15 5v14'],
  skip: ['M6 6l8 6-8 6z', 'M18 6v12'],
  check: ['M4.5 12.5 9.5 17.5 19.5 7'],
  chevron: ['M9 5.5 16 12l-7 6.5'],
  back: ['M15 5.5 8 12l7 6.5'],
  external: ['M7 17 17 7', 'M9 7h8v8'],
  search: ['M11 4.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13z', 'M16 16l4 4'],
  alert: ['M12 4.5 21 19.5H3z', 'M12 10v4', 'M12 17h.01'],
  info: ['M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z', 'M12 11v5.5', 'M12 7.8h.01'],
  target: ['M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z', 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M12 11.4a.6.6 0 1 0 0 1.2.6.6 0 0 0 0-1.2z'],
  flame: ['M12 3.5c3 3 4.5 5.2 4.5 7.6a4.5 4.5 0 1 1-9 0c0-1.3.5-2.5 1.6-3.8.3 1.2.9 1.9 1.7 2.2-.1-2 .3-4 1.2-6z'],
  clock: ['M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z', 'M12 7.5V12l3 1.8'],
  mic: ['M12 3.5a2.8 2.8 0 0 0-2.8 2.8v5a2.8 2.8 0 0 0 5.6 0v-5A2.8 2.8 0 0 0 12 3.5z', 'M6 11a6 6 0 0 0 12 0', 'M12 17v3.5'],
  wave: ['M3 12h2.2', 'M7.6 12V8.4', 'M7.6 15.6V12', 'M12 5v14', 'M16.4 8.4v7.2', 'M20.8 10.4v3.2'],
  lungs: ['M12 4v8', 'M9.2 9.2C7 9.8 5 12 5 15v3.2c0 1 .8 1.8 1.8 1.8h1.4c1 0 1.8-.8 1.8-1.8V12', 'M14.8 9.2c2.2.6 4.2 2.8 4.2 5.8v3.2c0 1-.8 1.8-1.8 1.8h-1.4c-1 0-1.8-.8-1.8-1.8V12'],
  speaker: ['M5 9.5h3l4-3.5v12l-4-3.5H5z', 'M15.6 9.4a3.6 3.6 0 0 1 0 5.2', 'M18.2 7a7 7 0 0 1 0 10'],
  straw: ['M9 4h6l-1.4 16h-3.2z', 'M9.6 9h4.8'],
  video: ['M3.5 6.5h12a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-12a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z', 'M16.5 10.5 21.5 8v8l-5-2.5z'],
  chart: ['M4 20h16', 'M7.5 20v-5.5', 'M12 20V8', 'M16.5 20v-8.5'],
  calendar: ['M5 6.5h14a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7.5a1 1 0 0 1 1-1z', 'M8 4v4', 'M16 4v4', 'M4 11h16'],
  star: ['M12 4.5l2.3 4.9 5.2.7-3.8 3.7 1 5.2-4.7-2.6-4.7 2.6 1-5.2L4.5 10l5.2-.7z'],
  sparkle: ['M12 4.5c.6 3.4 1.6 4.4 5 5-3.4.6-4.4 1.6-5 5-.6-3.4-1.6-4.4-5-5 3.4-.6 4.4-1.6 5-5z', 'M18.5 14.5c.3 1.5.7 1.9 2.2 2.2-1.5.3-1.9.7-2.2 2.2-.3-1.5-.7-1.9-2.2-2.2 1.5-.3 1.9-.7 2.2-2.2z'],
  stethoscope: ['M6 4v5a4 4 0 0 0 8 0V4', 'M6 4H4.5', 'M14 4h1.5', 'M10 13v2.5a4 4 0 0 0 8 0V15', 'M18 10.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4z'],
  speech: ['M4.5 5.5h15a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H12l-4.5 3.5V15.5h-3a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z']
}

const DOLU: IconName[] = ['play', 'skip', 'flame']

export default function Icon({ name, size = 20, className = '', strokeWidth = 1.6 }: { name: IconName; size?: number; className?: string; strokeWidth?: number }) {
  const dolu = DOLU.includes(name)
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={`flex-shrink-0 ${className}`}
      fill={dolu ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={dolu ? 0 : strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name].map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  )
}

// Egzersiz grubuna gore ikon (emoji yerine)
export function groupIcon(group: string): IconName {
  if (group === 'isinma') return 'lungs'
  if (group === 'sogutma') return 'straw'
  return 'mic'
}

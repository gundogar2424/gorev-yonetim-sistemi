import { T_SOLUK } from './ui'
import { adimKutulari, cihazAdimi, modAdi, type TmAdim } from '../lib/tm7'

// Bir TM7 adiminin ayarlari: kucuk rozetler (sure · sicaklik · devir · yon · kelebek · mod).
// Elle yapilan adimda "Elle" rozeti.
export function AyarRozetleri({ a, buyuk = false }: { a: TmAdim; buyuk?: boolean }) {
  const boy = buyuk ? 'text-[13px] px-2.5 py-1' : 'text-[12px] px-2 py-0.5'
  if (!cihazAdimi(a)) {
    return <span className={`inline-block rounded-md bg-[#f3f3f1] dark:bg-[#26262a] font-semibold ${boy} ${T_SOLUK}`}>Elle · cihaz dışı</span>
  }
  const kutular = adimKutulari(a)
  return (
    <span className="flex flex-wrap gap-1.5">
      {a.mode && <span className={`rounded-md bg-lz-600 text-white font-semibold ${boy}`}>{modAdi(a.mode)}</span>}
      {kutular.map(([ad, deger]) => (
        <span key={ad} className={`rounded-md bg-lz-50 dark:bg-[#3a1d16] text-lz-700 dark:text-lz-300 font-semibold ${boy}`} title={ad}>
          {ad === 'Devir' ? `Devir ${deger}` : deger}
        </span>
      ))}
    </span>
  )
}

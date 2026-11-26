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
      {a.mode && <span className={`rounded-md bg-tm text-white font-semibold ${boy}`}>{modAdi(a.mode)}</span>}
      {kutular.map(([ad, deger]) => (
        <span key={ad} className={`rounded-md bg-tm-50 dark:bg-[#15302a] text-tm-700 dark:text-[#8fd3b3] font-semibold ${boy}`} title={ad}>
          {ad === 'Devir' ? `Devir ${deger}` : deger}
        </span>
      ))}
    </span>
  )
}

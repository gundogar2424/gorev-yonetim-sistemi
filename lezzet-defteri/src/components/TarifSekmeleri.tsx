import { useNavigate } from 'react-router-dom'

// Tarif sayfasinin ust sekmeleri: Normal / Thermomix / Pilav Pisiricide.
// Sekmeler arasi gecis gecmise eklenmez (geri tusu tarif listesine doner).
export function TarifSekmeleri({ id, aktif }: { id: number; aktif: 'normal' | 'tm' | 'pp' }) {
  const navigate = useNavigate()
  const sekmeler = [
    { k: 'normal', ad: 'Normal', yol: `/tarif/${id}` },
    { k: 'tm', ad: 'Thermomix', yol: `/thermomix/${id}` },
    { k: 'pp', ad: 'Pilav Pişiricide', yol: `/pisirici/${id}` }
  ] as const
  return (
    <div className="lz-card p-1 grid grid-cols-3 gap-1" role="tablist">
      {sekmeler.map((s) => (
        <button
          key={s.k}
          role="tab"
          aria-selected={aktif === s.k}
          onClick={() => aktif !== s.k && navigate(s.yol, { replace: true })}
          className={`rounded-xl py-2 text-[13px] font-semibold transition ${
            aktif === s.k ? 'bg-lz-600 text-white' : 'text-[#52525b] dark:text-[#a1a1aa] active:bg-black/5'
          }`}
        >
          {s.ad}
        </button>
      ))}
    </div>
  )
}

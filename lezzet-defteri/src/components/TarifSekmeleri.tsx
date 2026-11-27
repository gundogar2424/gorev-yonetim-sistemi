import { useNavigate } from 'react-router-dom'

// Tarif sayfasinin ust sekmeleri: Normal / Thermomix / Pilav Pisiricide.
// Sekmeler arasi gecis gecmise eklenmez (geri tusu tarif listesine doner).
export function TarifSekmeleri({ id, aktif }: { id: number; aktif: 'normal' | 'tm' | 'pp' }) {
  const navigate = useNavigate()
  // Her cihazin kendi rengi: normal gri, Thermomix koyu yesil, pilav pisirici turuncu kahve
  const sekmeler = [
    { k: 'normal', ad: 'Normal', yol: `/tarif/${id}`, renk: '#52525b' },
    { k: 'tm', ad: 'Thermomix', yol: `/thermomix/${id}`, renk: '#2E7D5B' },
    { k: 'pp', ad: 'Pilav Pişiricide', yol: `/pisirici/${id}`, renk: '#A0603F' }
  ] as const
  return (
    <div className="lz-card p-1 grid grid-cols-3 gap-1" role="tablist">
      {sekmeler.map((s) => (
        <button
          key={s.k}
          role="tab"
          aria-selected={aktif === s.k}
          onClick={() => aktif !== s.k && navigate(s.yol, { replace: true })}
          className={`rounded-xl min-h-[48px] py-2 text-[13px] font-semibold transition ${
            aktif === s.k ? 'text-white font-bold' : 'dark:!text-[#e4e4e7] active:bg-black/5'
          }`}
          style={aktif === s.k ? { background: s.renk } : { color: s.renk }}
        >
          {s.ad}
        </button>
      ))}
    </div>
  )
}

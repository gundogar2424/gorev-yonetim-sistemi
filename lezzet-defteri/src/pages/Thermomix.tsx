import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { listRecipes, updateRecipe } from '../db'
import type { LzRecipe } from '../types'
import { Header, Icon, T_BASLIK, T_SOLUK, Thumb } from '../components/ui'
import { aiThermomix, apiAnahtari } from '../lib/ai'

// Tarifi TM7'ye uyarlayip kaydeder (Tarif ekranindan ve bu sekmeden cagrilir)
export async function thermomixeUyarla(r: LzRecipe): Promise<void> {
  const tm = await aiThermomix(r)
  await updateRecipe(r.id!, { tm })
}

// THERMOMIX SEKMESI: uyarlanmis tarifler ustte, uyarlanabilecekler altta.
export default function Thermomix() {
  const navigate = useNavigate()
  const tarifler = useLiveQuery(() => listRecipes(), [], [] as LzRecipe[]) ?? []
  const [calisan, setCalisan] = useState(0)
  const [hata, setHata] = useState('')
  const [q, setQ] = useState('')
  const aiVar = !!apiAnahtari()

  const a = q.trim().toLocaleLowerCase('tr')
  const uygun = (r: LzRecipe) => !a || r.title.toLocaleLowerCase('tr').includes(a)
  const uyarlanan = tarifler.filter((r) => r.tm && uygun(r))
  const digerleri = tarifler.filter((r) => !r.tm && r.ingredients.length > 0 && uygun(r))

  const uyarla = async (r: LzRecipe) => {
    setHata('')
    setCalisan(r.id!)
    try {
      await thermomixeUyarla(r)
      navigate(`/thermomix/${r.id}`)
    } catch (e) {
      setHata((e as Error).message)
    }
    setCalisan(0)
  }

  return (
    <div>
      <Header title="Thermomix" subtitle="Tariflerini TM7 adımlarına uyarla" />
      <div className="px-4 space-y-3 pb-6">
        {!aiVar && (
          <div className="rounded-2xl bg-amber-50 dark:bg-[#2a2113] text-amber-800 dark:text-amber-200 text-[13px] p-3.5">
            Uyarlama yapay zekayla yapılır.{' '}
            <Link to="/ayarlar" className="font-semibold underline">
              Ayarlar
            </Link>
            ’dan Gemini anahtarını gir.
          </div>
        )}
        {tarifler.length > 3 && <input className="lz-input" placeholder="Tarif ara…" value={q} onChange={(e) => setQ(e.target.value)} />}
        {hata && <div className="rounded-2xl bg-rose-50 dark:bg-[#2a1a1d] text-rose-700 dark:text-rose-300 text-sm p-3.5">⚠️ {hata}</div>}

        {uyarlanan.length > 0 && (
          <>
            <div className="lz-label px-1 pt-1">TM7’ye uyarlananlar · {uyarlanan.length}</div>
            {uyarlanan.map((r) => (
              <Link key={r.id} to={`/thermomix/${r.id}`} className="lz-card p-2.5 flex items-center gap-3">
                <Thumb src={r.photo} className="w-16 h-16 rounded-2xl" />
                <div className="flex-1 min-w-0">
                  <div className={`font-semibold leading-snug line-clamp-2 ${T_BASLIK}`}>{r.title}</div>
                  <div className={`text-[12px] mt-0.5 ${T_SOLUK}`}>
                    {r.tm!.category} · {r.tm!.steps.length} TM7 adımı
                  </div>
                </div>
                <span className="w-10 h-10 rounded-full bg-lz-600 text-white flex items-center justify-center flex-shrink-0">
                  <Icon name="play" className="w-4 h-4" />
                </span>
              </Link>
            ))}
          </>
        )}

        {digerleri.length > 0 && (
          <>
            <div className="lz-label px-1 pt-3">Uyarlanabilecek tarifler · {digerleri.length}</div>
            {digerleri.map((r) => (
              <div key={r.id} className="lz-card p-2.5 flex items-center gap-3">
                <Thumb src={r.photo} className="w-14 h-14 rounded-2xl" />
                <div className={`flex-1 min-w-0 font-medium leading-snug line-clamp-2 ${T_BASLIK}`}>{r.title}</div>
                <button
                  className="lz-btn-soft px-3 py-2 text-[13px] flex-shrink-0"
                  disabled={!aiVar || !!calisan}
                  onClick={() => void uyarla(r)}
                >
                  {calisan === r.id ? 'Uyarlanıyor…' : 'Uyarla'}
                </button>
              </div>
            ))}
          </>
        )}

        {tarifler.length === 0 && (
          <div className={`lz-card p-6 text-center text-sm ${T_SOLUK}`}>Önce Tariflerim’e tarif ekle; sonra buradan Thermomix’e uyarlarsın.</div>
        )}
      </div>
    </div>
  )
}

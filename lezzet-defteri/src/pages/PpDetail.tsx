import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { lzDb, updateRecipe } from '../db'
import { aiPilavPisirici } from '../lib/ai'
import { PP_CIHAZLAR, ppAcik, ppAdimOzeti, ppCihaz, ppDenetle, sureYazi } from '../lib/pisirici'
import { Header, T_BASLIK, T_GOVDE, T_SOLUK } from '../components/ui'
import { TarifSekmeleri } from '../components/TarifSekmeleri'

// PILAV PISIRICIDE: tarifin Instant Pot MRRC2001WE uyarlamasi
export default function PpDetail() {
  const id = Number(useParams().id)
  const r = useLiveQuery(() => lzDb.recipes.get(id), [id])
  const [calisiyor, setCalisiyor] = useState(false)
  const [hata, setHata] = useState('')
  if (!r) return <Header title="Tarif" back />

  const uyarla = async () => {
    setCalisiyor(true)
    setHata('')
    try {
      const pp = await aiPilavPisirici(r)
      await updateRecipe(r.id!, { pp })
    } catch (e) {
      setHata(e instanceof Error ? e.message : String(e))
    }
    setCalisiyor(false)
  }
  const cihazAd = PP_CIHAZLAR.find((c) => c.id === (r.pp?.cihaz || ppCihaz()))?.ad ?? 'Pilav pişirici'

  if (!ppAcik() && !r.pp) {
    return (
      <div>
        <Header title={r.title} back />
        <div className="px-4 space-y-3">
          <TarifSekmeleri id={r.id!} aktif="pp" />
          <p className={`text-sm ${T_SOLUK}`}>
            Pilav pişirici seçili değil. <Link to="/ayarlar" className="text-lz-600 font-semibold underline">Ayarlar → Pilav Pişiricim</Link>’den cihazını seç.
          </p>
        </div>
      </div>
    )
  }

  if (!r.pp) {
    return (
      <div>
        <Header title={r.title} back />
        <div className="px-4 space-y-3">
          <TarifSekmeleri id={r.id!} aktif="pp" />
          <p className={`text-sm ${T_SOLUK}`}>Bu tarif henüz pilav pişiriciye uyarlanmadı. Yeni kaydedilen tarifler kendiliğinden uyarlanır.</p>
          {hata && <div className="rounded-2xl bg-rose-50 dark:bg-[#2a1a1d] text-rose-700 dark:text-rose-300 text-sm p-3.5">{hata}</div>}
          <button className="lz-btn-primary w-full" disabled={calisiyor} onClick={() => void uyarla()}>
            {calisiyor ? 'Uyarlanıyor…' : 'Pilav pişiriciye uyarla'}
          </button>
          <p className={`text-[12px] ${T_SOLUK}`}>{cihazAd}</p>
        </div>
      </div>
    )
  }

  // Eski kayitlar da guncel kurallarla gosterilir
  const pp = ppDenetle(r.pp, r)
  const cihazDk = pp.steps.reduce((t, a) => t + (a.mod ? a.dakika : 0), 0)
  let n = 0
  return (
    <div>
      <Header title={r.title} subtitle={['Pilav pişirici', `${pp.steps.length} adım`, cihazDk ? `~${sureYazi(cihazDk)} cihaz` : ''].filter(Boolean).join(' · ')} back />
      <div className="px-4 space-y-3 pb-8">
        <TarifSekmeleri id={r.id!} aktif="pp" />
        <p className={`text-[12px] ${T_SOLUK}`}>{cihazAd}</p>

        {!pp.uygun && (
          <div className="rounded-2xl bg-rose-50 dark:bg-[#2a1a1d] text-rose-800 dark:text-rose-200 text-[14px] p-3.5 font-semibold">Bu pişiricide olmaz.</div>
        )}
        {pp.warnings.length > 0 && (
          <div className="rounded-2xl bg-amber-50 dark:bg-[#2a2212] text-amber-900 dark:text-amber-200 text-[13px] p-3.5 space-y-1">
            {pp.warnings.map((w) => (
              <div key={w}>⚠️ {w}</div>
            ))}
          </div>
        )}

        <div className="lz-card p-4">
          <div className={`font-semibold mb-2 ${T_BASLIK}`}>Malzemeler</div>
          <ul className={`text-[14px] space-y-1 ${T_GOVDE}`}>
            {pp.ingredients.map((m, i) => (
              <li key={i}>• {m}</li>
            ))}
          </ul>
        </div>

        <ol className="space-y-2.5">
          {pp.steps.map((a, i) => {
            if (a.mod) n++
            return (
              <li key={i} className="lz-card p-4 space-y-2">
                <div className="flex items-start gap-3">
                  <span className="w-7 h-7 rounded-full bg-lz-600 text-white text-[13px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    {a.ingredients && <div className={`text-[13px] font-semibold ${T_BASLIK}`}>Hazneye: {a.ingredients}</div>}
                    <div className={`text-[14.5px] ${T_GOVDE}`}>{a.text}</div>
                    {a.mod && (
                      <div className="flex flex-wrap gap-1.5">
                        {ppAdimOzeti(a)
                          .split(' · ')
                          .map((x) => (
                            <span key={x} className="text-[12px] font-semibold px-2 py-0.5 rounded-full bg-lz-50 dark:bg-[#3a1d16] text-lz-700 dark:text-lz-300">
                              {x}
                            </span>
                          ))}
                      </div>
                    )}
                    {a.butonlar && (
                      <div className={`text-[13px] rounded-xl bg-black/[0.04] dark:bg-white/[0.06] p-2.5 ${T_GOVDE}`}>
                        <b>Düğmeler:</b> {a.butonlar}
                      </div>
                    )}
                    {a.tip && <div className="text-[13px] rounded-xl bg-amber-50 dark:bg-[#2a2212] text-amber-900 dark:text-amber-200 p-2.5">💡 {a.tip}</div>}
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
        {n === 0 && <p className={`text-[12.5px] ${T_SOLUK}`}>Bu tarifte cihaz adımı yok.</p>}

        <button className="lz-btn-soft w-full text-[14px]" disabled={calisiyor} onClick={() => void uyarla()}>
          {calisiyor ? 'Uyarlanıyor…' : 'Yeniden uyarla'}
        </button>
        {hata && <div className="rounded-2xl bg-rose-50 dark:bg-[#2a1a1d] text-rose-700 dark:text-rose-300 text-sm p-3.5">{hata}</div>}
        <p className={`text-[11.5px] text-center ${T_SOLUK}`}>Uyarlama yapay zekayla yapıldı; ilk pişirişte süreleri gözle kontrol et.</p>
      </div>
    </div>
  )
}

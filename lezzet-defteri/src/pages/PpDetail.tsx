import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { lzDb, updateRecipe } from '../db'
import { aiPilavPisirici } from '../lib/ai'
import { PP_CIHAZLAR, maxGerekli, ppAcik, ppCihaz, ppDenetle, sureYazi } from '../lib/pisirici'
import { MaxTencere, PpAdimKarti } from '../components/PpParcalar'
import { Header, T_BASLIK, T_GOVDE, T_SOLUK } from '../components/ui'
import { TarifSekmeleri, UyarlamaUyarisi } from '../components/TarifSekmeleri'

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
          <button className="lz-btn-primary w-full" disabled={calisiyor} onClick={() => void uyarla()} style={{ background: '#A0603F' }}>
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
        <UyarlamaUyarisi normalDegisti={r.normalDegisti} uyarlama={r.pp.createdAt} />
        <p className={`text-[12px] ${T_SOLUK}`}>{cihazAd}</p>

        {!pp.uygun && (
          <div className="rounded-2xl bg-rose-50 dark:bg-[#2a1a1d] text-rose-800 dark:text-rose-200 text-[14px] p-3.5 font-semibold">Bu pişiricide olmaz.</div>
        )}
        {pp.warnings.filter((w) => !/MAX|2,8 litreye/.test(w)).length > 0 && (
          <div className="rounded-2xl bg-amber-50 dark:bg-[#33270f] text-amber-900 dark:text-amber-200 text-[13.5px] p-3.5 space-y-1.5">
            {pp.warnings
              .filter((w) => !/MAX|2,8 litreye/.test(w))
              .map((w) => (
                <div key={w}>⚠️ {w}</div>
              ))}
          </div>
        )}
        {/* MAX cizimi yalnizca buyuk tariflerde (1,5 litreyi gecerse ya da hazne yaridan fazla doluysa) */}
        {maxGerekli(pp.ingredients) && (
          <MaxTencere metin={pp.warnings.find((w) => /2,8 litreye/.test(w)) ?? 'Hazne yarıdan fazla doluyor: iç yüzdeki MAX çizgisinin (yaklaşık 2,8 litre) üstüne doldurma.'} />
        )}

        {pp.steps.some((a) => a.mod) && (
          <Link to={`/pisirici/${r.id}/pisir`} className="lz-btn-primary w-full !bg-pp">
            ▶ Pilav pişiricide pişir
          </Link>
        )}

        <div className="lz-card p-4">
          <div className={`font-semibold mb-2 ${T_BASLIK}`}>Malzemeler</div>
          <ul className={`text-[14.5px] space-y-1 ${T_GOVDE}`}>
            {pp.ingredients.map((m, i) => (
              <li key={i}>• {m}</li>
            ))}
          </ul>
        </div>

        {pp.alternatif && <div className={`font-bold text-[16px] pt-1 ${T_BASLIK}`}>Seçenek 1: Slow Cook, 1 sa 30 dk</div>}
        <ol className="space-y-2.5">
          {pp.steps.map((a, i) => {
            if (a.mod) n++
            return <PpAdimKarti key={i} a={a} no={i + 1} />
          })}
        </ol>
        {pp.alternatif && (
          <div className="lz-card p-4 space-y-2 border-2 !border-pp/50">
            <div className={`font-bold text-[16px] ${T_BASLIK}`}>{pp.alternatif.baslik}</div>
            <ol className={`list-decimal pl-5 space-y-1.5 text-[14.5px] ${T_GOVDE}`}>
              {pp.alternatif.adimlar.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ol>
          </div>
        )}
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

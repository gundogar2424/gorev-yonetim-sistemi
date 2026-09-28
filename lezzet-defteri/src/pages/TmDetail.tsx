import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { lzDb, updateRecipe } from '../db'
import { Header, Icon, T_BASLIK, T_GOVDE, T_SOLUK, Toast, useToast } from '../components/ui'
import { adimOzeti, termomiksKodu } from '../lib/tm7'
import { thermomixeUyarla } from './Thermomix'
import { dosyaPaylas, tmHtml } from '../lib/paylas'

// Tarifin TM7 surumu: gramlı malzemeler, cihaz ayarli adimlar, uyarilar.
export default function TmDetail() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const r = useLiveQuery(() => lzDb.recipes.get(id), [id])
  const [calisiyor, setCalisiyor] = useState(false)
  const [hata, setHata] = useState('')
  const [toast, goster] = useToast()

  if (r === undefined) return null
  if (!r) return <Header title="Tarif bulunamadı" back />

  const yeniden = async () => {
    setHata('')
    setCalisiyor(true)
    try {
      await thermomixeUyarla(r)
      goster('Yeniden uyarlandı')
    } catch (e) {
      setHata((e as Error).message)
    }
    setCalisiyor(false)
  }

  if (!r.tm) {
    return (
      <div>
        <Header title={r.title} back />
        <div className="px-4 space-y-3">
          <p className={`text-sm ${T_SOLUK}`}>Bu tarif henüz Thermomix’e uyarlanmadı.</p>
          {hata && <div className="rounded-2xl bg-rose-50 dark:bg-[#2a1a1d] text-rose-700 dark:text-rose-300 text-sm p-3.5">⚠️ {hata}</div>}
          <button className="lz-btn-primary w-full" disabled={calisiyor} onClick={() => void yeniden()}>
            {calisiyor ? 'Uyarlanıyor…' : 'Thermomix’e uyarla'}
          </button>
        </div>
      </div>
    )
  }

  const tm = r.tm
  const tmPaylas = async () => {
    try {
      goster('Pişirme modu hazırlanıyor…')
      await dosyaPaylas(r.title, await tmHtml(r), '-thermomix')
    } catch (e) {
      const m = (e as Error).message || ''
      if (!/cancel|abort|iptal/i.test(m)) goster('Paylaşılamadı: ' + m.slice(0, 60))
    }
  }
  const aktar = async () => {
    const kod = termomiksKodu(r)
    try {
      await navigator.clipboard.writeText(kod)
      goster('Kod kopyalandı: Termomiks Defteri → Tarif Ekle’ye yapıştır')
    } catch {
      try {
        if (navigator.share) await navigator.share({ title: r.title, text: kod })
      } catch {
        /* vazgecildi */
      }
    }
  }

  return (
    <div>
      <Header title={r.title} subtitle={`Thermomix TM7 · ${tm.category}`} back />
      <div className="px-4 space-y-3 pb-8">
        <Link to={`/thermomix/${r.id}/pisir`} className="lz-btn-primary w-full">
          <Icon name="play" className="w-4 h-4" /> TM7’de pişir
        </Link>
        <div className="grid grid-cols-2 gap-2.5">
          <button className="lz-btn-soft text-sm px-3" onClick={() => void tmPaylas()}>
            <Icon name="share" className="w-4 h-4" /> Pişirme modunu paylaş
          </button>
          <button className="lz-btn-soft text-sm px-3" onClick={() => void aktar()}>
            Termomiks’e aktar
          </button>
        </div>

        {tm.warnings.length > 0 && (
          <div className="rounded-2xl bg-amber-50 dark:bg-[#2a2113] text-amber-800 dark:text-amber-200 text-[13px] p-3.5 space-y-1">
            {tm.warnings.map((w, i) => (
              <div key={i}>⚠️ {w}</div>
            ))}
          </div>
        )}

        <div className="lz-card p-4">
          <h2 className={`font-bold text-[17px] mb-2 ${T_BASLIK}`}>Malzemeler (gram)</h2>
          <ul className="space-y-1.5">
            {tm.ingredients.map((m, i) => (
              <li key={i} className={`text-[15px] ${T_GOVDE}`}>
                • {m}
              </li>
            ))}
          </ul>
        </div>

        <div className="lz-card p-4">
          <h2 className={`font-bold text-[17px] mb-3 ${T_BASLIK}`}>TM7 adımları</h2>
          <ol className="space-y-4">
            {tm.steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-7 h-7 rounded-full bg-lz-50 dark:bg-[#3a1d16] text-lz-600 dark:text-lz-300 text-[13px] font-bold flex items-center justify-center flex-shrink-0">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className={`text-[15px] leading-relaxed ${T_GOVDE}`}>{s.text}</p>
                  {s.ingredients && <p className={`text-[13px] mt-0.5 ${T_SOLUK}`}>Kaba: {s.ingredients}</p>}
                  {adimOzeti(s) && <span className="lz-pill mt-1.5">{adimOzeti(s)}</span>}
                  {s.tip && <p className={`text-[12.5px] mt-1 ${T_SOLUK}`}>💡 {s.tip}</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>

        {hata && <div className="rounded-2xl bg-rose-50 dark:bg-[#2a1a1d] text-rose-700 dark:text-rose-300 text-sm p-3.5">⚠️ {hata}</div>}
        <div className="grid grid-cols-2 gap-2.5">
          <button className="lz-btn-soft text-sm" disabled={calisiyor} onClick={() => void yeniden()}>
            {calisiyor ? 'Uyarlanıyor…' : '↻ Yeniden uyarla'}
          </button>
          <button className="lz-btn-soft text-sm" onClick={() => navigate(`/tarif/${r.id}`)}>
            Normal tarif
          </button>
        </div>
        <button
          className={`text-[13px] w-full py-2 ${T_SOLUK}`}
          onClick={async () => {
            if (!confirm('Thermomix uyarlaması silinsin mi? (Normal tarif kalır)')) return
            await updateRecipe(r.id!, { tm: undefined })
            navigate('/thermomix', { replace: true })
          }}
        >
          Uyarlamayı sil
        </button>
        <p className={`text-[11.5px] text-center ${T_SOLUK}`}>
          Uyarlama yapay zekayla yapıldı; ilk kez pişirirken süre ve devirleri gözle kontrol et.
        </p>
      </div>
      <Toast text={toast} />
    </div>
  )
}

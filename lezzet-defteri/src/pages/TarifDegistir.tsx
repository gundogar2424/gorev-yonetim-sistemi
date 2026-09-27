import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { addRecipe, lzDb, updateRecipe } from '../db'
import type { LzDraft, LzTable } from '../types'
import { Header, T_BASLIK, T_GOVDE, T_SOLUK } from '../components/ui'
import { aiTarifDegistir, apiAnahtari, profilMetni, type TarifDegisikligi } from '../lib/ai'

const ONERILER = [
  'Şeker yerine toz stevia kullanacağım, ne kadar koymalıyım?',
  'Şeker yerine damla stevia kullanacağım',
  'Glutensiz yap',
  'Laktozsuz yap',
  'Daha az kalorili yap',
  'Daha az yağlı yap',
  'Vegan yap',
  'Un yerine yulaf unu kullan',
  'Kızartma yerine fırında yap',
  'Airfryer’a uyarla'
]

// TARIFI YAPAY ZEKAYLA DEGISTIR: ikame / diyet / pisirme yontemi degisikligi.
export default function TarifDegistir() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const r = useLiveQuery(() => lzDb.recipes.get(id), [id])
  const sofralar = useLiveQuery(() => lzDb.sofralar.toArray(), [], [] as LzTable[]) ?? []
  const [istek, setIstek] = useState('')
  const [sonuc, setSonuc] = useState<TarifDegisikligi | null>(null)
  const [calisiyor, setCalisiyor] = useState(false)
  const [hata, setHata] = useState('')
  const aiVar = !!apiAnahtari()

  if (r === undefined) return null
  if (!r) return <Header title="Tarif bulunamadı" back />

  const sor = async () => {
    setHata('')
    setSonuc(null)
    setCalisiyor(true)
    try {
      setSonuc(await aiTarifDegistir(r, istek.trim(), profilMetni(sofralar)))
    } catch (e) {
      setHata((e as Error).message)
    }
    setCalisiyor(false)
  }

  const yeniHali = (): Partial<LzDraft> => ({
    title: sonuc!.tarif.title || r.title,
    servings: sonuc!.tarif.servings || r.servings,
    minutes: sonuc!.tarif.minutes || r.minutes,
    ingredients: sonuc!.tarif.ingredients ?? r.ingredients,
    steps: sonuc!.tarif.steps ?? r.steps,
    notes: [sonuc!.tarif.notes, sonuc!.aciklama ? `Değişiklik: ${sonuc!.aciklama}` : ''].filter(Boolean).join('\n\n'),
    tags: sonuc!.tarif.tags ?? r.tags
  })

  const guncelle = async () => {
    // Malzeme degistigi icin eski besin degeri ve Thermomix uyarlamasi gecersiz kalir
    await updateRecipe(r.id!, { ...yeniHali(), besin: undefined, tm: undefined })
    navigate(`/tarif/${r.id}`, { replace: true })
  }
  const yeniKaydet = async () => {
    const d: LzDraft = {
      title: '',
      photo: r.photo,
      sourceUrl: r.sourceUrl,
      platform: r.platform,
      author: r.author,
      servings: 0,
      minutes: 0,
      ingredients: [],
      steps: [],
      notes: '',
      tags: [],
      ...yeniHali()
    } as LzDraft
    if (d.title === r.title) d.title = `${r.title} (değiştirilmiş)`
    const yeni = await addRecipe(d, r.tableIds)
    navigate(`/tarif/${yeni}`, { replace: true })
  }

  const eski = new Set(r.ingredients.map((x) => x.trim().toLocaleLowerCase('tr')))

  return (
    <div>
      <Header title="Tarifi değiştir" subtitle={r.title} back />
      <div className="px-4 space-y-3 pb-8">
        {!aiVar && (
          <div className="rounded-2xl bg-amber-50 dark:bg-[#2a2113] text-amber-800 dark:text-amber-200 text-[13px] p-3.5">
            Bu özellik yapay zekayla çalışır.{' '}
            <Link to="/ayarlar" className="font-semibold underline">
              Ayarlar
            </Link>
            ’dan Gemini anahtarını gir.
          </div>
        )}
        <div className="lz-card p-4 space-y-3">
          <div className={`font-semibold ${T_BASLIK}`}>Ne değişsin?</div>
          <textarea
            className="lz-input min-h-[100px] text-[15px]"
            placeholder="Örn. Şeker yerine Stevia (toz, saf) kullanacağım; ne kadar koymalıyım?"
            value={istek}
            onChange={(e) => setIstek(e.target.value)}
          />
          <p className={`text-[12px] ${T_SOLUK}`}>İpucu: tatlandırıcının türünü ya da markasını yaz (toz, damla, “1:1” granül…) — miktar buna göre çok değişir.</p>
          <div className="flex flex-wrap gap-1.5">
            {ONERILER.map((o) => (
              <button key={o} onClick={() => setIstek(o)} className="lz-chip text-[12.5px] !whitespace-normal text-left">
                {o}
              </button>
            ))}
          </div>
          <button className="lz-btn-primary w-full" disabled={!aiVar || !istek.trim() || calisiyor} onClick={() => void sor()}>
            {calisiyor ? 'Tarif değiştiriliyor…' : '✨ Değiştir'}
          </button>
        </div>

        {hata && <div className="rounded-2xl bg-rose-50 dark:bg-[#2a1a1d] text-rose-700 dark:text-rose-300 text-sm p-3.5">⚠️ {hata}</div>}

        {sonuc && (
          <>
            {sonuc.aciklama && (
              <div className="rounded-2xl bg-emerald-50 dark:bg-[#10261e] text-emerald-900 dark:text-emerald-200 text-[14px] p-4 leading-relaxed">
                💡 {sonuc.aciklama}
              </div>
            )}
            {sonuc.degisiklikler.length > 0 && (
              <div className="lz-card p-4">
                <div className="lz-label mb-2">Değişenler</div>
                <ul className="space-y-1.5">
                  {sonuc.degisiklikler.map((d, i) => (
                    <li key={i} className={`text-[14px] ${T_GOVDE}`}>
                      • {d}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="lz-card p-4">
              <div className={`font-bold text-[17px] mb-2 ${T_BASLIK}`}>{sonuc.tarif.title || r.title}</div>
              <div className="lz-label mb-1">Malzemeler</div>
              <ul className="space-y-1 mb-3">
                {(sonuc.tarif.ingredients ?? []).map((m, i) => {
                  const yeni = !eski.has(m.trim().toLocaleLowerCase('tr'))
                  return (
                    <li key={i} className={`text-[14.5px] ${yeni ? 'text-lz-700 dark:text-lz-300 font-semibold' : T_GOVDE}`}>
                      {yeni ? '✎ ' : '• '}
                      {m}
                    </li>
                  )
                })}
              </ul>
              <div className="lz-label mb-1">Yapılışı</div>
              <ol className="space-y-1.5">
                {(sonuc.tarif.steps ?? []).map((s, i) => (
                  <li key={i} className={`text-[14px] ${T_GOVDE}`}>
                    {i + 1}. {s}
                  </li>
                ))}
              </ol>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button className="lz-btn-primary text-sm px-3" onClick={() => void guncelle()}>
                Bu tarifi güncelle
              </button>
              <button className="lz-btn-soft text-sm px-3" onClick={() => void yeniKaydet()}>
                Yeni tarif olarak kaydet
              </button>
            </div>
            <p className={`text-[11.5px] text-center ${T_SOLUK}`}>“Yeni tarif olarak kaydet” derseniz orijinal tarif olduğu gibi kalır.</p>
          </>
        )}
      </div>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { addRecipe, lzDb, updateRecipe } from '../db'
import type { LzDraft, LzTable } from '../types'
import { Header, T_BASLIK, T_GOVDE, T_SOLUK } from '../components/ui'
import { SohbetBalonlari, konusmaIstegi } from '../components/TarifSohbet'
import { aiTarifDegistir, aiTarifSohbet, apiAnahtari, profilMetni, type SohbetMesaji, type TarifDegisikligi } from '../lib/ai'

const SORULAR = ['Bu malzemenin Türkiye’deki karşılığı ne?', 'Neyle değiştirebilirim?', 'Kaç kalori, nasıl hafifletirim?', 'Tutmazsa neden olur?']

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

// TARIFI YAPAY ZEKAYLA DEGISTIR: once tarif uzerine sohbet (soru-cevap),
// karar verilince konusmaya gore tarif yeniden yazilir.
export default function TarifDegistir() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const r = useLiveQuery(() => lzDb.recipes.get(id), [id])
  const sofralar = useLiveQuery(() => lzDb.sofralar.toArray(), [], [] as LzTable[]) ?? []
  const [istek, setIstek] = useState('')
  const [sohbet, setSohbet] = useState<SohbetMesaji[]>([])
  const [soruyor, setSoruyor] = useState(false)
  const alt = useRef<HTMLDivElement>(null)
  const [sonuc, setSonuc] = useState<TarifDegisikligi | null>(null)
  const [calisiyor, setCalisiyor] = useState(false)
  const [hata, setHata] = useState('')
  const aiVar = !!apiAnahtari()

  useEffect(() => {
    if (sohbet.length) alt.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [sohbet.length, soruyor])

  if (r === undefined) return null
  if (!r) return <Header title="Tarif bulunamadı" back />

  const sohbetSor = async () => {
    const soru = istek.trim()
    if (!soru) return
    setHata('')
    const yeni: SohbetMesaji[] = [...sohbet, { rol: 'sen', metin: soru }]
    setSohbet(yeni)
    setIstek('')
    setSoruyor(true)
    try {
      const cevap = await aiTarifSohbet(r, yeni, profilMetni(sofralar))
      setSohbet([...yeni, { rol: 'ai', metin: cevap || 'Cevap alınamadı, tekrar sorar mısın?' }])
    } catch (e) {
      setHata((e as Error).message)
      setSohbet(sohbet)
      setIstek(soru)
    }
    setSoruyor(false)
  }

  // Sohbette kararlastirilanlar (+ kutuda yazan son istek) tarife uygulanir
  const sor = async () => {
    setHata('')
    setSonuc(null)
    setCalisiyor(true)
    const son = istek.trim()
    const talep = konusmaIstegi(sohbet, son)
    try {
      setSonuc(await aiTarifDegistir(r, talep, profilMetni(sofralar)))
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
        <SohbetBalonlari sohbet={sohbet} soruyor={soruyor} />
        <div className="lz-card p-4 space-y-3">
          <div className={`font-semibold ${T_BASLIK}`}>{sohbet.length ? 'Devam et' : 'Tarif hakkında sor ya da ne değişsin yaz'}</div>
          <textarea
            className="lz-input min-h-[90px] text-[15px]"
            placeholder="Örn. Grek yoğurdu bizdeki süzme yoğurt mu? · Şeker yerine stevia (toz) kullanacağım"
            value={istek}
            onChange={(e) => setIstek(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2.5">
            <button className="lz-btn-soft text-sm px-2" disabled={!aiVar || !istek.trim() || soruyor || calisiyor} onClick={() => void sohbetSor()}>
              {soruyor ? 'Soruluyor…' : '💬 Sor'}
            </button>
            <button
              className="lz-btn-primary text-sm px-2"
              disabled={!aiVar || (!istek.trim() && !sohbet.length) || calisiyor || soruyor}
              onClick={() => void sor()}
            >
              {calisiyor ? 'Değiştiriliyor…' : '✨ Tarifi değiştir'}
            </button>
          </div>
          <p className={`text-[12px] ${T_SOLUK}`}>
            “Sor” tarifi değiştirmez, sadece konuşursunuz. Karar verince “Tarifi değiştir”e bas; konuşmada anlaştıklarınız tarife uygulanır.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(sohbet.length ? [] : SORULAR).concat(ONERILER).map((o) => (
              <button key={o} onClick={() => setIstek(o)} className="lz-chip text-[12.5px] !whitespace-normal text-left">
                {o}
              </button>
            ))}
          </div>
          {sohbet.length > 0 && (
            <button className={`text-[12.5px] w-full ${T_SOLUK}`} onClick={() => setSohbet([])}>
              Konuşmayı temizle
            </button>
          )}
        </div>
        <div ref={alt} />

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

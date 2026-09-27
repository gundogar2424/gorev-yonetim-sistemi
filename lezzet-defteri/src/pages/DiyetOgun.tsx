import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { listRecipes, lzDb, updateRecipe } from '../db'
import type { LzBesin, LzRecipe } from '../types'
import { Header, T_BASLIK, T_GOVDE, T_SOLUK, Thumb } from '../components/ui'
import { aiOgunEslestir, type OgunUyum } from '../lib/ai'
import { sayiYaz } from '../lib/qty'
import { BesinSatiri } from './Diyetim'

const EN_FAZLA_TARIF = 80

function carp(b: LzBesin, k: number): LzBesin {
  return { kalori: b.kalori * k, protein: b.protein * k, karb: b.karb * k, yag: b.yag * k }
}

// Bir ogunun hedefine defterdeki hangi tariflerin uydugunu gosterir.
export default function DiyetOgun() {
  const i = Number(useParams().i)
  const navigate = useNavigate()
  const plan = useLiveQuery(() => lzDb.diyet.get(1), [])
  const tarifler = useLiveQuery(() => listRecipes(), [], [] as LzRecipe[]) ?? []
  const [sonuc, setSonuc] = useState<OgunUyum[] | null>(null)
  const [calisiyor, setCalisiyor] = useState(false)
  const [hata, setHata] = useState('')
  const [digerAcik, setDigerAcik] = useState(false)
  const basladi = useRef(false)

  const ogun = plan?.ogunler[i]

  const tara = async () => {
    if (!ogun || !plan) return
    setHata('')
    setCalisiyor(true)
    try {
      const aday = tarifler.filter((r) => r.ingredients.length > 0).slice(0, EN_FAZLA_TARIF)
      const s = await aiOgunEslestir(
        ogun,
        plan.notlar,
        aday.map((r) => ({ id: r.id!, baslik: r.title, porsiyon: r.servings, malzemeler: r.ingredients, bilinen: r.besin }))
      )
      // 1 porsiyonun besin degeri tarife kaydedilir (tarif ekraninda gosterilir, sonraki taramada tekrar hesaplanmaz)
      for (const x of s) {
        const r = aday.find((t) => t.id === x.tarifId)
        if (r && !r.besin) await updateRecipe(r.id!, { besin: x.porsiyonBesin })
      }
      setSonuc(s)
    } catch (e) {
      setHata((e as Error).message)
    }
    setCalisiyor(false)
  }

  useEffect(() => {
    if (!basladi.current && ogun && tarifler.length) {
      basladi.current = true
      void tara()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ogun, tarifler.length])

  if (plan === undefined) return null
  if (!ogun) return <Header title="Öğün bulunamadı" back />

  const tarifMap = new Map(tarifler.map((r) => [r.id!, r]))
  const grup = (d: OgunUyum['durum']) => (sonuc ?? []).filter((x) => x.durum === d && tarifMap.has(x.tarifId))

  const yeniTarif = () =>
    navigate('/ne-pisirsem', {
      state: {
        istek: `${ogun.ad} öğünüm için tarif. Diyetisyenimin planı: ${ogun.icerik}. Hedef yaklaşık ${ogun.hedef.kalori} kcal, protein ${ogun.hedef.protein} g, karbonhidrat ${ogun.hedef.karb} g, yağ ${ogun.hedef.yag} g. Tek porsiyonluk yaz.`
      }
    })

  return (
    <div>
      <Header title={ogun.ad} subtitle="Uygun tarifler" back />
      <div className="px-4 space-y-3 pb-8">
        <div className="lz-card p-4 space-y-2">
          <div className="lz-label">Diyetisyeninin planı</div>
          <p className={`text-[14px] ${T_GOVDE}`}>{ogun.icerik}</p>
          <BesinSatiri b={ogun.hedef} />
        </div>

        {calisiyor && (
          <div className={`lz-card p-6 text-center text-sm ${T_SOLUK}`}>
            🔎 {tarifler.length} tarif bu öğünün hedefiyle karşılaştırılıyor…
          </div>
        )}
        {hata && <div className="rounded-2xl bg-rose-50 dark:bg-[#2a1a1d] text-rose-700 dark:text-rose-300 text-sm p-3.5">⚠️ {hata}</div>}
        {tarifler.length === 0 && <div className={`lz-card p-6 text-center text-sm ${T_SOLUK}`}>Defterde henüz tarif yok.</div>}

        {sonuc && (
          <>
            <Bolum baslik="✅ Uygun" liste={grup('uygun')} tarifMap={tarifMap} />
            <Bolum baslik="⚖️ Porsiyonu ayarlarsan uygun" liste={grup('ayarla')} tarifMap={tarifMap} />
            {grup('uygun').length + grup('ayarla').length === 0 && (
              <div className={`lz-card p-5 text-center text-sm ${T_GOVDE}`}>Defterinde bu öğüne uyan tarif bulunamadı.</div>
            )}
            {grup('uygun_degil').length > 0 && (
              <>
                <button className={`text-[13px] w-full py-1 ${T_SOLUK}`} onClick={() => setDigerAcik(!digerAcik)}>
                  {digerAcik ? '▲' : '▼'} Uygun olmayanlar ({grup('uygun_degil').length})
                </button>
                {digerAcik && <Bolum baslik="" liste={grup('uygun_degil')} tarifMap={tarifMap} soluk />}
              </>
            )}
          </>
        )}

        <button className="lz-btn-soft w-full" onClick={yeniTarif}>
          ✨ Bu öğüne göre yeni tarif öner
        </button>
        {sonuc && (
          <button className={`text-[13px] w-full ${T_SOLUK}`} disabled={calisiyor} onClick={() => void tara()}>
            ↻ Yeniden karşılaştır
          </button>
        )}
        <p className={`text-[11.5px] text-center px-2 ${T_SOLUK}`}>
          Değerler yapay zekanın tahminidir; tartılmış değildir. Son karar diyetisyenine aittir.
        </p>
      </div>
    </div>
  )
}

function Bolum({ baslik, liste, tarifMap, soluk }: { baslik: string; liste: OgunUyum[]; tarifMap: Map<number, LzRecipe>; soluk?: boolean }) {
  if (!liste.length) return null
  return (
    <div className="space-y-2">
      {baslik && <div className="lz-label px-1 pt-1">{baslik} · {liste.length}</div>}
      {liste.map((x) => {
        const r = tarifMap.get(x.tarifId)!
        const toplam = carp(x.porsiyonBesin, x.carpan)
        return (
          <Link key={x.tarifId} to={`/tarif/${r.id}`} className={`lz-card p-3 flex gap-3 ${soluk ? 'opacity-70' : ''}`}>
            <Thumb src={r.photo} className="w-16 h-16 rounded-2xl" />
            <div className="flex-1 min-w-0 space-y-1">
              <div className={`font-semibold leading-snug ${T_BASLIK}`}>{r.title}</div>
              <div className={`text-[12.5px] font-semibold text-lz-600`}>
                {x.carpan === 1 ? '1 porsiyon' : `${sayiYaz(x.carpan)} porsiyon`}
                {r.servings ? ` (tarif ${r.servings} kişilik)` : ''}
              </div>
              <BesinSatiri b={toplam} kucuk />
              <p className={`text-[12px] ${T_SOLUK}`}>{x.aciklama}</p>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

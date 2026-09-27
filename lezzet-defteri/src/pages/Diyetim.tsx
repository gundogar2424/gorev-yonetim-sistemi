import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { lzDb } from '../db'
import type { LzBesin, LzDiyet } from '../types'
import { Header, T_BASLIK, T_GOVDE, T_SOLUK } from '../components/ui'
import { aiDiyetOku, apiAnahtari } from '../lib/ai'
import { fotoOku } from '../lib/image'

export function BesinSatiri({ b, kucuk }: { b: LzBesin; kucuk?: boolean }) {
  return (
    <div className={`flex flex-wrap gap-1.5 ${kucuk ? 'text-[11.5px]' : 'text-[12.5px]'}`}>
      <span className="lz-pill">{Math.round(b.kalori)} kcal</span>
      <span className="lz-pill !bg-sky-50 !text-sky-700 dark:!bg-[#12263a] dark:!text-sky-300">P {Math.round(b.protein)} g</span>
      <span className="lz-pill !bg-amber-50 !text-amber-700 dark:!bg-[#2a2113] dark:!text-amber-300">K {Math.round(b.karb)} g</span>
      <span className="lz-pill !bg-violet-50 !text-violet-700 dark:!bg-[#231a33] dark:!text-violet-300">Y {Math.round(b.yag)} g</span>
    </div>
  )
}

// DIYETIM: diyetisyenin plani ogunlere ayrilmis olarak durur; her ogunden
// "uygun tarifleri bul" ile defterdeki tarifler karsilastirilir.
export default function Diyetim() {
  const plan = useLiveQuery(() => lzDb.diyet.get(1), [])
  const [duzenle, setDuzenle] = useState(false)

  const planVar = !!plan && plan.ogunler.length > 0

  return (
    <div>
      <Header title="Diyetim" subtitle={planVar ? `Günlük ~${plan!.gunlukKalori} kcal · ${plan!.ogunler.length} öğün` : 'Diyetisyeninin planı'} back />
      <div className="px-4 space-y-3 pb-8">
        {!planVar || duzenle ? (
          <PlanYukle onBitti={() => setDuzenle(false)} iptal={planVar ? () => setDuzenle(false) : undefined} />
        ) : (
          <>
            {plan!.ogunler.map((o, i) => (
              <div key={i} className="lz-card p-4 space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <div className={`font-bold text-[17px] ${T_BASLIK}`}>{o.ad}</div>
                  {o.tahmini && <span className={`text-[11px] ${T_SOLUK}`}>tahmini hedef</span>}
                </div>
                <p className={`text-[14px] leading-relaxed whitespace-pre-line ${T_GOVDE}`}>{o.icerik}</p>
                <BesinSatiri b={o.hedef} />
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <Link to={`/diyet/${i}`} className="lz-btn-primary text-[13px] px-2">
                    🔎 Defterimde ara
                  </Link>
                  <Link to="/ne-pisirsem" state={{ ogun: i }} className="lz-btn-soft text-[13px] px-2">
                    🥕 Elimdekilerle tarif
                  </Link>
                </div>
              </div>
            ))}
            {plan!.notlar && (
              <div className="lz-card p-4">
                <div className="lz-label mb-1">Planın kuralları</div>
                <p className={`text-[13.5px] whitespace-pre-line ${T_GOVDE}`}>{plan!.notlar}</p>
              </div>
            )}
            <button className="lz-btn-soft w-full text-sm" onClick={() => setDuzenle(true)}>
              Planı değiştir / yeniden yükle
            </button>
          </>
        )}
        <p className={`text-[11.5px] text-center px-2 ${T_SOLUK}`}>
          Kalori ve makrolar yapay zekanın tahminidir; tartılmış değerler değildir. Son karar her zaman diyetisyenine aittir.
        </p>
      </div>
    </div>
  )
}

function PlanYukle({ onBitti, iptal }: { onBitti: () => void; iptal?: () => void }) {
  const [metin, setMetin] = useState('')
  const [yukleniyor, setYukleniyor] = useState('')
  const [hata, setHata] = useState('')
  const dosya = useRef<HTMLInputElement>(null)
  const aiVar = !!apiAnahtari()

  const kaydet = async (girdi: { metin?: string; foto?: string }) => {
    setHata('')
    setYukleniyor('Plan okunuyor…')
    try {
      const v = await aiDiyetOku(girdi)
      const kayit: LzDiyet = { id: 1, ogunler: v.ogunler, notlar: v.notlar, gunlukKalori: v.gunlukKalori, guncelleme: Date.now() }
      await lzDb.diyet.put(kayit)
      onBitti()
    } catch (e) {
      setHata((e as Error).message)
    }
    setYukleniyor('')
  }

  return (
    <div className="lz-card p-4 space-y-3">
      <div className={`font-semibold ${T_BASLIK}`}>Diyetisyeninin planını yükle</div>
      <p className={`text-[13px] ${T_SOLUK}`}>
        Planın fotoğrafını çek ya da yazısını yapıştır. Yapay zeka öğünlere (kahvaltı, ara öğün, öğle, akşam) ayırır; kalori ve makrolar
        planda yazıyorsa onları, yazmıyorsa tahminini kullanır.
      </p>
      {!aiVar && (
        <p className="text-[12.5px] text-rose-600 dark:text-rose-300">
          Bunun için{' '}
          <Link to="/ayarlar" className="underline font-semibold">
            Ayarlar
          </Link>
          ’dan Gemini anahtarı gerekli.
        </p>
      )}
      <input
        ref={dosya}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void kaydet({ foto: await fotoOku(f, 1800, 0.88) })
        }}
      />
      <button className="lz-btn-primary w-full" disabled={!aiVar || !!yukleniyor} onClick={() => dosya.current?.click()}>
        {yukleniyor || '📷 Planın fotoğrafını seç'}
      </button>
      <div className={`text-center text-[12px] ${T_SOLUK}`}>ya da</div>
      <textarea
        className="lz-input min-h-[140px] text-[14px]"
        placeholder={'Planın yazısını buraya yapıştır\n(Kahvaltı: 1 yumurta, 2 dilim tam buğday ekmeği…)'}
        value={metin}
        onChange={(e) => setMetin(e.target.value)}
      />
      <button className="lz-btn-soft w-full" disabled={!aiVar || !!yukleniyor || metin.trim().length < 10} onClick={() => void kaydet({ metin })}>
        {yukleniyor || 'Yazıdan oku'}
      </button>
      {hata && <div className="rounded-2xl bg-rose-50 dark:bg-[#2a1a1d] text-rose-700 dark:text-rose-300 text-sm p-3">⚠️ {hata}</div>}
      {iptal && (
        <button className={`text-[13px] w-full ${T_SOLUK}`} onClick={iptal}>
          Vazgeç
        </button>
      )}
    </div>
  )
}

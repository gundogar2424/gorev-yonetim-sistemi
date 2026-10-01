import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { listRecipes, lzDb } from '../db'
import type { LzBesin, LzDiyet, LzDiyetOgun, LzRecipe } from '../types'
import { Header, T_BASLIK, T_GOVDE, T_SOLUK, Thumb } from '../components/ui'
import { aiDiyetOku, apiAnahtari, type OgunUyum } from '../lib/ai'
import { ogunTara, tumOgunleriTara, useTaramaDurumu, yeniTarifSayisi } from '../lib/diyetTara'
import { sayiYaz } from '../lib/qty'
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

function carp(b: LzBesin, k: number): LzBesin {
  return { kalori: b.kalori * k, protein: b.protein * k, karb: b.karb * k, yag: b.yag * k }
}

// DIYETIM: diyetisyenin plani ogunlere ayrilir; her ogun ayri sekmede ve
// defterdeki o ogune uyan tarifler kendiliginden listelenir.
export default function Diyetim() {
  const param = useParams().i
  const navigate = useNavigate()
  const plan = useLiveQuery(() => lzDb.diyet.get(1), [])
  const tarifler = useLiveQuery(() => listRecipes(), [], [] as LzRecipe[]) ?? []
  const [duzenle, setDuzenle] = useState(false)
  const sekme = param === 'plan' ? -1 : Number(param ?? 0) || 0
  const sekmeRef = useRef<HTMLDivElement>(null)

  const planVar = !!plan && plan.ogunler.length > 0

  useEffect(() => {
    sekmeRef.current?.querySelector('[data-secili="1"]')?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [sekme, planVar])

  const sec = (i: number) => navigate(i < 0 ? '/diyet/plan' : `/diyet/${i}`, { replace: true })

  return (
    <div>
      <Header title="Diyetim" subtitle={planVar ? `Günlük ~${plan!.gunlukKalori} kcal · ${plan!.ogunler.length} öğün` : 'Diyetisyeninin planı'} back />
      {planVar && !duzenle && (
        <div ref={sekmeRef} className="flex gap-2 overflow-x-auto px-4 pb-3 -mt-1 no-scrollbar">
          {plan!.ogunler.map((o, i) => {
            const e = plan!.eslesme?.[i]
            const n = e ? e.sonuc.filter((x) => x.durum !== 'uygun_degil' && tarifler.some((r) => r.id === x.tarifId)).length : 0
            return (
              <button
                key={i}
                data-secili={sekme === i ? '1' : '0'}
                onClick={() => sec(i)}
                className={`lz-chip whitespace-nowrap flex-shrink-0 ${sekme === i ? '!bg-lz-600 !text-white !border-lz-600' : ''}`}
              >
                {o.ad}
                {n > 0 && <span className={`ml-1.5 text-[11px] font-bold ${sekme === i ? 'text-white/85' : 'text-lz-600'}`}>{n}</span>}
              </button>
            )
          })}
          <button
            data-secili={sekme === -1 ? '1' : '0'}
            onClick={() => sec(-1)}
            className={`lz-chip whitespace-nowrap flex-shrink-0 ${sekme === -1 ? '!bg-lz-600 !text-white !border-lz-600' : ''}`}
          >
            📋 Plan
          </button>
        </div>
      )}
      <div className="px-4 space-y-3 pb-8">
        {planVar && !duzenle && <KontrolSeridi plan={plan!} tarifler={tarifler} />}
        {!planVar || duzenle ? (
          <PlanYukle
            onBitti={() => {
              setDuzenle(false)
              sec(0)
              void tumOgunleriTara()
            }}
            iptal={planVar ? () => setDuzenle(false) : undefined}
          />
        ) : sekme === -1 || !plan!.ogunler[sekme] ? (
          <>
            {plan!.ogunler.map((o, i) => (
              <button key={i} onClick={() => sec(i)} className="lz-card p-4 space-y-2 w-full text-left block">
                <div className={`font-bold text-[16px] ${T_BASLIK}`}>{o.ad}</div>
                <p className={`text-[14px] leading-relaxed whitespace-pre-line ${T_GOVDE}`}>{o.icerik}</p>
                <BesinSatiri b={o.hedef} />
              </button>
            ))}
            {plan!.notlar && (
              <div className="lz-card p-4">
                <div className="lz-label mb-1">Planın kuralları</div>
                <p className={`text-[13.5px] whitespace-pre-line ${T_GOVDE}`}>{plan!.notlar}</p>
              </div>
            )}
            <OgunEkle
              onEklendi={(i) => {
                sec(i)
                void ogunTara(i)
              }}
            />
            <button className="lz-btn-soft w-full text-sm" onClick={() => setDuzenle(true)}>
              Planı değiştir / yeniden yükle
            </button>
            <p className={`text-[11.5px] text-center px-2 ${T_SOLUK}`}>
              Yeni liste yükleyince tüm öğünler hemen baştan karşılaştırılır. Sonra eklediğin tarifler arka planda kendiliğinden eklenir.
            </p>
          </>
        ) : (
          <OgunSekmesi i={sekme} plan={plan!} tarifler={tarifler} />
        )}
        <p className={`text-[11.5px] text-center px-2 ${T_SOLUK}`}>
          Kalori ve makrolar yapay zekanın tahminidir; tartılmış değerler değildir. Son karar her zaman diyetisyenine aittir.
        </p>
      </div>
    </div>
  )
}

// Tum ogunlerde yeni (henuz karsilastirilmamis) tarifleri tek dokunusla kontrol eder
function KontrolSeridi({ plan, tarifler }: { plan: LzDiyet; tarifler: LzRecipe[] }) {
  const durum = useTaramaDurumu()
  const aiVar = !!apiAnahtari()
  const adaylar = tarifler.filter((r) => r.ingredients.length > 0).map((r) => r.id!)
  const eksik = plan.ogunler.map((_, i) => yeniTarifSayisi(plan.eslesme?.[i], adaylar))
  const enCok = Math.max(0, ...eksik)
  const calisan = plan.ogunler.some((_, i) => durum[i]?.calisiyor)
  if (!aiVar || !adaylar.length) return null
  const kontrol = async () => {
    for (let i = 0; i < plan.ogunler.length; i++) if (eksik[i] > 0) await ogunTara(i)
  }
  return (
    <div className="lz-card p-3 flex items-center gap-3">
      <span className={`text-lg ${calisan ? 'animate-pulse' : ''}`}>{calisan ? '🔎' : enCok ? '🆕' : '✅'}</span>
      <span className={`flex-1 text-[13px] ${T_GOVDE}`}>
        {calisan
          ? 'Tarifler öğünlerle karşılaştırılıyor…'
          : enCok
            ? `${enCok} yeni tarif henüz öğünlerle karşılaştırılmadı`
            : 'Tüm tarifler öğünlerle karşılaştırıldı'}
      </span>
      <button className={`${enCok ? 'lz-btn-primary' : 'lz-btn-soft'} px-3 py-2 text-[12.5px] whitespace-nowrap`} disabled={calisan || !enCok} onClick={() => void kontrol()}>
        {enCok ? 'Kontrol et' : 'Güncel'}
      </button>
    </div>
  )
}

function OgunSekmesi({ i, plan, tarifler }: { i: number; plan: LzDiyet; tarifler: LzRecipe[] }) {
  const ogun = plan.ogunler[i]
  const e = plan.eslesme?.[i]
  const d = useTaramaDurumu()[i] ?? { calisiyor: false, hata: '' }
  const [digerAcik, setDigerAcik] = useState(false)
  const aiVar = !!apiAnahtari()
  const adaylar = tarifler.filter((r) => r.ingredients.length > 0).map((r) => r.id!)
  const yeni = yeniTarifSayisi(e, adaylar)

  // Sekme acilinca taranmamis tarif varsa kendiliginden karsilastir
  useEffect(() => {
    if (aiVar && yeni > 0 && !d.calisiyor && !d.hata) void ogunTara(i)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, yeni, aiVar])

  const tarifMap = new Map(tarifler.map((r) => [r.id!, r]))
  const grup = (x: OgunUyum['durum']) =>
    (e?.sonuc ?? []).filter((s) => s.durum === x && tarifMap.has(s.tarifId)).sort((a, b) => Math.abs(1 - a.carpan) - Math.abs(1 - b.carpan))

  return (
    <>
      <div className="lz-card p-4 space-y-2">
        <div className="lz-label">Diyetisyeninin planı</div>
        <p className={`text-[14px] leading-relaxed whitespace-pre-line ${T_GOVDE}`}>{ogun.icerik}</p>
        <BesinSatiri b={ogun.hedef} />
      </div>

      {!aiVar && (
        <div className="rounded-2xl bg-amber-50 dark:bg-[#2a2113] text-amber-800 dark:text-amber-200 text-[13px] p-3.5">
          Tarifleri karşılaştırmak için{' '}
          <Link to="/ayarlar" className="font-semibold underline">
            Ayarlar
          </Link>
          ’dan Gemini anahtarı gerekli.
        </div>
      )}
      {d.calisiyor && (
        <div className={`lz-card p-4 text-center text-sm ${T_SOLUK}`}>
          🔎 {e ? `${yeni} yeni tarif` : `${adaylar.length} tarif`} bu öğünün hedefiyle karşılaştırılıyor…
        </div>
      )}
      {d.hata && (
        <div className="rounded-2xl bg-rose-50 dark:bg-[#2a1a1d] text-rose-700 dark:text-rose-300 text-sm p-3.5 space-y-2">
          <div>⚠️ {d.hata}</div>
          <button className="lz-btn-primary w-full text-sm" onClick={() => void ogunTara(i)}>
            ↻ Tekrar dene
          </button>
        </div>
      )}
      {tarifler.length === 0 && <div className={`lz-card p-6 text-center text-sm ${T_SOLUK}`}>Defterde henüz tarif yok.</div>}

      {e && (
        <>
          <Bolum baslik="✅ Uygun" liste={grup('uygun')} tarifMap={tarifMap} />
          <Bolum baslik="⚖️ Porsiyonu ayarlarsan uygun" liste={grup('ayarla')} tarifMap={tarifMap} />
          {grup('uygun').length + grup('ayarla').length === 0 && !d.calisiyor && tarifler.length > 0 && (
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

      <Link to="/ne-pisirsem" state={{ ogun: i }} className="lz-btn-soft w-full">
        🥕 Elimdeki malzemelerle bu öğüne tarif
      </Link>
      {e && aiVar && (
        <>
          <button className="lz-btn-soft w-full text-sm" disabled={d.calisiyor || yeni === 0} onClick={() => void ogunTara(i)}>
            {yeni ? `↻ Yenile — sadece ${yeni} yeni tarifi ekle` : '✓ Tüm tarifler karşılaştırıldı'}
          </button>
          <button
            className={`text-[12.5px] w-full ${T_SOLUK}`}
            disabled={d.calisiyor}
            onClick={() => confirm('Bu öğün için tüm tarifler baştan karşılaştırılsın mı? (Daha çok yapay zeka kullanır)') && void ogunTara(i, true)}
          >
            Hepsini baştan karşılaştır
          </button>
        </>
      )}
    </>
  )
}

function Bolum({ baslik, liste, tarifMap, soluk }: { baslik: string; liste: OgunUyum[]; tarifMap: Map<number, LzRecipe>; soluk?: boolean }) {
  if (!liste.length) return null
  return (
    <div className="space-y-2">
      {baslik && (
        <div className="lz-label px-1 pt-1">
          {baslik} · {liste.length}
        </div>
      )}
      {liste.map((x) => {
        const r = tarifMap.get(x.tarifId)!
        const toplam = carp(x.porsiyonBesin, x.carpan)
        return (
          <Link key={x.tarifId} to={`/tarif/${r.id}`} className={`lz-card p-3 flex gap-3 ${soluk ? 'opacity-70' : ''}`}>
            <Thumb src={r.photo} className="w-16 h-16 rounded-2xl" />
            <div className="flex-1 min-w-0 space-y-1">
              <div className={`font-semibold leading-snug ${T_BASLIK}`}>{r.title}</div>
              <div className="text-[12.5px] font-semibold text-lz-600">
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

// Plana tek bir ogun ekler; yalnizca bu ogun icin tarifler taranir.
function OgunEkle({ onEklendi }: { onEklendi: (i: number) => void }) {
  const [acik, setAcik] = useState(false)
  const [ad, setAd] = useState('')
  const [icerik, setIcerik] = useState('')
  const [calisiyor, setCalisiyor] = useState(false)
  const [hata, setHata] = useState('')
  const aiVar = !!apiAnahtari()

  if (!acik)
    return (
      <button className="lz-btn-primary w-full text-sm" onClick={() => setAcik(true)}>
        ➕ Öğün ekle
      </button>
    )

  const ekle = async () => {
    setHata('')
    setCalisiyor(true)
    try {
      const v = await aiDiyetOku({ metin: `${ad.trim()}: ${icerik.trim()}\n(Bu tek bir öğündür, tek öğün olarak döndür.)` })
      const o = v.ogunler[0]
      const plan = await lzDb.diyet.get(1)
      if (!plan) return
      const yeni: LzDiyetOgun = { ...o, ad: ad.trim() || o.ad, icerik: icerik.trim() }
      const ogunler = [...plan.ogunler, yeni]
      // guncelleme degismez: diger ogunlerin sonuclari ve suren taramalar gecerli kalir
      await lzDb.diyet.update(1, { ogunler, gunlukKalori: Math.round(plan.gunlukKalori + (o.hedef?.kalori ?? 0)) })
      setAcik(false)
      setAd('')
      setIcerik('')
      onEklendi(ogunler.length - 1)
    } catch (e) {
      setHata((e as Error).message)
    }
    setCalisiyor(false)
  }

  return (
    <div className="lz-card p-4 space-y-2.5">
      <div className={`font-semibold ${T_BASLIK}`}>Yeni öğün</div>
      <input className="lz-input" placeholder="Öğün adı (ör. Gece ara öğün)" value={ad} onChange={(e) => setAd(e.target.value)} />
      <textarea
        className="lz-input min-h-[80px] text-[14px]"
        placeholder="Diyetisyenin yazdığı içerik (ör. 1 kase yoğurt, 2 ceviz)"
        value={icerik}
        onChange={(e) => setIcerik(e.target.value)}
      />
      {hata && <div className="rounded-2xl bg-rose-50 dark:bg-[#2a1a1d] text-rose-700 dark:text-rose-300 text-sm p-3">⚠️ {hata}</div>}
      <div className="grid grid-cols-2 gap-2.5">
        <button className="lz-btn-soft text-sm" onClick={() => setAcik(false)}>
          Vazgeç
        </button>
        <button className="lz-btn-primary text-sm" disabled={!aiVar || !ad.trim() || !icerik.trim() || calisiyor} onClick={() => void ekle()}>
          {calisiyor ? 'Ekleniyor…' : 'Ekle'}
        </button>
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
      // Yeni liste: tum ogunler bastan karsilastirilir (onceki sonuclar silinir)
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

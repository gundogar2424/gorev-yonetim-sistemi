import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import DietHeader from '../DietHeader'
import { dietDb, readDietSettings } from '../db'
import { decodeBarcodeFromImage, lookupProduct, forGrams, startLiveScan, nativeScan, getSavedProduct, saveProduct, type ProductInfo, type ScannerControls } from '../lib/barcode'
import { fileToResizedDataUrl } from '../../lib/image'
import { MEAL_OPTIONS, guessMeal } from '../lib/meals'
import { analyzeFoodByText } from '../ai'
import { buildHealthContext } from '../lib/context'
import { todayStr } from '../streak'
import type { MealType, Decision, FoodAnalysis } from '../types'

export default function Barcode() {
  const navigate = useNavigate()
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const [code, setCode] = useState('')
  const [product, setProduct] = useState<ProductInfo | null>(null)
  const [grams, setGrams] = useState('100')
  const [mealType, setMealType] = useState<MealType>(guessMeal())
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [scanning, setScanning] = useState(false)
  const [confirmed, setConfirmed] = useState(false) // urunu gorup onayladi mi
  const [saved, setSaved] = useState(false) // gunluge eklendi mi
  const [notFound, setNotFound] = useState(false) // veritabaninda yok -> elle gir
  const [man, setMan] = useState({ name: '', kcal: '', protein: '', carb: '', fat: '' }) // elle giris
  const [advice, setAdvice] = useState<FoodAnalysis | null>(null) // "yemeli miyim?" degerlendirmesi
  const [advising, setAdvising] = useState(false)
  const settings = useLiveQuery(() => readDietSettings(), [], undefined)
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerRef = useRef<ScannerControls | null>(null)

  // Canli tarama: scanning acilinca kamerayi baslat, kapaninca/cikinca durdur
  useEffect(() => {
    if (!scanning) return
    const el = videoRef.current
    if (!el) return
    let active = true
    startLiveScan(
      el,
      (c) => {
        setScanning(false)
        setCode(c)
        void search(c)
      },
      (m) => {
        setMsg(m)
        setScanning(false)
      }
    ).then((ctrl) => {
      if (active) scannerRef.current = ctrl
      else ctrl.stop()
    })
    return () => {
      active = false
      scannerRef.current?.stop()
      scannerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning])

  const g = Math.max(0, Number(grams) || 0)
  const vals = product ? forGrams(product, g) : null

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setMsg('')
    setBusy(true)
    try {
      const dataUrl = await fileToResizedDataUrl(file, 1200, 0.9)
      const found = await decodeBarcodeFromImage(dataUrl)
      if (!found) {
        setMsg('Barkod okunamadı. Daha net, yakından çek ya da numarayı elle yaz.')
        return
      }
      setCode(found)
      await search(found)
    } catch {
      setMsg('Fotoğraf işlenemedi.')
    } finally {
      setBusy(false)
    }
  }

  // Canli tara: APK'da native (ML Kit) tarayici, web'de video tarayici
  async function liveScan() {
    setMsg('')
    try {
      const { Capacitor } = await import('@capacitor/core')
      if (Capacitor.isNativePlatform()) {
        setBusy(true)
        const c = await nativeScan()
        setBusy(false)
        if (c) {
          setCode(c)
          await search(c)
        } else {
          setMsg('Barkod okunamadı, tekrar dene.')
        }
        return
      }
    } catch (e) {
      setBusy(false)
      setMsg(e instanceof Error ? e.message : 'Tarayıcı açılamadı.')
      return
    }
    setScanning(true) // web: kamera video tarayici
  }

  async function search(barcode?: string) {
    const c = (barcode ?? code).trim()
    if (!c) return
    setMsg('')
    setBusy(true)
    setProduct(null)
    setConfirmed(false)
    setSaved(false)
    setNotFound(false)
    try {
      // 1) Once hafiza (daha once elle girdiklerim)
      const local = await getSavedProduct(c)
      if (local) {
        setProduct(local)
        return
      }
      // 2) Open Food Facts
      const p = await lookupProduct(c)
      if (!p) {
        // 3) Bulunamadi -> elle gir
        setCode(c)
        setMan({ name: '', kcal: '', protein: '', carb: '', fat: '' })
        setNotFound(true)
      } else {
        setProduct(p)
        if (!p.per100.kcal) setMsg('Üründe kalori bilgisi yok; istersen elle düzeltebilirsin.')
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Sorgu başarısız.')
    } finally {
      setBusy(false)
    }
  }

  // Elle girilen urunu hafizaya kaydet ve kullan
  async function useManual() {
    const name = man.name.trim()
    const kcal = Math.max(0, Number(man.kcal) || 0)
    if (!name || !kcal) {
      setMsg('En az ürün adı ve 100 g/ml kalorisi gerekli.')
      return
    }
    const info: ProductInfo = {
      barcode: code.trim() || `manuel-${Date.now()}`,
      name,
      per100: {
        kcal,
        protein: Math.max(0, Number(man.protein) || 0),
        carb: Math.max(0, Number(man.carb) || 0),
        fat: Math.max(0, Number(man.fat) || 0)
      }
    }
    try {
      await saveProduct(info)
    } catch {
      // hafizaya yazilamasa bile kullanmaya devam
    }
    setNotFound(false)
    setProduct(info)
    setMsg('')
  }

  // "Yemeli miyim?" — ürünün besin değerlerini koça danış (yazıdan değerlendirir)
  async function consult() {
    if (!product || !vals || !settings?.apiKey) return
    setAdvising(true)
    setAdvice(null)
    setMsg('')
    try {
      const note = `Paketli ürün: ${product.name}. Miktar: ${g} g/ml. Bu porsiyonun besin değerleri: ~${vals.kcal} kcal, protein ${vals.protein} g, karbonhidrat ${vals.carb} g, yağ ${vals.fat} g. Bunu yemeli miyim, diyetimi bozar mı?`
      const res = await analyzeFoodByText({
        apiKey: settings.apiKey,
        note,
        model: settings.model,
        userName: settings.userName,
        goal: settings.goal,
        dietPlan: settings.dietPlan,
        dietitianNotes: settings.dietitianNotes,
        health: await buildHealthContext(settings)
      })
      setAdvice(res)
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Değerlendirilemedi.')
    } finally {
      setAdvising(false)
    }
  }

  // Karar ver (yedim/vazgectim) ve gunluge kaydet. Danisildiysa degerlendirme
  // alanlari (saglik/uyum/puan) da kaydedilir; danisilmadiysa notr.
  async function decide(decision: Decision) {
    if (!product || !vals) return
    const a = advice
    await dietDb.entries.add({
      foodFound: true,
      foodName: `${product.name} (${g} g)`,
      healthy: a ? a.healthy : true,
      riskLevel: a ? a.riskLevel : 'orta',
      estimatedCalories: vals.kcal,
      protein: vals.protein,
      carb: vals.carb,
      fat: vals.fat,
      dietScore: a ? a.dietScore : 0,
      scoreReason: a ? a.scoreReason : '',
      harms: a ? a.harms : [],
      motivations: a ? a.motivations : [],
      healthierAlternative: a ? a.healthierAlternative : '',
      verdict: a ? a.verdict : `Protein ${vals.protein}g · Karb ${vals.carb}g · Yağ ${vals.fat}g`,
      compliancePercent: a ? a.compliancePercent : -1,
      complianceNote: a ? a.complianceNote : '',
      cravingPortion: a ? a.cravingPortion : '',
      cravingNote: a ? a.cravingNote : '',
      photo: '',
      decision,
      mealType,
      createdAt: Date.now(),
      dateStr: todayStr()
    })
    setSaved(true)
  }

  // Yeni barkoda hazirlan (sifirla)
  function resetAll() {
    setProduct(null)
    setConfirmed(false)
    setSaved(false)
    setNotFound(false)
    setCode('')
    setGrams('100')
    setMsg('')
    setAdvice(null)
    setAdvising(false)
  }

  return (
    <div>
      <DietHeader title="Barkod" subtitle="Paketli ürünü okut, kalori/makro öğren" />

      <div className="p-3 space-y-4">
        {/* Barkod gir / okut */}
        <section className="card p-4 space-y-3">
          {/* Canli tarama (kamera acik) */}
          {scanning && (
            <div className="space-y-2">
              <div className="relative rounded-xl overflow-hidden bg-black">
                <video ref={videoRef} className="w-full max-h-72 object-cover" autoPlay muted playsInline />
                <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 h-0.5 bg-rose-500/80" />
              </div>
              <p className="text-center text-xs text-slate-500">Barkodu çerçeveye getir, kendi okur.</p>
              <button onClick={() => setScanning(false)} className="btn bg-slate-200 text-slate-700 w-full">
                Durdur
              </button>
            </div>
          )}

          {!scanning && (
            <button onClick={liveScan} disabled={busy} className="btn-primary w-full">
              📹 Canlı Tara (kamerayı aç)
            </button>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => cameraRef.current?.click()} disabled={busy} className="btn bg-slate-200 text-slate-700 hover:bg-slate-300">
              📷 Foto Çek
            </button>
            <button
              onClick={() => galleryRef.current?.click()}
              disabled={busy}
              className="btn bg-slate-200 text-slate-700 hover:bg-slate-300"
            >
              🖼️ Galeriden Seç
            </button>
          </div>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPhoto} />
          <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={onPhoto} />

          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              className="field-input flex-1"
              placeholder="ya da barkod numarasını yaz"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <button onClick={() => search()} disabled={busy || !code.trim()} className="btn-primary px-5">
              Ara
            </button>
          </div>
          {busy && <p className="text-sm text-emerald-700">İşleniyor…</p>}
          {msg && <p className="text-sm text-slate-600">{msg}</p>}
        </section>

        {/* Bulunamadi -> elle gir (hafizaya alinir) */}
        {notFound && !product && (
          <section className="card p-4 space-y-3 border-amber-200">
            <p className="text-sm text-amber-800 font-semibold">
              Bu ürün veritabanında yok. Bilgilerini bir kez gir; bu barkodu hafızaya alayım, bir daha sormayayım.
            </p>
            <input
              className="field-input"
              placeholder="Ürün adı (örn. X marka bisküvi)"
              value={man.name}
              onChange={(e) => setMan({ ...man, name: e.target.value })}
            />
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">100 g/ml için (paketin arkasından)</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-sm text-slate-600">
                Kalori (kcal)
                <input type="number" inputMode="numeric" className="field-input" value={man.kcal} onChange={(e) => setMan({ ...man, kcal: e.target.value })} />
              </label>
              <label className="text-sm text-slate-600">
                Protein (g)
                <input type="number" inputMode="numeric" className="field-input" value={man.protein} onChange={(e) => setMan({ ...man, protein: e.target.value })} />
              </label>
              <label className="text-sm text-slate-600">
                Karbonhidrat (g)
                <input type="number" inputMode="numeric" className="field-input" value={man.carb} onChange={(e) => setMan({ ...man, carb: e.target.value })} />
              </label>
              <label className="text-sm text-slate-600">
                Yağ (g)
                <input type="number" inputMode="numeric" className="field-input" value={man.fat} onChange={(e) => setMan({ ...man, fat: e.target.value })} />
              </label>
            </div>
            <button onClick={useManual} className="btn-primary w-full">
              Kaydet ve kullan
            </button>
            <button onClick={resetAll} className="w-full text-center text-sm text-slate-400 py-1">
              Vazgeç
            </button>
          </section>
        )}

        {/* Eklendi ekrani */}
        {saved && product && (
          <section className="card p-6 text-center space-y-3">
            <div className="text-5xl">✅</div>
            <p className="font-bold text-slate-800">Günlüğe eklendi</p>
            <p className="text-sm text-slate-600">
              {product.name} — {g} g/ml{vals ? ` · ${vals.kcal} kcal` : ''}
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button onClick={() => navigate('/gecmis')} className="btn bg-slate-200 text-slate-700">
                Geçmişi gör
              </button>
              <button onClick={resetAll} className="btn-primary">
                Yeni barkod
              </button>
            </div>
          </section>
        )}

        {/* Sonuc — once bilgi, onaylayinca ogun+miktar */}
        {product && !saved && (
          <section className="card overflow-hidden border-0 shadow-md">
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 text-white px-4 py-3">
              <h2 className="text-lg font-extrabold leading-tight">{product.name}</h2>
              <p className="text-emerald-50 text-xs mt-0.5">Barkod: {product.barcode}</p>
            </div>
            <div className="p-4 space-y-3">
              {/* 100 g/ml icin besin degerleri (bilgi) */}
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">100 g/ml için</p>
              <div className="grid grid-cols-4 gap-2 text-center">
                <Box label="Kalori" value={`${product.per100.kcal}`} unit="kcal" cls="bg-orange-50 text-orange-700" />
                <Box label="Protein" value={`${product.per100.protein}`} unit="g" cls="bg-rose-50 text-rose-700" />
                <Box label="Karb." value={`${product.per100.carb}`} unit="g" cls="bg-amber-50 text-amber-700" />
                <Box label="Yağ" value={`${product.per100.fat}`} unit="g" cls="bg-sky-50 text-sky-700" />
              </div>

              {!confirmed ? (
                /* 1. ADIM: ürünü gör, onayla */
                <>
                  <button onClick={() => setConfirmed(true)} className="btn-primary w-full">
                    ✓ Bu ürünü ekleyeceğim
                  </button>
                  <button onClick={resetAll} className="w-full text-center text-sm text-slate-400 py-1">
                    Bu değil, vazgeç
                  </button>
                </>
              ) : (
                /* 2. ADIM: hangi öğün + ne kadar */
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="text-sm font-semibold text-slate-600">Ne kadar yedin/içtin?</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      className="field-input w-24"
                      value={grams}
                      onChange={(e) => setGrams(e.target.value)}
                    />
                    <span className="text-sm text-slate-500">g / ml</span>
                  </div>

                  {vals && (
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <Box label="Kalori" value={`${vals.kcal}`} unit="kcal" cls="bg-orange-100 text-orange-800" />
                      <Box label="Protein" value={`${vals.protein}`} unit="g" cls="bg-rose-100 text-rose-800" />
                      <Box label="Karb." value={`${vals.carb}`} unit="g" cls="bg-amber-100 text-amber-800" />
                      <Box label="Yağ" value={`${vals.fat}`} unit="g" cls="bg-sky-100 text-sky-800" />
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Hangi öğün?</p>
                    <div className="flex flex-wrap gap-1.5">
                      {MEAL_OPTIONS.map((m) => (
                        <button
                          key={m.value}
                          onClick={() => setMealType(m.value)}
                          className={`text-sm font-semibold rounded-full px-3 py-1.5 ${
                            mealType === m.value ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {m.emoji} {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Yemeli miyim? — önce koça danış, sonra karar ver */}
                  {settings?.apiKey && !advice && (
                    <button onClick={consult} disabled={advising} className="btn-primary w-full">
                      {advising ? 'Değerlendiriyorum…' : '🤔 Yemeli miyim? (koça danış)'}
                    </button>
                  )}

                  {advice && (
                    <div
                      className={`rounded-xl p-3 space-y-1.5 border ${
                        advice.healthy ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'
                      }`}
                    >
                      <p className={`text-sm font-bold ${advice.healthy ? 'text-emerald-800' : 'text-rose-800'}`}>
                        {advice.healthy ? '✅ Uygun görünüyor' : '⚠️ Dikkat et'}
                        {advice.compliancePercent >= 0 ? ` · listeye uyum %${advice.compliancePercent}` : ''}
                      </p>
                      {advice.verdict && <p className="text-sm text-slate-700">{advice.verdict}</p>}
                      {advice.motivations?.slice(0, 2).map((m, i) => (
                        <p key={i} className="text-xs text-slate-600 leading-snug">
                          • {m}
                        </p>
                      ))}
                      {advice.cravingPortion && (
                        <p className="text-xs text-amber-700 leading-snug">
                          🍫 Kaçamak olacaksa: {advice.cravingPortion}
                          {advice.cravingNote ? ` — ${advice.cravingNote}` : ''}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Karar: yedim / vazgeçtim (ikisi de günlüğe işlenir) */}
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => decide('resisted')} className="btn bg-emerald-600 text-white">
                      💪 Vazgeçtim
                    </button>
                    <button onClick={() => decide('ate')} className="btn bg-rose-500 text-white">
                      😋 Yedim
                    </button>
                  </div>
                  {!settings?.apiKey && (
                    <p className="text-[11px] text-slate-400">
                      Yapay zeka danışması için Ayarlar’dan API anahtarı ekle. Anahtarsız da “Yedim / Vazgeçtim” ile
                      kaydedebilirsin.
                    </p>
                  )}
                </>
              )}
            </div>
          </section>
        )}

        <p className="text-center text-xs text-slate-400">
          Veriler ücretsiz Open Food Facts veritabanından gelir. Bazı ürünler eksik olabilir; o zaman barkod numarasını
          elle deneyebilir ya da fotoğrafla normal "Çek" ekranını kullanabilirsin.
        </p>
      </div>
    </div>
  )
}

function Box({ label, value, unit, cls }: { label: string; value: string; unit: string; cls: string }) {
  return (
    <div className={`rounded-xl p-2 ${cls}`}>
      <p className="text-lg font-extrabold leading-none">
        {value}
        <span className="text-[10px] font-bold">{unit}</span>
      </p>
      <p className="text-[10px] font-semibold uppercase tracking-wide mt-0.5">{label}</p>
    </div>
  )
}

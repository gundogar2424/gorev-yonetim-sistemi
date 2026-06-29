import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DietHeader from '../DietHeader'
import { dietDb } from '../db'
import { decodeBarcodeFromImage, lookupProduct, forGrams, startLiveScan, nativeScan, type ProductInfo, type ScannerControls } from '../lib/barcode'
import { fileToResizedDataUrl } from '../../lib/image'
import { MEAL_OPTIONS, guessMeal } from '../lib/meals'
import { todayStr } from '../streak'
import type { MealType } from '../types'

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
    try {
      const p = await lookupProduct(c)
      if (!p) {
        setMsg('Bu barkod veritabanında bulunamadı. Numara doğru mu? (Ürün henüz eklenmemiş olabilir.)')
      } else {
        setProduct(p)
        if (!p.per100.kcal) setMsg('Üründe kalori bilgisi yok; yine de adı bulundu.')
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Sorgu başarısız.')
    } finally {
      setBusy(false)
    }
  }

  async function addEntry() {
    if (!product || !vals) return
    const macroNote = `Protein ${vals.protein}g · Karb ${vals.carb}g · Yağ ${vals.fat}g`
    await dietDb.entries.add({
      foodFound: true,
      foodName: `${product.name} (${g} g)`,
      healthy: true, // barkod kaydi notr; basari puanini bozmasin
      riskLevel: 'orta',
      estimatedCalories: vals.kcal,
      dietScore: 0, // barkod kaydinda diyet puani hesaplanmaz
      harms: [],
      motivations: [],
      healthierAlternative: '',
      verdict: macroNote,
      compliancePercent: -1,
      complianceNote: '',
      cravingPortion: '',
      cravingNote: '',
      photo: '',
      decision: 'ate',
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
    setCode('')
    setGrams('100')
    setMsg('')
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

                  <button onClick={addEntry} className="btn-primary w-full">
                    😋 Günlüğe ekle ({MEAL_OPTIONS.find((m) => m.value === mealType)?.label})
                  </button>
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

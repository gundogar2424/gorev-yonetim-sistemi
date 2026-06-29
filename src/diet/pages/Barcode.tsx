import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DietHeader from '../DietHeader'
import { dietDb } from '../db'
import { decodeBarcodeFromImage, lookupProduct, forGrams, type ProductInfo } from '../lib/barcode'
import { fileToResizedDataUrl } from '../../lib/image'
import { MEAL_OPTIONS, guessMeal } from '../lib/meals'
import { todayStr } from '../streak'
import type { MealType } from '../types'

export default function Barcode() {
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [code, setCode] = useState('')
  const [product, setProduct] = useState<ProductInfo | null>(null)
  const [grams, setGrams] = useState('100')
  const [mealType, setMealType] = useState<MealType>(guessMeal())
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const g = Math.max(0, Number(grams) || 0)
  const vals = product ? forGrams(product, g) : null

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (fileRef.current) fileRef.current.value = ''
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

  async function search(barcode?: string) {
    const c = (barcode ?? code).trim()
    if (!c) return
    setMsg('')
    setBusy(true)
    setProduct(null)
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
    setMsg('Günlüğe eklendi ✅')
    setTimeout(() => navigate('/gecmis'), 800)
  }

  return (
    <div>
      <DietHeader title="Barkod" subtitle="Paketli ürünü okut, kalori/makro öğren" />

      <div className="p-3 space-y-4">
        {/* Barkod gir / okut */}
        <section className="card p-4 space-y-3">
          <button onClick={() => fileRef.current?.click()} disabled={busy} className="btn-primary w-full">
            📷 Barkodun Fotoğrafını Çek / Seç
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhoto} />

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

        {/* Sonuc */}
        {product && (
          <section className="card overflow-hidden border-0 shadow-md">
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 text-white px-4 py-3">
              <h2 className="text-lg font-extrabold leading-tight">{product.name}</h2>
              <p className="text-emerald-50 text-xs mt-0.5">Barkod: {product.barcode}</p>
            </div>
            <div className="p-4 space-y-3">
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
                <span className="basis-full text-[11px] text-slate-400">Katı için gram, içecek için ml gir.</span>
              </div>

              {vals && (
                <div className="grid grid-cols-4 gap-2 text-center">
                  <Box label="Kalori" value={`${vals.kcal}`} unit="kcal" cls="bg-orange-50 text-orange-700" />
                  <Box label="Protein" value={`${vals.protein}`} unit="g" cls="bg-rose-50 text-rose-700" />
                  <Box label="Karb." value={`${vals.carb}`} unit="g" cls="bg-amber-50 text-amber-700" />
                  <Box label="Yağ" value={`${vals.fat}`} unit="g" cls="bg-sky-50 text-sky-700" />
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
                😋 Yedim — günlüğe ekle
              </button>
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

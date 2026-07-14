import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { addProduct, getProduct, updateProduct, deleteProduct } from '../db'
import { fileToCompressedDataUrl } from '../lib/image'

// Ortak alan görünümü
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  )
}

const inputCls =
  'w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400'

export default function ProductForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const editId = id ? Number(id) : null
  const isEdit = editId != null

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [category, setCategory] = useState('')
  const [code, setCode] = useState('')
  const [qty, setQty] = useState('0')
  const [unit, setUnit] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [buyPrice, setBuyPrice] = useState('')
  const [lowStock, setLowStock] = useState('')
  const [note, setNote] = useState('')
  const [photo, setPhoto] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (editId == null) return
    let alive = true
    getProduct(editId).then((p) => {
      if (!alive) return
      if (p) {
        setName(p.name)
        setCompany(p.company || '')
        setCategory(p.category || '')
        setCode(p.code || '')
        setQty(String(p.qty ?? 0))
        setUnit(p.unit || '')
        setSalePrice(p.salePrice != null ? String(p.salePrice) : '')
        setBuyPrice(p.buyPrice != null ? String(p.buyPrice) : '')
        setLowStock(p.lowStock != null ? String(p.lowStock) : '')
        setNote(p.note || '')
        setPhoto(p.photo)
      }
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [editId])

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const dataUrl = await fileToCompressedDataUrl(file)
      setPhoto(dataUrl)
    } catch {
      alert('Fotoğraf yüklenemedi, tekrar deneyin.')
    } finally {
      e.target.value = ''
    }
  }

  const num = (v: string): number | undefined => {
    const t = v.trim().replace(',', '.')
    if (!t) return undefined
    const n = Number(t)
    return Number.isFinite(n) ? n : undefined
  }

  async function onSave() {
    if (!name.trim()) {
      alert('Lütfen ürün adını girin.')
      return
    }
    setSaving(true)
    const data = {
      name: name.trim(),
      company: company.trim() || undefined,
      category: category.trim() || undefined,
      code: code.trim() || undefined,
      qty: Math.max(0, Math.round(num(qty) ?? 0)),
      unit: unit.trim() || undefined,
      salePrice: num(salePrice),
      buyPrice: num(buyPrice),
      lowStock: num(lowStock) != null ? Math.max(0, Math.round(num(lowStock)!)) : undefined,
      note: note.trim() || undefined,
      photo
    }
    try {
      if (isEdit && editId != null) {
        await updateProduct(editId, data)
      } else {
        await addProduct(data)
      }
      navigate('/')
    } catch {
      alert('Kaydedilemedi, tekrar deneyin.')
      setSaving(false)
    }
  }

  async function onDelete() {
    if (editId == null) return
    if (!confirm('Bu ürün silinsin mi? Stok hareketleri de silinir.')) return
    await deleteProduct(editId)
    navigate('/')
  }

  if (loading) {
    return <div className="p-6 text-slate-500">Yükleniyor…</div>
  }

  return (
    <div className="pb-6">
      <header className="px-4 pt-5 pb-3 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="h-9 w-9 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Geri"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2}>
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">{isEdit ? 'Ürünü düzenle' : 'Yeni ürün'}</h1>
      </header>

      <div className="px-4 space-y-4">
        {/* Fotoğraf */}
        <div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onPickPhoto} className="hidden" />
          <button
            onClick={() => fileRef.current?.click()}
            className="relative w-full aspect-video rounded-2xl overflow-hidden border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex items-center justify-center"
          >
            {photo ? (
              <>
                <img src={photo} alt="Ürün" className="w-full h-full object-cover" />
                <span className="absolute bottom-2 right-2 text-xs px-2.5 py-1 rounded-full bg-black/60 text-white">
                  Değiştir
                </span>
              </>
            ) : (
              <span className="flex flex-col items-center gap-2 text-slate-400">
                <svg viewBox="0 0 24 24" className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth={1.6}>
                  <path d="M3 9a2 2 0 0 1 2-2h2l1.4-2h7.2L17 7h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <circle cx="12" cy="13" r="3.5" />
                </svg>
                <span className="text-sm">Fotoğraf çek / seç</span>
              </span>
            )}
          </button>
          {photo && (
            <button onClick={() => setPhoto(undefined)} className="mt-2 text-sm text-rose-500">
              Fotoğrafı kaldır
            </button>
          )}
        </div>

        <Field label="Ürün adı *">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="örn. Silikon Kılıf iPhone 15" className={inputCls} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Firma / marka">
            <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="örn. Baseus" className={inputCls} />
          </Field>
          <Field label="Kategori">
            <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="örn. Kılıf" className={inputCls} />
          </Field>
        </div>

        <Field label="Ürün / stok kodu (barkod)">
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="opsiyonel" className={inputCls} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Elimdeki adet">
            <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="numeric" className={inputCls} />
          </Field>
          <Field label="Birim">
            <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="adet" className={inputCls} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Satış fiyatı (₺)">
            <input value={salePrice} onChange={(e) => setSalePrice(e.target.value)} inputMode="decimal" placeholder="opsiyonel" className={inputCls} />
          </Field>
          <Field label="Alış fiyatı (₺)">
            <input value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)} inputMode="decimal" placeholder="opsiyonel" className={inputCls} />
          </Field>
        </div>

        <Field label="Kritik stok uyarısı (bu adede düşünce uyar)">
          <input value={lowStock} onChange={(e) => setLowStock(e.target.value)} inputMode="numeric" placeholder="örn. 3" className={inputCls} />
        </Field>

        <Field label="Not">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="opsiyonel" className={inputCls} />
        </Field>

        <div className="flex gap-3 pt-1">
          <button
            onClick={onSave}
            disabled={saving}
            className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-semibold active:scale-95 disabled:opacity-60"
          >
            {saving ? 'Kaydediliyor…' : isEdit ? 'Kaydet' : 'Ekle'}
          </button>
          {isEdit && (
            <button onClick={onDelete} className="px-4 py-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 font-medium active:scale-95">
              Sil
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

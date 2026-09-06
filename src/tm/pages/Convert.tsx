import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import TmHeader from '../TmHeader'
import { addRecipe, readTmSettings } from '../db'
import { convertRecipe } from '../ai'
import { stepSummary } from '../lib/tm7'
import type { TmConversion } from '../types'

// Fotografi kucult + base64'e cevir. Buyuk fotograflar hem yavas gider hem
// gereksiz token yakar; uzun kenari 1400 pikselde tutmak okumaya fazlasiyla yeter.
async function fileToBase64(file: File): Promise<{ base64: string; mediaType: string }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result))
    fr.onerror = () => reject(new Error('Fotoğraf okunamadı.'))
    fr.readAsDataURL(file)
  })
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = () => reject(new Error('Fotoğraf açılamadı.'))
    i.src = dataUrl
  })
  const max = 1400
  const scale = Math.min(1, max / Math.max(img.width, img.height))
  const w = Math.round(img.width * scale)
  const h = Math.round(img.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return { base64: dataUrl.split(',')[1] ?? '', mediaType: file.type || 'image/jpeg' }
  ctx.drawImage(img, 0, 0, w, h)
  const out = canvas.toDataURL('image/jpeg', 0.85)
  return { base64: out.split(',')[1] ?? '', mediaType: 'image/jpeg' }
}

export default function Convert() {
  const navigate = useNavigate()
  const settings = useLiveQuery(() => readTmSettings(), [], undefined)
  const fileRef = useRef<HTMLInputElement>(null)

  const [text, setText] = useState('')
  const [note, setNote] = useState('')
  const [source, setSource] = useState('')
  const [image, setImage] = useState<{ base64: string; mediaType: string; preview: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<TmConversion | null>(null)

  async function pickImage(file?: File) {
    if (!file) return
    setError('')
    try {
      const { base64, mediaType } = await fileToBase64(file)
      setImage({ base64, mediaType, preview: `data:${mediaType};base64,${base64}` })
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function uyarla() {
    setError('')
    setResult(null)
    if (!settings?.apiKey?.trim()) {
      setError('Önce Ayarlar bölümünden Claude API anahtarını gir.')
      return
    }
    if (!text.trim() && !image) {
      setError('Tarifi yapıştır ya da fotoğrafını seç.')
      return
    }
    setBusy(true)
    try {
      const r = await convertRecipe({
        apiKey: settings.apiKey.trim(),
        model: settings.model,
        text,
        image: image ? { base64: image.base64, mediaType: image.mediaType } : undefined,
        note
      })
      setResult(r)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function kaydet() {
    if (!result) return
    const id = await addRecipe(result, { source: source.trim(), originalText: text.trim(), origin: 'ai' })
    navigate(`/tarif/${id}`)
  }

  return (
    <div>
      <TmHeader
        title="Tarifi TM7'ye Uyarla"
        subtitle="Bulduğun tarifi yapıştır; adımları cihaza göre çevireyim"
        right={
          <Link to="/yeni" className="btn-ghost px-3 py-2 text-sm">
            Elle yaz
          </Link>
        }
      />

      <div className="px-4 py-3 space-y-3">
        {!settings?.apiKey?.trim() && (
          <div className="card p-3 text-sm bg-amber-50 dark:bg-[#252733] border-amber-200">
            Uyarlama için Claude API anahtarı gerekiyor.{' '}
            <Link to="/ayarlar" className="underline font-semibold">
              Ayarlar’dan gir
            </Link>
            .
          </div>
        )}

        <div>
          <label className="field-label">Tarif metni</label>
          <textarea
            className="field-input min-h-[180px] leading-relaxed"
            placeholder={
              'Siteden kopyaladığın tarifi buraya yapıştır (malzemeler + yapılışı).\n\n' +
              'Bağlantı değil, tarifin kendisi olsun. İstersen ekran görüntüsünü de seçebilirsin.'
            }
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        {/* Ekran goruntusu / fotograf */}
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => pickImage(e.target.files?.[0])}
          />
          <button onClick={() => fileRef.current?.click()} className="btn-ghost px-3 py-2 text-sm">
            📷 Fotoğraf / ekran görüntüsü
          </button>
          {image && (
            <button onClick={() => setImage(null)} className="text-xs text-rose-500 underline">
              Kaldır
            </button>
          )}
        </div>
        {image && <img src={image.preview} alt="Seçilen tarif görseli" className="rounded-xl max-h-56 object-contain" />}

        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="field-label">Ek isteğin (isteğe bağlı)</label>
            <input
              className="field-input"
              placeholder="örn. 4 kişilik yap, acı olmasın"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label">Kaynak (isteğe bağlı)</label>
            <input
              className="field-input"
              placeholder="örn. nefisyemektarifleri.com"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
          </div>
        </div>

        <button onClick={uyarla} disabled={busy} className="btn-primary w-full py-3">
          {busy ? 'Uyarlanıyor…' : '✨ TM7’ye uyarla'}
        </button>

        {busy && (
          <p className="text-center text-xs text-slate-500">
            Adımlar cihaz diline çevriliyor (devir, sıcaklık, süre)… Bu 10-30 saniye sürebilir.
          </p>
        )}

        {error && (
          <div className="card p-3 text-sm text-rose-600 whitespace-pre-wrap bg-rose-50 dark:bg-[#252733]">{error}</div>
        )}

        {result && <Preview r={result} onSave={kaydet} />}
      </div>
    </div>
  )
}

// Kaydetmeden once uyarlamanin onizlemesi
function Preview({ r, onSave }: { r: TmConversion; onSave: () => void }) {
  return (
    <section className="space-y-3 pt-2">
      <h3 className="section-title px-1">Uyarlanmış tarif</h3>

      <div className="card p-4">
        <div className="text-lg font-bold text-slate-800 dark:text-[#e0e1e6]">{r.title}</div>
        <div className="text-[12px] text-slate-500 mt-0.5">
          {[r.category, r.servings ? `${r.servings} kişilik` : '', r.minutes ? `${r.minutes} dk` : '']
            .filter(Boolean)
            .join(' · ')}
        </div>

        {r.ingredients.length > 0 && (
          <>
            <div className="section-title mt-3 mb-1">Malzemeler</div>
            <ul className="text-sm text-slate-700 dark:text-slate-300 space-y-0.5">
              {r.ingredients.map((i, k) => (
                <li key={k}>• {i}</li>
              ))}
            </ul>
          </>
        )}

        <div className="section-title mt-3 mb-1">Adımlar</div>
        <ol className="space-y-2">
          {r.steps.map((s, k) => (
            <li key={k} className="text-sm">
              <span className="font-semibold text-slate-800 dark:text-[#e0e1e6]">{k + 1}.</span>{' '}
              <span className="text-slate-700 dark:text-slate-300">{s.text}</span>
              {s.ingredients && <div className="text-[12px] text-slate-500 pl-4">Kaba gir: {s.ingredients}</div>}
              {stepSummary(s) && (
                <div className="pl-4">
                  <span className="chip bg-brand-50 dark:bg-[#252733] text-brand-700">{stepSummary(s)}</span>
                </div>
              )}
              {s.tip && <div className="text-[12px] text-amber-600 pl-4">💡 {s.tip}</div>}
            </li>
          ))}
        </ol>

        {r.warnings.length > 0 && (
          <div className="mt-3 p-3 rounded-xl bg-amber-50 dark:bg-[#252733] text-[13px] text-amber-800 space-y-1">
            {r.warnings.map((w, k) => (
              <div key={k}>⚠️ {w}</div>
            ))}
          </div>
        )}
        {r.notes && <p className="text-[13px] text-slate-500 mt-3">{r.notes}</p>}
      </div>

      <button onClick={onSave} className="btn-primary w-full py-3">
        Deftere kaydet
      </button>
    </section>
  )
}

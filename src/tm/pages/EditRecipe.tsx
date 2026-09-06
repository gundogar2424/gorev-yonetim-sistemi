import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import TmHeader from '../TmHeader'
import { addRecipe, getRecipe, updateRecipe } from '../db'
import { CATEGORIES, MODES, SPEEDS, TEMPS, emptyStep } from '../lib/tm7'
import type { TmStep } from '../types'

// Hem "yeni tarif" hem "tarifi duzenle" bu sayfadir (id varsa duzenleme).
export default function EditRecipe() {
  const { id } = useParams()
  const rid = id ? Number(id) : 0
  const navigate = useNavigate()

  const [yuklendi, setYuklendi] = useState(!rid)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('Ana Yemek')
  const [servings, setServings] = useState('')
  const [minutes, setMinutes] = useState('')
  const [ingredients, setIngredients] = useState('') // her satir bir malzeme
  const [notes, setNotes] = useState('')
  const [source, setSource] = useState('')
  const [video, setVideo] = useState('')
  const [steps, setSteps] = useState<TmStep[]>([emptyStep()])

  useEffect(() => {
    if (!rid) return
    void getRecipe(rid).then((r) => {
      if (!r) {
        setYuklendi(true)
        return
      }
      setTitle(r.title)
      setCategory(r.category || 'Ana Yemek')
      setServings(r.servings ? String(r.servings) : '')
      setMinutes(r.minutes ? String(r.minutes) : '')
      setIngredients(r.ingredients.join('\n'))
      setNotes(r.notes)
      setSource(r.source)
      setVideo(r.video ?? '')
      setSteps(r.steps.length ? r.steps : [emptyStep()])
      setYuklendi(true)
    })
  }, [rid])

  function stepGuncelle(i: number, patch: Partial<TmStep>) {
    setSteps((prev) => prev.map((s, k) => (k === i ? { ...s, ...patch } : s)))
  }

  function stepSil(i: number) {
    setSteps((prev) => (prev.length === 1 ? [emptyStep()] : prev.filter((_, k) => k !== i)))
  }

  function stepTasi(i: number, yon: -1 | 1) {
    setSteps((prev) => {
      const hedef = i + yon
      if (hedef < 0 || hedef >= prev.length) return prev
      const kopya = [...prev]
      const [x] = kopya.splice(i, 1)
      kopya.splice(hedef, 0, x)
      return kopya
    })
  }

  async function kaydet() {
    const veri = {
      title: title.trim() || 'Adsız tarif',
      category,
      servings: Number(servings) || 0,
      minutes: Number(minutes) || 0,
      ingredients: ingredients
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      steps: steps.filter((s) => s.text.trim()),
      notes: notes.trim(),
      warnings: [] as string[],
      photo: '', // Fotograf tarif sayfasindan eklenir; burada dokunulmaz
      video: video.trim()
    }
    if (rid) {
      // Duzenlemede mevcut fotografa dokunma
      const { photo: _foto, ...duzenlenen } = veri
      await updateRecipe(rid, { ...duzenlenen, source: source.trim() })
      navigate(`/tarif/${rid}`)
    } else {
      const yeni = await addRecipe(veri, { source: source.trim(), origin: 'manual' })
      navigate(`/tarif/${yeni}`)
    }
  }

  if (!yuklendi) {
    return (
      <div>
        <TmHeader title="Tarif" back />
        <div className="px-4 py-6 text-center text-slate-400 text-sm">Yükleniyor…</div>
      </div>
    )
  }

  return (
    <div>
      <TmHeader title={rid ? 'Tarifi Düzenle' : 'Yeni Tarif'} subtitle="Adımları TM7 diliyle yaz" back />

      <div className="px-4 py-3 space-y-3">
        <div>
          <label className="field-label">Tarif adı</label>
          <input className="tm-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="örn. Mercimek çorbası" />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="field-label">Kategori</label>
            <select className="tm-input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Kişi</label>
            <input className="tm-input" inputMode="numeric" value={servings} onChange={(e) => setServings(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Süre (dk)</label>
            <input className="tm-input" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="field-label">Malzemeler (her satıra bir tane)</label>
          <textarea
            className="tm-input min-h-[110px]"
            value={ingredients}
            onChange={(e) => setIngredients(e.target.value)}
            placeholder={'1 su bardağı kırmızı mercimek\n1 soğan\n2 yemek kaşığı zeytinyağı'}
          />
        </div>

        <section className="space-y-2">
          <h3 className="tm-label px-1">Adımlar</h3>
          {steps.map((s, i) => (
            <StepEditor
              key={i}
              i={i}
              s={s}
              onChange={(p) => stepGuncelle(i, p)}
              onDelete={() => stepSil(i)}
              onMove={(y) => stepTasi(i, y)}
            />
          ))}
          <button onClick={() => setSteps((p) => [...p, emptyStep()])} className="tm-btn-soft w-full py-2.5 text-sm">
            + Adım ekle
          </button>
        </section>

        <div>
          <label className="field-label">Not</label>
          <input className="tm-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Servis / saklama notu" />
        </div>
        <div>
          <label className="field-label">Kaynak</label>
          <input className="tm-input" value={source} onChange={(e) => setSource(e.target.value)} placeholder="örn. anneannemin tarifi" />
        </div>

        <button onClick={kaydet} className="tm-btn-primary w-full py-3">
          Kaydet
        </button>
      </div>
    </div>
  )
}

function StepEditor({
  i,
  s,
  onChange,
  onDelete,
  onMove
}: {
  i: number
  s: TmStep
  onChange: (p: Partial<TmStep>) => void
  onDelete: () => void
  onMove: (yon: -1 | 1) => void
}) {
  const dk = Math.floor(s.seconds / 60)
  const sn = s.seconds % 60

  return (
    <div className="tm-card p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 rounded-full bg-tm-600 text-white text-xs font-bold flex items-center justify-center">
          {i + 1}
        </span>
        <div className="flex-1" />
        <button onClick={() => onMove(-1)} className="text-slate-400 px-1.5" aria-label="Yukarı taşı">
          ↑
        </button>
        <button onClick={() => onMove(1)} className="text-slate-400 px-1.5" aria-label="Aşağı taşı">
          ↓
        </button>
        <button onClick={onDelete} className="text-rose-500 px-1.5" aria-label="Adımı sil">
          ✕
        </button>
      </div>

      <input className="tm-input" placeholder="Ne yapılacak?" value={s.text} onChange={(e) => onChange({ text: e.target.value })} />
      <input
        className="tm-input"
        placeholder="Bu adımda kaba giren malzemeler"
        value={s.ingredients}
        onChange={(e) => onChange({ ingredients: e.target.value })}
      />

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="field-label">Süre</label>
          <div className="flex gap-1 items-center">
            <input
              className="num-input"
              inputMode="numeric"
              value={dk || ''}
              placeholder="dk"
              onChange={(e) => onChange({ seconds: (Number(e.target.value) || 0) * 60 + sn })}
            />
            <span className="text-xs text-slate-400">dk</span>
            <input
              className="num-input"
              inputMode="numeric"
              value={sn || ''}
              placeholder="sn"
              onChange={(e) => onChange({ seconds: dk * 60 + (Number(e.target.value) || 0) })}
            />
            <span className="text-xs text-slate-400">sn</span>
          </div>
        </div>
        <div>
          <label className="field-label">Sıcaklık</label>
          <select className="tm-input" value={s.temp} onChange={(e) => onChange({ temp: e.target.value })}>
            {TEMPS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Devir</label>
          <select className="tm-input" value={s.speed} onChange={(e) => onChange({ speed: e.target.value as TmStep['speed'] })}>
            {SPEEDS.map((x) => (
              <option key={x.value} value={x.value}>
                {x.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Mod</label>
          <select className="tm-input" value={s.mode} onChange={(e) => onChange({ mode: e.target.value as TmStep['mode'] })}>
            {MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
        <input type="checkbox" checked={s.reverse} onChange={(e) => onChange({ reverse: e.target.checked })} className="w-4 h-4" />
        Ters yön (bıçak tersine dönsün)
      </label>

      <input className="tm-input" placeholder="İpucu (isteğe bağlı)" value={s.tip} onChange={(e) => onChange({ tip: e.target.value })} />
    </div>
  )
}

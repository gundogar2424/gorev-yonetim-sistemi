import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { addRecipe, lzDb, updateRecipe } from '../db'
import type { LzDraft, LzTable } from '../types'
import { Header, T_BASLIK, T_SOLUK, Thumb } from '../components/ui'
import { ETIKETLER } from '../lib/ai'
import { fotoOku } from '../lib/image'
import { platformBul } from '../lib/importer'
import { YeniSofra } from './Recipes'

const BOS: LzDraft = {
  title: '',
  photo: '',
  sourceUrl: '',
  platform: 'manual',
  author: '',
  servings: 0,
  minutes: 0,
  ingredients: [],
  steps: [],
  notes: '',
  tags: []
}

export default function EditRecipe() {
  const { id } = useParams()
  const duzenle = id ? Number(id) : 0
  const navigate = useNavigate()
  const loc = useLocation() as { state?: { draft?: LzDraft; not?: string } }
  const sofralar = useLiveQuery(() => lzDb.sofralar.orderBy('name').toArray(), [], [] as LzTable[]) ?? []

  const [d, setD] = useState<LzDraft>(loc.state?.draft ?? BOS)
  const [malz, setMalz] = useState((loc.state?.draft?.ingredients ?? []).join('\n'))
  const [adim, setAdim] = useState((loc.state?.draft?.steps ?? []).join('\n\n'))
  const [secili, setSecili] = useState<number[]>([])
  const [yeniEtiket, setYeniEtiket] = useState('')
  const [yeniSofra, setYeniSofra] = useState(false)
  const [hazir, setHazir] = useState(!duzenle)
  const dosya = useRef<HTMLInputElement>(null)
  const not = loc.state?.not ?? ''

  useEffect(() => {
    if (!duzenle) return
    void lzDb.recipes.get(duzenle).then((r) => {
      if (!r) return
      const { id: _id, ...rest } = r
      setD(rest)
      setMalz(r.ingredients.join('\n'))
      setAdim(r.steps.join('\n\n'))
      setSecili(r.tableIds)
      setHazir(true)
    })
  }, [duzenle])

  const set = <K extends keyof LzDraft>(k: K, v: LzDraft[K]) => setD((x) => ({ ...x, [k]: v }))

  const kaydet = async () => {
    const veri: LzDraft = {
      title: d.title,
      photo: d.photo,
      sourceUrl: d.sourceUrl.trim(),
      author: d.author,
      servings: d.servings,
      minutes: d.minutes,
      notes: d.notes,
      tags: d.tags,
      platform: d.sourceUrl ? (d.platform === 'manual' ? platformBul(d.sourceUrl) : d.platform) : 'manual',
      ingredients: malz.split('\n'),
      // Adimlar bos satirla ya da satir satir ayrilabilir
      steps: (adim.includes('\n\n') ? adim.split(/\n\s*\n/) : adim.split('\n')).map((s) =>
        s.replace(/^\s*\d+[.)-]\s*/, '').replace(/\s*\n\s*/g, ' ')
      )
    }
    if (duzenle) {
      await updateRecipe(duzenle, { ...veri, tableIds: secili })
      navigate(-1)
    } else {
      const yeni = await addRecipe(veri, secili)
      navigate(`/tarif/${yeni}`, { replace: true })
    }
  }

  const etiketDegis = (e: string) => set('tags', d.tags.includes(e) ? d.tags.filter((x) => x !== e) : [...d.tags, e])
  const tumEtiketler = Array.from(new Set([...ETIKETLER, ...d.tags]))

  if (!hazir) return <Header title="Tarifi düzenle" back />

  return (
    <div>
      <Header title={duzenle ? 'Tarifi düzenle' : 'Yeni tarif'} back />
      <div className="px-4 space-y-4 pb-8">
        {not && (
          <div
            className={`rounded-2xl text-[13px] p-3.5 ${
              not.startsWith('⚠️')
                ? 'bg-rose-50 dark:bg-[#2a1a1d] text-rose-700 dark:text-rose-300 font-medium'
                : 'bg-amber-50 dark:bg-[#2a2113] text-amber-800 dark:text-amber-200'
            }`}
          >
            {not}
            {not.startsWith('⚠️ Yapay zeka') && d.sourceUrl && !duzenle && (
              <button
                className="lz-btn-primary w-full mt-3 text-sm"
                onClick={() => navigate('/ekle', { replace: true, state: { paylasim: d.sourceUrl, zaman: Date.now() } })}
              >
                ↻ Yapay zekayla tekrar dene
              </button>
            )}
          </div>
        )}

        <div className="lz-card p-4 space-y-3">
          <div className="flex gap-3 items-center">
            <button onClick={() => dosya.current?.click()} className="relative">
              <Thumb src={d.photo} className="w-24 h-24 rounded-2xl" emoji="📷" />
            </button>
            <div className="flex-1 space-y-2">
              <button className="lz-btn-soft w-full py-2 text-sm" onClick={() => dosya.current?.click()}>
                {d.photo ? 'Fotoğrafı değiştir' : 'Fotoğraf ekle'}
              </button>
              {d.photo && (
                <button className={`text-[13px] w-full ${T_SOLUK}`} onClick={() => set('photo', '')}>
                  Fotoğrafı kaldır
                </button>
              )}
            </div>
            <input
              ref={dosya}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (f) set('photo', await fotoOku(f))
                e.target.value = ''
              }}
            />
          </div>

          <Alan ad="Tarif adı">
            <input className="lz-input" value={d.title} onChange={(e) => set('title', e.target.value)} placeholder="Tarifin adı" />
          </Alan>
          <div className="grid grid-cols-2 gap-3">
            <Alan ad="Kaç kişilik">
              <input
                className="lz-input"
                inputMode="numeric"
                value={d.servings || ''}
                onChange={(e) => set('servings', Number(e.target.value.replace(/\D/g, '')) || 0)}
                placeholder="–"
              />
            </Alan>
            <Alan ad="Süre (dk)">
              <input
                className="lz-input"
                inputMode="numeric"
                value={d.minutes || ''}
                onChange={(e) => set('minutes', Number(e.target.value.replace(/\D/g, '')) || 0)}
                placeholder="–"
              />
            </Alan>
          </div>
          <Alan ad="Kaynak link (isteğe bağlı)">
            <input className="lz-input" value={d.sourceUrl} onChange={(e) => set('sourceUrl', e.target.value)} placeholder="https://…" inputMode="url" />
          </Alan>
        </div>

        <div className="lz-card p-4 space-y-2">
          <div className={`font-semibold ${T_BASLIK}`}>Malzemeler</div>
          <p className={`text-[12px] ${T_SOLUK}`}>Her satıra bir malzeme; miktarı başa yaz (porsiyon değişince otomatik hesaplanır).</p>
          <textarea className="lz-input min-h-[160px] text-[15px] leading-relaxed" value={malz} onChange={(e) => setMalz(e.target.value)} placeholder="Buraya malzemeleri yaz (her satıra bir tane)" />
        </div>

        <div className="lz-card p-4 space-y-2">
          <div className={`font-semibold ${T_BASLIK}`}>Yapılışı</div>
          <p className={`text-[12px] ${T_SOLUK}`}>Adımları boş satırla ya da satır satır ayır.</p>
          <textarea className="lz-input min-h-[200px] text-[15px] leading-relaxed" value={adim} onChange={(e) => setAdim(e.target.value)} placeholder="Buraya yapılışı yaz" />
        </div>

        <div className="lz-card p-4 space-y-2">
          <div className={`font-semibold ${T_BASLIK}`}>Notlar</div>
          <textarea className="lz-input min-h-[80px] text-[15px]" value={d.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Püf noktası, servis önerisi…" />
        </div>

        <div className="lz-card p-4 space-y-3">
          <div className={`font-semibold ${T_BASLIK}`}>Sofralar</div>
          <div className="flex flex-wrap gap-2">
            {sofralar.map((t) => {
              const on = secili.includes(t.id!)
              return (
                <button
                  key={t.id}
                  onClick={() => setSecili(on ? secili.filter((x) => x !== t.id) : [...secili, t.id!])}
                  className={`lz-chip ${on ? 'lz-chip-on' : ''}`}
                >
                  {t.emoji} {t.name}
                </button>
              )
            })}
            <button onClick={() => setYeniSofra(true)} className="lz-chip border-dashed">
              + Yeni sofra
            </button>
          </div>

          <div className={`font-semibold pt-2 ${T_BASLIK}`}>Etiketler</div>
          <div className="flex flex-wrap gap-2">
            {tumEtiketler.map((e) => (
              <button key={e} onClick={() => etiketDegis(e)} className={`lz-chip ${d.tags.includes(e) ? 'lz-chip-on' : ''}`}>
                {e}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input className="lz-input py-2" value={yeniEtiket} onChange={(e) => setYeniEtiket(e.target.value)} placeholder="Kendi etiketin" />
            <button
              className="lz-btn-soft py-2 flex-shrink-0"
              disabled={!yeniEtiket.trim()}
              onClick={() => {
                const e = yeniEtiket.trim()
                if (e && !d.tags.includes(e)) set('tags', [...d.tags, e])
                setYeniEtiket('')
              }}
            >
              Ekle
            </button>
          </div>
        </div>

        <button className="lz-btn-primary w-full text-[16px]" onClick={() => void kaydet()}>
          {duzenle ? 'Değişiklikleri kaydet' : 'Deftere kaydet'}
        </button>
      </div>

      <YeniSofra open={yeniSofra} onClose={() => setYeniSofra(false)} onCreated={(yid) => setSecili((s) => [...s, yid])} />
    </div>
  )
}

function Alan({ ad, children }: { ad: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="lz-label block mb-1.5 px-1">{ad}</span>
      {children}
    </label>
  )
}

import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import DietHeader from '../DietHeader'
import { listProgress, addProgress, deleteProgress } from '../db'
import { fileToResizedDataUrl } from '../../lib/image'
import type { ProgressPhoto } from '../types'

export default function Progress() {
  const photos = useLiveQuery(() => listProgress(), [], [])
  const fileRef = useRef<HTMLInputElement>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const list = photos ?? []
  // listProgress en yeniden eskiye gelir; once=en eski, sonra=en yeni
  const oldest = list.length ? list[list.length - 1] : null
  const newest = list.length ? list[0] : null
  const canCompare = list.length >= 2

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return
    setBusy(true)
    try {
      const dataUrl = await fileToResizedDataUrl(file, 900, 0.8)
      await addProgress(dataUrl, note.trim() || undefined)
      setNote('')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: number) {
    if (!confirm('Bu fotoğrafı silmek istiyor musunuz?')) return
    await deleteProgress(id)
  }

  return (
    <div>
      <DietHeader title="Önce - Sonra" subtitle="İlerleme fotoğrafların" />

      <div className="p-3 space-y-4">
        {/* Yeni fotograf ekle */}
        <section className="card p-4 space-y-3">
          <p className="text-xs text-slate-500">
            Düzenli aralıklarla (örn. haftada bir) aynı açıdan fotoğraf çek. Değişimi yan yana görmek en büyük
            motivasyon! Fotoğraflar yalnızca cihazında saklanır.
          </p>
          <input
            type="text"
            className="field-input"
            placeholder="Not (isteğe bağlı, örn. 82 kg)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button onClick={() => fileRef.current?.click()} disabled={busy} className="btn-primary w-full">
            {busy ? 'Ekleniyor…' : '📷 Fotoğraf Çek / Ekle'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
        </section>

        {/* Karsilastirma: ilk vs son */}
        {canCompare && oldest && newest && (
          <section className="card p-3 space-y-2">
            <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide">Karşılaştırma</h3>
            <div className="grid grid-cols-2 gap-2">
              <ComparePane label="ÖNCE" p={oldest} accent="bg-slate-500" />
              <ComparePane label="SONRA" p={newest} accent="bg-emerald-600" />
            </div>
            <p className="text-center text-xs text-slate-500">
              {dayCount(oldest, newest)} günde kat ettiğin yol 👏
            </p>
          </section>
        )}

        {/* Tum fotograflar */}
        <section className="space-y-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide px-1">Tüm fotoğraflar</h3>
          {list.length === 0 && (
            <div className="card p-6 text-center text-slate-500 text-sm">
              <div className="text-5xl mb-2">📸</div>
              Henüz fotoğraf yok. İlk karesini çekerek başla.
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {list.map((p) => (
              <div key={p.id} className="card overflow-hidden">
                <div className="relative">
                  <img src={p.photo} alt={p.dateStr} className="w-full aspect-[3/4] object-cover" />
                  <button
                    onClick={() => remove(p.id!)}
                    className="absolute top-1 right-1 bg-black/50 text-white rounded-full w-7 h-7 text-sm"
                    aria-label="Sil"
                  >
                    🗑️
                  </button>
                </div>
                <div className="p-2">
                  <p className="text-xs font-semibold text-slate-700">{formatDate(p.dateStr)}</p>
                  {p.note && <p className="text-xs text-slate-500 truncate">{p.note}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

function ComparePane({ label, p, accent }: { label: string; p: ProgressPhoto; accent: string }) {
  return (
    <div className="space-y-1">
      <div className="relative">
        <img src={p.photo} alt={label} className="w-full aspect-[3/4] object-cover rounded-xl" />
        <span className={`absolute top-1 left-1 ${accent} text-white text-[10px] font-bold rounded-full px-2 py-0.5`}>
          {label}
        </span>
      </div>
      <p className="text-center text-xs font-semibold text-slate-600">{formatDate(p.dateStr)}</p>
      {p.note && <p className="text-center text-[11px] text-slate-500 truncate">{p.note}</p>}
    </div>
  )
}

function dayCount(a: ProgressPhoto, b: ProgressPhoto): number {
  return Math.max(0, Math.round((b.createdAt - a.createdAt) / 86_400_000))
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
}

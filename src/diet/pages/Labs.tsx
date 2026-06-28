import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import DietHeader from '../DietHeader'
import { listLabs, addLab, updateLab, deleteLab, readDietSettings } from '../db'
import { extractLabText, analyzeLabs } from '../ai'
import { fileToResizedDataUrl } from '../../lib/image'
import { todayStr } from '../streak'

// Bir dosyayi ham data URL'e cevirir (PDF icin; resize yok)
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(new Error('Dosya okunamadı.'))
    r.readAsDataURL(file)
  })
}

export default function Labs() {
  const labs = useLiveQuery(() => listLabs(), [], [])
  const settings = useLiveQuery(() => readDietSettings(), [], undefined)
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const [analysis, setAnalysis] = useState('')
  const [openId, setOpenId] = useState<number | null>(null)

  const hasKey = !!settings?.apiKey

  function flash(m: string) {
    setMsg(m)
    setTimeout(() => setMsg(''), 4000)
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return
    if (!hasKey) {
      flash('Önce Ayarlar’dan API anahtarını gir.')
      return
    }
    setBusy('Tahlil okunuyor…')
    try {
      const dataUrl = file.type === 'application/pdf' ? await fileToDataUrl(file) : await fileToResizedDataUrl(file, 1500, 0.85)
      const text = await extractLabText({ apiKey: settings!.apiKey!, dataUrl, model: settings?.model })
      await addLab({ dateStr: todayStr(), title: 'Tahlil', text })
      flash('Tahlil okundu ve hafızaya kaydedildi.')
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Tahlil okunamadı.')
    } finally {
      setBusy('')
    }
  }

  async function doAnalyze() {
    if (!hasKey) {
      flash('Önce Ayarlar’dan API anahtarını gir.')
      return
    }
    const all = labs ?? []
    if (all.length === 0) {
      flash('Önce en az bir tahlil ekle.')
      return
    }
    setBusy('Tahliller yorumlanıyor…')
    setAnalysis('')
    try {
      const labsText = [...all]
        .reverse()
        .map((l) => `### ${l.dateStr} — ${l.title}\n${l.text}`)
        .join('\n\n')
      const result = await analyzeLabs({
        apiKey: settings!.apiKey!,
        labsText,
        model: settings?.model,
        userName: settings?.userName,
        goal: settings?.goal
      })
      setAnalysis(result)
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Yorumlama başarısız.')
    } finally {
      setBusy('')
    }
  }

  return (
    <div>
      <DietHeader title="Tahliller" subtitle="Foto/PDF yükle, hafızada tutsun" />

      <div className="p-3 space-y-4">
        {msg && <p className="card p-3 bg-emerald-50 text-emerald-800 text-sm border-emerald-100">{msg}</p>}
        {!hasKey && (
          <div className="card p-3 bg-amber-50 border-amber-200 text-amber-800 text-sm">
            Tahlil okuma yapay zeka kullanır. Önce <b>Ayarlar</b>’dan API anahtarını ekle.
          </div>
        )}

        <section className="card p-4 space-y-2">
          <p className="text-xs text-slate-500">
            Tahlilinin fotoğrafını veya PDF’ini yükle; yapay zeka metne çevirip <b>hafızasında tutar</b>. Sonra
            “Yorumla” ile geçmiş tahlillerini birlikte değerlendirir. <i>(Yapay zeka kullanır — token harcar.)</i>
          </p>
          <button onClick={() => fileRef.current?.click()} disabled={!!busy || !hasKey} className="btn-primary w-full">
            {busy === 'Tahlil okunuyor…' ? 'Okunuyor…' : '📄 Tahlil Yükle (Foto / PDF)'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={onFile}
          />
          <button onClick={doAnalyze} disabled={!!busy || (labs?.length ?? 0) === 0} className="btn-ghost w-full">
            {busy === 'Tahliller yorumlanıyor…' ? 'Yorumlanıyor…' : '🧠 Tahlillerimi Yorumla'}
          </button>
        </section>

        {analysis && (
          <section className="card p-4 bg-sky-50 border-sky-100 space-y-2">
            <h3 className="font-bold text-sky-800 text-sm uppercase tracking-wide">🧠 Yorum</h3>
            <p className="text-sm text-sky-900 whitespace-pre-wrap leading-snug">{analysis}</p>
            <p className="text-[11px] text-slate-500">Bu bir tıbbi teşhis değildir; kesin değerlendirme için doktoruna danış.</p>
          </section>
        )}

        <section className="space-y-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide px-1">Kayıtlı Tahliller</h3>
          {(labs?.length ?? 0) === 0 && <p className="text-sm text-slate-400 px-1">Henüz tahlil yok.</p>}
          {(labs ?? []).map((l) => (
            <div key={l.id} className="card p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <input
                  className="font-semibold text-slate-700 bg-transparent flex-1 min-w-0 outline-none"
                  value={l.title}
                  onChange={(e) => updateLab(l.id!, { title: e.target.value })}
                />
                <span className="text-xs text-slate-400">{l.dateStr}</span>
                <button onClick={() => deleteLab(l.id!)} className="text-slate-300 hover:text-rose-500">
                  🗑️
                </button>
              </div>
              <button
                onClick={() => setOpenId(openId === l.id ? null : l.id!)}
                className="text-xs text-emerald-700 underline"
              >
                {openId === l.id ? 'Gizle' : 'Metni gör'}
              </button>
              {openId === l.id && (
                <p className="text-xs text-slate-600 whitespace-pre-wrap bg-slate-50 rounded-lg p-2 leading-snug">
                  {l.text}
                </p>
              )}
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}

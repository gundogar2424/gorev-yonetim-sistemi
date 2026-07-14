import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { setActiveByList } from '../db'

export default function ActiveList() {
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [result, setResult] = useState<{ matched: number; unmatched: string[] } | null>(null)
  const [busy, setBusy] = useState(false)

  async function run() {
    if (!text.trim()) return
    setBusy(true)
    try {
      const res = await setActiveByList(text)
      setResult(res)
    } finally {
      setBusy(false)
    }
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
        <div>
          <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">Aktif sattığım ürünler</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Listeni yapıştır; katalogdan eşleşenler "aktif" olsun.</p>
        </div>
      </header>

      <div className="px-4 space-y-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder={'Her satıra bir ürün adı ya da kodu yaz.\n\nÖrnek:\nSilikon Kılıf iPhone 15\nUSB-C Şarj Kablosu\nBLT-900'}
          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <button
          onClick={run}
          disabled={busy}
          className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold active:scale-95 disabled:opacity-60"
        >
          {busy ? 'Eşleştiriliyor…' : 'Eşleştir ve aktif yap'}
        </button>

        {result && (
          <div className="space-y-3">
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-3 py-2.5 text-sm flex items-center justify-between gap-3">
              <span>{result.matched} ürün aktif olarak işaretlendi.</span>
              <button onClick={() => navigate('/')} className="font-semibold underline shrink-0">
                Göster
              </button>
            </div>
            {result.unmatched.length > 0 && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-3 py-2.5">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-300 mb-1">
                  {result.unmatched.length} satır katalogda bulunamadı:
                </p>
                <ul className="text-xs text-amber-700/80 dark:text-amber-300/80 list-disc pl-4 space-y-0.5 max-h-40 overflow-y-auto">
                  {result.unmatched.map((u, i) => (
                    <li key={i}>{u}</li>
                  ))}
                </ul>
                <p className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-2">
                  Bunları önce "İçe aktar" ile kataloğa ekleyin ya da adı/kodu tam yazıp tekrar deneyin.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

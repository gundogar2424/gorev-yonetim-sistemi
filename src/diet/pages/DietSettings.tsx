import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import DietHeader from '../DietHeader'
import { dietDb, readDietSettings, saveDietSettings } from '../db'
import { badgesForStreak, computeStats } from '../streak'
import { DEFAULT_MODEL, extractDietPlan } from '../ai'
import { fileToResizedDataUrl } from '../../lib/image'

export default function DietSettings() {
  const settings = useLiveQuery(() => readDietSettings(), [], undefined)
  const entries = useLiveQuery(() => dietDb.entries.toArray(), [], [])
  const stats = computeStats(entries ?? [])
  const { earned, locked } = badgesForStreak(stats.streak)

  const [showKey, setShowKey] = useState(false)
  const [msg, setMsg] = useState('')
  const [planBusy, setPlanBusy] = useState(false)
  const planFileRef = useRef<HTMLInputElement>(null)

  function flash(m: string) {
    setMsg(m)
    setTimeout(() => setMsg(''), 3000)
  }

  // Diyet listesinin fotografini cekip yapay zekayla metne cevir
  async function onPlanPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (planFileRef.current) planFileRef.current.value = ''
    if (!file) return
    if (!settings?.apiKey) {
      flash('Önce API anahtarını gir.')
      return
    }
    setPlanBusy(true)
    try {
      const dataUrl = await fileToResizedDataUrl(file, 1100, 0.85)
      const text = await extractDietPlan({ apiKey: settings.apiKey, photoDataUrl: dataUrl, model: settings.model })
      await saveDietSettings({ dietPlan: text })
      flash('Diyet listesi fotoğraftan okundu ve kaydedildi.')
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Liste okunamadı.')
    } finally {
      setPlanBusy(false)
    }
  }

  async function clearAll() {
    if (!confirm('TÜM diyet kayıtların ve ayarların silinecek. Emin misin?')) return
    await dietDb.entries.clear()
    await dietDb.settings.clear()
    flash('Tüm veriler silindi.')
  }

  return (
    <div>
      <DietHeader title="Ayarlar & Rozetler" />

      <div className="p-3 space-y-4">
        {msg && <p className="card p-3 bg-emerald-50 text-emerald-800 text-sm border-emerald-100">{msg}</p>}

        {/* Rozetler */}
        <section className="card p-4 space-y-3">
          <h2 className="font-bold text-slate-700 text-sm uppercase tracking-wide">Rozetlerin</h2>
          <p className="text-xs text-slate-500">
            {stats.streak} günlük serinle {earned.length} rozet kazandın.
          </p>
          <div className="grid grid-cols-4 gap-2">
            {earned.map((b) => (
              <div key={b.days} className="text-center bg-emerald-50 rounded-xl p-2" title={b.desc}>
                <div className="text-2xl">{b.emoji}</div>
                <div className="text-[10px] font-semibold text-emerald-800 leading-tight mt-0.5">{b.name}</div>
              </div>
            ))}
            {locked.map((b) => (
              <div key={b.days} className="text-center bg-slate-100 rounded-xl p-2 opacity-60" title={`${b.days} günde açılır`}>
                <div className="text-2xl grayscale">🔒</div>
                <div className="text-[10px] font-semibold text-slate-500 leading-tight mt-0.5">{b.days} gün</div>
              </div>
            ))}
          </div>
        </section>

        {/* API anahtari */}
        <section className="card p-4 space-y-3">
          <h2 className="font-bold text-slate-700 text-sm uppercase tracking-wide">Yapay Zeka Anahtarı</h2>
          <p className="text-xs text-slate-500">
            Fotoğraf incelemesi Anthropic (Claude) ile yapılır. Kendi API anahtarınızı girin. Anahtar{' '}
            <span className="font-semibold">yalnızca bu cihazda</span> saklanır, hiçbir sunucuya gönderilmez.
          </p>
          <div className="flex gap-2">
            <input
              className="field-input"
              type={showKey ? 'text' : 'password'}
              placeholder="sk-ant-..."
              value={settings?.apiKey ?? ''}
              onChange={(e) => saveDietSettings({ apiKey: e.target.value.trim() })}
              autoComplete="off"
            />
            <button onClick={() => setShowKey((s) => !s)} className="btn-ghost px-3">
              {showKey ? '🙈' : '👁️'}
            </button>
          </div>
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-emerald-700 underline"
          >
            Anahtar nasıl alınır? →
          </a>

          <div>
            <label className="field-label">Model (isteğe bağlı)</label>
            <input
              className="field-input"
              placeholder={DEFAULT_MODEL}
              value={settings?.model ?? ''}
              onChange={(e) => saveDietSettings({ model: e.target.value.trim() || DEFAULT_MODEL })}
            />
            <p className="text-[11px] text-slate-400 mt-1">Boş bırakırsan {DEFAULT_MODEL} kullanılır.</p>
          </div>
        </section>

        {/* Kisisellestirme */}
        <section className="card p-4 space-y-3">
          <h2 className="font-bold text-slate-700 text-sm uppercase tracking-wide">Seni Tanıyalım</h2>
          <p className="text-xs text-slate-500">Bu bilgiler, sözlerin sana özel olması için yapay zekaya iletilir.</p>
          <div>
            <label className="field-label">Adın</label>
            <input
              className="field-input"
              placeholder="örn. Ayşe"
              value={settings?.userName ?? ''}
              onChange={(e) => saveDietSettings({ userName: e.target.value })}
            />
          </div>
          <div>
            <label className="field-label">Diyet hedefin</label>
            <textarea
              className="field-input"
              rows={2}
              placeholder="örn. 6 ayda 10 kilo vermek, şekeri bırakmak"
              value={settings?.goal ?? ''}
              onChange={(e) => saveDietSettings({ goal: e.target.value })}
            />
          </div>
        </section>

        {/* Diyet listesi */}
        <section className="card p-4 space-y-3">
          <h2 className="font-bold text-slate-700 text-sm uppercase tracking-wide">Diyet Listem</h2>
          <p className="text-xs text-slate-500">
            Diyetisyeninin verdiği öğün listesini buraya ekle. Eklersen, çektiğin her yemeğin listene{' '}
            <span className="font-semibold">% kaç uyduğunu</span> görürsün. Elle yazabilir veya listenin fotoğrafını
            çekip okutabilirsin.
          </p>

          <button
            onClick={() => planFileRef.current?.click()}
            disabled={planBusy || !settings?.apiKey}
            className="btn-ghost w-full"
          >
            {planBusy ? 'Liste okunuyor…' : '📷 Listenin Fotoğrafını Çek (otomatik okusun)'}
          </button>
          <input
            ref={planFileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onPlanPhoto}
          />

          <div>
            <label className="field-label">Liste (elle düzenleyebilirsin)</label>
            <textarea
              className="field-input font-mono text-xs"
              rows={8}
              placeholder={'örn.\nKahvaltı: 2 yumurta, 1 dilim peynir, domates-salatalık\nÖğle: 120g ızgara tavuk + salata\nAkşam: sebze yemeği + yoğurt'}
              value={settings?.dietPlan ?? ''}
              onChange={(e) => saveDietSettings({ dietPlan: e.target.value })}
            />
          </div>
          {settings?.dietPlan?.trim() ? (
            <button onClick={() => saveDietSettings({ dietPlan: '' })} className="text-xs text-rose-500 underline">
              Listeyi temizle
            </button>
          ) : (
            <p className="text-[11px] text-slate-400">Liste boşsa uyum yüzdesi gösterilmez.</p>
          )}
        </section>

        {/* Tehlikeli bolge */}
        <section className="card p-4 space-y-2">
          <h2 className="font-bold text-slate-700 text-sm uppercase tracking-wide">Veri</h2>
          <button onClick={clearAll} className="btn-danger w-full">
            Tüm Diyet Verilerini Sil
          </button>
        </section>

        <p className="text-center text-xs text-slate-400 pt-1">
          Diyet Koçu · Verilerin yalnızca bu cihazda saklanır.
        </p>
      </div>
    </div>
  )
}

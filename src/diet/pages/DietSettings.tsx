import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import DietHeader from '../DietHeader'
import { dietDb, readDietSettings, saveDietSettings } from '../db'
import { badgesForStreak, computeStats } from '../streak'
import { DEFAULT_MODEL, extractDietPlan } from '../ai'
import { fileToResizedDataUrl } from '../../lib/image'
import { buildBackupData, parseDietBackup, restoreDietBackup, clearOldPhotos } from '../lib/backup'
import { saveJsonSmart } from '../lib/share'

export default function DietSettings() {
  const settings = useLiveQuery(() => readDietSettings(), [], undefined)
  const entries = useLiveQuery(() => dietDb.entries.toArray(), [], [])
  const stats = computeStats(entries ?? [])
  const { earned, locked } = badgesForStreak(stats.streak)

  const [showKey, setShowKey] = useState(false)
  const [msg, setMsg] = useState('')
  const [planBusy, setPlanBusy] = useState(false)
  const planFileRef = useRef<HTMLInputElement>(null)
  const restoreFileRef = useRef<HTMLInputElement>(null)

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

  // Yedek al: APK'da paylaş menüsü (WhatsApp/Drive/Dosyalar), web'de indir
  async function doBackup() {
    try {
      const b = await buildBackupData()
      const stamp = new Date().toISOString().slice(0, 10)
      const res = await saveJsonSmart(JSON.stringify(b), `diyet-yedek-${stamp}.json`)
      const ozet = `${b.entries.length} öğün, ${b.measurements.length} ölçü, ${b.vitals.length} sağlık`
      if (res === 'shared') flash(`Yedek hazır (${ozet}) — kaydet/gönder menüsünü kullan.`)
      else if (res === 'copied') flash(`Yedek indirildi (${ozet}).`)
      else if (res === 'cancelled') flash('')
      else flash('Yedekleme başarısız.')
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Yedekleme başarısız.')
    }
  }

  // Yedekten geri yukle
  async function onRestoreFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (restoreFileRef.current) restoreFileRef.current.value = ''
    if (!file) return
    try {
      const b = parseDietBackup(await file.text())
      const mode = confirm(
        `Yedekte ${b.entries.length} öğün var.\n\nTAMAM = mevcut verinin yerine koy (sil & geri yükle)\nİPTAL = mevcut verinin üstüne ekle (birleştir)`
      )
        ? 'replace'
        : 'merge'
      const res = await restoreDietBackup(b, mode)
      flash(`Geri yüklendi: ${res.entries} öğün, ${res.measurements} ölçü, ${res.vitals} sağlık.`)
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Geri yükleme başarısız.')
    }
  }

  // Eski fotograflari sil (yer ac)
  async function doClearPhotos() {
    if (!confirm('Son 7 gün hariç eski yemek fotoğrafları silinecek (kayıtlar kalır, yer açılır). Devam?')) return
    const n = await clearOldPhotos(7)
    flash(n > 0 ? `${n} eski fotoğraf silindi, yer açıldı.` : 'Silinecek eski fotoğraf yok.')
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

        {/* Hedefler */}
        <section className="card p-4 space-y-3">
          <h2 className="font-bold text-slate-700 text-sm uppercase tracking-wide">Hedeflerim</h2>
          <p className="text-xs text-slate-500">
            Boş bırakırsan kalori ve haftalık egzersiz hedefi gizli kalır.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="field-label">🔥 Kalori</label>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                className="field-input"
                placeholder="örn 1800"
                value={settings?.calorieGoal ?? ''}
                onChange={(e) => saveDietSettings({ calorieGoal: e.target.value ? Math.max(0, Number(e.target.value)) : undefined })}
              />
            </div>
            <div>
              <label className="field-label">🏃 Egzersiz/hafta</label>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                className="field-input"
                placeholder="örn 4"
                value={settings?.weeklyExerciseGoal ?? ''}
                onChange={(e) =>
                  saveDietSettings({ weeklyExerciseGoal: e.target.value ? Math.max(0, Number(e.target.value)) : undefined })
                }
              />
            </div>
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
            {planBusy ? 'Liste okunuyor…' : '📷 Liste Fotoğrafı (çek veya galeriden seç)'}
          </button>
          <input ref={planFileRef} type="file" accept="image/*" className="hidden" onChange={onPlanPhoto} />

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

        {/* Yedekleme & yer acma */}
        <section className="card p-4 space-y-3">
          <h2 className="font-bold text-slate-700 text-sm uppercase tracking-wide">Yedekleme & Yer Açma</h2>
          <p className="text-xs text-slate-500">
            Tüm öğünlerin, ölçülerin ve sağlık verilerin tek dosyaya iner. Telefon değiştirince veya silmeden önce
            yedek al; istediğinde geri yükle. (Güvenlik için API anahtarı yedeğe yazılmaz.)
          </p>
          <button onClick={doBackup} className="btn-primary w-full">
            ⬇️ Yedeği İndir
          </button>
          <button onClick={() => restoreFileRef.current?.click()} className="btn-ghost w-full">
            ⬆️ Yedekten Geri Yükle
          </button>
          <input
            ref={restoreFileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={onRestoreFile}
          />
          <button onClick={doClearPhotos} className="btn-ghost w-full">
            🧹 Eski Fotoğrafları Sil (yer aç)
          </button>
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

import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import DietHeader from '../DietHeader'
import { dietDb, readDietSettings, saveDietSettings } from '../db'
import { badgesForStreak, computeStats } from '../streak'
import { DEFAULT_MODEL, extractDietPlan } from '../ai'
import { fileToResizedDataUrl } from '../../lib/image'
import { buildBackupData, parseDietBackup, restoreDietBackup, clearOldPhotos } from '../lib/backup'
import { saveJsonSmart } from '../lib/share'
import { getUsage, resetUsage, todayUsage, bucketTokens, estimateCostUsd } from '../lib/usage'
import { getThemePref, setThemePref, type ThemePref } from '../lib/theme'

export default function DietSettings() {
  const settings = useLiveQuery(() => readDietSettings(), [], undefined)
  const entries = useLiveQuery(() => dietDb.entries.toArray(), [], [])
  const stats = computeStats(entries ?? [])
  const { earned, locked } = badgesForStreak(stats.streak)

  const [showKey, setShowKey] = useState(false)
  const [msg, setMsg] = useState('')
  const [planBusy, setPlanBusy] = useState(false)
  const planCameraRef = useRef<HTMLInputElement>(null)
  const planGalleryRef = useRef<HTMLInputElement>(null)
  const restoreFileRef = useRef<HTMLInputElement>(null)

  function flash(m: string) {
    setMsg(m)
    setTimeout(() => setMsg(''), 3000)
  }

  // Diyet listesinin fotografini cekip yapay zekayla metne cevir
  async function onPlanPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
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

        {/* Gorunum: tema secici */}
        <ThemeSelector />

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
            Fotoğraf incelemesi Claude ile yapılır. Kendi API anahtarını gir; anahtar{' '}
            <span className="font-semibold">yalnızca bu cihazda</span> saklanır.
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

        {/* Token kullanimi (bu cihazda) */}
        <UsageCard model={settings?.model} />

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
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="field-label">Boy (cm)</label>
              <input
                type="number"
                inputMode="numeric"
                className="field-input"
                placeholder="örn. 175"
                value={settings?.heightCm ?? ''}
                onChange={(e) => saveDietSettings({ heightCm: e.target.value ? Math.max(0, Number(e.target.value)) : undefined })}
              />
            </div>
            <div>
              <label className="field-label">Yaş</label>
              <input
                type="number"
                inputMode="numeric"
                className="field-input"
                placeholder="örn. 30"
                value={settings?.age ?? ''}
                onChange={(e) => saveDietSettings({ age: e.target.value ? Math.max(0, Number(e.target.value)) : undefined })}
              />
            </div>
            <div>
              <label className="field-label">Cinsiyet</label>
              <select
                className="field-input"
                value={settings?.gender ?? ''}
                onChange={(e) => saveDietSettings({ gender: (e.target.value || undefined) as 'kadın' | 'erkek' | undefined })}
              >
                <option value="">—</option>
                <option value="kadın">Kadın</option>
                <option value="erkek">Erkek</option>
              </select>
            </div>
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
          <div>
            <label className="field-label">☕ Alışkanlıkların / tercihlerin</label>
            <textarea
              className="field-input"
              rows={2}
              placeholder="örn. Kahveyi ve çayı ŞEKERSİZ içerim, ekmek olarak tam buğday yerim, kızartma yemem"
              value={settings?.preferences ?? ''}
              onChange={(e) => saveDietSettings({ preferences: e.target.value })}
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Yapay zeka her analizde bunu dikkate alır (örn. kahveni şekerli sanmaz).
            </p>
          </div>
          <div>
            <label className="field-label">💊 Kullandığın ilaçlar</label>
            <textarea
              className="field-input"
              rows={2}
              placeholder="örn. Metformin 1000 mg (sabah-akşam), tansiyon ilacı"
              value={settings?.medications ?? ''}
              onChange={(e) => saveDietSettings({ medications: e.target.value })}
            />
          </div>
          <div>
            <label className="field-label">🩺 Kronik rahatsızlıkların (isteğe bağlı)</label>
            <textarea
              className="field-input"
              rows={2}
              placeholder="örn. Tip 2 diyabet, hipertansiyon"
              value={settings?.conditions ?? ''}
              onChange={(e) => saveDietSettings({ conditions: e.target.value })}
            />
          </div>
          <p className="text-xs text-slate-500">
            İlaç ve rahatsızlıklar, Tahliller bölümündeki sağlık değerlendirmesinde birlikte dikkate alınır.
          </p>
          <div>
            <label className="field-label">📋 Diyetisyenin talimatları</label>
            <textarea
              className="field-input"
              rows={3}
              placeholder="örn. Porsiyonları küçült, akşam 20:00'den sonra karbonhidrat yok, günde 2.5 lt su"
              value={settings?.dietitianNotes ?? ''}
              onChange={(e) => saveDietSettings({ dietitianNotes: e.target.value })}
            />
            <p className="text-xs text-slate-500 mt-1">
              Diyetisyeninin söylediklerini buraya yaz; koç her değerlendirmede bu talimatlara uyar.
            </p>
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
            <div>
              <label className="field-label">🎯 Hedef kilo (kg)</label>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                className="field-input"
                placeholder="örn 75"
                value={settings?.targetWeight ?? ''}
                onChange={(e) =>
                  saveDietSettings({ targetWeight: e.target.value ? Math.max(0, Number(e.target.value.replace(',', '.'))) : undefined })
                }
              />
            </div>
            <div>
              <label className="field-label">⚖️ Başlangıç kilosu</label>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                className="field-input"
                placeholder="boşsa ilk ölçü"
                value={settings?.startWeight ?? ''}
                onChange={(e) =>
                  saveDietSettings({ startWeight: e.target.value ? Math.max(0, Number(e.target.value.replace(',', '.'))) : undefined })
                }
              />
            </div>
          </div>
          <p className="text-xs text-slate-500">
            🎯 Hedef kiloyu girersen ana ekranda “ne kadar verdin / ne kaldı” görünür. Başlangıç boşsa ilk tartın esas alınır.
          </p>
        </section>

        {/* Diyet listesi */}
        <section className="card p-4 space-y-3">
          <h2 className="font-bold text-slate-700 text-sm uppercase tracking-wide">Diyet Listem</h2>
          <p className="text-xs text-slate-500">
            Diyet listeni buraya ekle; her yemeğin listene{' '}
            <span className="font-semibold">% kaç uyduğunu</span> görürsün. Yazabilir ya da fotoğrafını okutabilirsin.
          </p>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => planCameraRef.current?.click()}
              disabled={planBusy || !settings?.apiKey}
              className="btn bg-slate-200 text-slate-700 hover:bg-slate-300"
            >
              {planBusy ? 'Okunuyor…' : '📷 Fotoğraf Çek'}
            </button>
            <button
              onClick={() => planGalleryRef.current?.click()}
              disabled={planBusy || !settings?.apiKey}
              className="btn bg-slate-200 text-slate-700 hover:bg-slate-300"
            >
              🖼️ Galeriden Seç
            </button>
          </div>
          <input ref={planCameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPlanPhoto} />
          <input ref={planGalleryRef} type="file" accept="image/*" className="hidden" onChange={onPlanPhoto} />

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
            Tüm verilerin ve API anahtarın tek dosyaya iner. Silmeden önce yedek al, yeniden kurunca geri yükle. (Yedek kişiseldir, paylaşma.)
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
          Diyet Koçu · Sürüm {__APP_BUILD__} · Verilerin yalnızca bu cihazda saklanır.
        </p>
      </div>
    </div>
  )
}

// Gorunum temasi: Otomatik (telefon ayarina uyar) / Açık / Koyu
function ThemeSelector() {
  const [pref, setPref] = useState<ThemePref>(getThemePref())
  const opts: { v: ThemePref; label: string; emoji: string }[] = [
    { v: 'auto', label: 'Otomatik', emoji: '🌗' },
    { v: 'light', label: 'Açık', emoji: '☀️' },
    { v: 'dark', label: 'Koyu', emoji: '🌙' }
  ]
  function pick(v: ThemePref) {
    setPref(v)
    setThemePref(v)
  }
  return (
    <section className="card p-4 space-y-3">
      <h2 className="font-bold text-slate-700 text-sm uppercase tracking-wide">Görünüm</h2>
      <p className="text-xs text-slate-500">
        Otomatik: telefonun ayarına uyar. Dilersen sabitle.
      </p>
      <div className="grid grid-cols-3 gap-2">
        {opts.map((o) => (
          <button
            key={o.v}
            onClick={() => pick(o.v)}
            className={`rounded-xl py-2.5 text-sm font-bold border transition ${
              pref === o.v
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-slate-50 text-slate-600 border-slate-200'
            }`}
          >
            <span className="block text-lg leading-none mb-0.5">{o.emoji}</span>
            {o.label}
          </button>
        ))}
      </div>
    </section>
  )
}

// Bu cihazda uygulamanin harcadigi token (Ayarlar). Kalan bakiye API'den
// alinamaz; net kredi/fatura icin Anthropic Console'a yonlendirir.
function UsageCard({ model }: { model?: string }) {
  const [tick, setTick] = useState(0)
  const u = getUsage() // her render'da taze oku (tick ile yenilenir)
  const today = todayUsage()
  const fmt = (n: number) => n.toLocaleString('tr-TR')
  const m = (model || 'claude-opus-4-8').toLowerCase()
  const priceLabel = m.includes('haiku') ? 'Haiku' : m.includes('sonnet') ? 'Sonnet' : 'Opus'

  function refresh() {
    setTick((t) => t + 1)
  }
  function reset() {
    if (!confirm('Token sayacı sıfırlansın mı? (Sadece bu cihazdaki sayaç; faturanı etkilemez.)')) return
    resetUsage()
    refresh()
  }

  return (
    <section className="card p-4 space-y-3" data-tick={tick}>
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-slate-700 text-sm uppercase tracking-wide">Token Kullanımı</h2>
        <button onClick={refresh} className="text-xs text-emerald-700 underline">Yenile</button>
      </div>
      <p className="text-xs text-slate-500">
        Bu cihazda uygulamanın harcadığı token. <span className="font-semibold">Kalan bakiye değildir</span> — onu API
        vermez.
      </p>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-emerald-50 p-3">
          <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide">Bugün</p>
          <p className="text-xl font-extrabold text-emerald-800">{fmt(bucketTokens(today))}</p>
          <p className="text-[11px] text-emerald-700/80">token · {today.calls} işlem</p>
          <p className="text-[11px] text-emerald-700/80">≈ ${estimateCostUsd(today, model).toFixed(3)}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Toplam</p>
          <p className="text-xl font-extrabold text-slate-800">{fmt(bucketTokens(u.total))}</p>
          <p className="text-[11px] text-slate-500">token · {u.total.calls} işlem</p>
          <p className="text-[11px] text-slate-500">≈ ${estimateCostUsd(u.total, model).toFixed(2)}</p>
        </div>
      </div>

      <p className="text-[11px] text-slate-400">
        Maliyet <span className="font-semibold">{priceLabel} fiyatıyla</span> kaba tahmindir. Kalan kredini ve net faturanı{' '}
        <a href="https://console.anthropic.com/settings/billing" target="_blank" rel="noreferrer" className="text-emerald-700 underline">
          Anthropic Console
        </a>
        ’dan görür, oradan kredi yükleyebilirsin.
      </p>

      <button onClick={reset} className="text-xs text-slate-400 underline">Sayacı sıfırla</button>
    </section>
  )
}

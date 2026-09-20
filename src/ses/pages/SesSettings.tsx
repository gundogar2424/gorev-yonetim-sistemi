import { useRef, useState } from 'react'
import SesHeader from '../SesHeader'
import Switch from '../components/Switch'
import { DISCLAIMER, EXERCISES, PROGRAM_DESC, PROGRAM_LABEL, type Program } from '../lib/content'
import { SOURCES } from '../lib/sources'
import { DEXERCISES, DGROUP_LABEL, DTEMPO_LABEL, type DGroup, type DTempo } from '../lib/diksiyon'
import { applyProgram, downloadBackup, LEVEL_LABEL, PACE_LABEL, readSessions, readSettings, restoreBackup, saveSettings, wipeAll, type Level, type Pace, type Reminder } from '../lib/store'
import { getBigText, getThemePref, setBigText, setThemePref, type ThemePref } from '../lib/theme'
import { sfxSample } from '../lib/sound'
import { unlockAudio } from '../lib/audioCtx'
import { ensurePermission, isNative, scheduleReminders } from '../lib/notify'

export default function SesSettings() {
  const [ayar, setAyar] = useState(readSettings())
  const [tema, setTema] = useState<ThemePref>(getThemePref())
  const [buyuk, setBuyuk] = useState(getBigText())
  const [durum, setDurum] = useState('')
  const [hata, setHata] = useState('')
  const [sayi, setSayi] = useState(readSessions().length)
  const dosyaRef = useRef<HTMLInputElement>(null)

  function bilgi(m: string) {
    setDurum(m)
    setHata('')
    setTimeout(() => setDurum(''), 2200)
  }

  async function geriYukle(file?: File) {
    if (!file) return
    try {
      const n = await restoreBackup(file)
      setAyar(readSettings())
      setTema(getThemePref())
      setBuyuk(getBigText())
      setSayi(readSessions().length)
      await scheduleReminders(readSettings().reminders).catch(() => {})
      bilgi(`${n} kayıt geri yüklendi ✔`)
    } catch (e) {
      setHata((e as Error).message)
    }
  }

  async function hatirlaticiKaydet(list: Reminder[]) {
    const next = saveSettings({ reminders: list })
    setAyar(next)
    if (!isNative()) return
    try {
      if (list.some((r) => r.enabled)) {
        const ok = await ensurePermission()
        if (!ok) {
          setHata('Bildirim izni verilmedi. Telefon ayarlarından uygulamaya bildirim izni ver.')
          return
        }
      }
      await scheduleReminders(list)
      setHata('')
    } catch (e) {
      setHata('Hatırlatıcı kurulamadı: ' + String((e as Error)?.message ?? e))
    }
  }

  return (
    <div>
      <SesHeader title="Ayarlar" subtitle={`Ses Egzersizi · sürüm ${__APP_BUILD__}`} />
      <div className="px-4 space-y-5 pb-6">
        {durum && <div className="ses-card py-3 text-[16px] text-emerald-700 bg-emerald-50">{durum}</div>}
        {hata && <div className="ses-card py-3 text-[16px] text-rose-600 bg-rose-50 whitespace-pre-wrap">{hata}</div>}

        <section className="ses-card space-y-3">
          <h3 className="ses-label">Kişisel</h3>
          <label className="block">
            <span className="text-[16px] text-slate-700 dark:text-[#e2d5cd]">Adın (selamlamada kullanılır)</span>
            <input className="ses-input mt-1" value={ayar.name} placeholder="örn. Ayşe" onChange={(e) => setAyar(saveSettings({ name: e.target.value.slice(0, 24) }))} />
          </label>
        </section>

        <section className="ses-card space-y-3">
          <h3 className="ses-label">Seans</h3>
          <div>
            <span className="text-[16px] text-slate-700 dark:text-[#e2d5cd]">Yoğunluk (tekrar sayısı)</span>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {(['hafif', 'orta', 'yogun'] as Level[]).map((v) => (
                <button key={v} onClick={() => setAyar(saveSettings({ level: v }))} className={`min-h-[50px] rounded-2xl text-[16px] font-semibold transition ${ayar.level === v ? 'bg-ses-600 text-white' : 'bg-slate-100 dark:bg-[#352820] text-slate-700 dark:text-[#f5ece4]'}`}>
                  {LEVEL_LABEL[v]}
                </button>
              ))}
            </div>
            <p className="text-[14px] text-slate-700 dark:text-[#d8c8bf] mt-1">Hafif: %60 · Orta: standart · Yoğun: %140. Sesin yorgunsa Hafif seç.</p>
          </div>
          <div>
            <span className="text-[16px] text-slate-700 dark:text-[#e2d5cd]">Tempo (tekrar araları)</span>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {(['normal', 'yavas'] as Pace[]).map((v) => (
                <button key={v} onClick={() => setAyar(saveSettings({ pace: v }))} className={`min-h-[50px] rounded-2xl text-[16px] font-semibold transition ${ayar.pace === v ? 'bg-ses-600 text-white' : 'bg-slate-100 dark:bg-[#352820] text-slate-700 dark:text-[#f5ece4]'}`}>
                  {PACE_LABEL[v]}
                </button>
              ))}
            </div>
            <p className="text-[14px] text-slate-700 dark:text-[#d8c8bf] mt-1">Tekrarlar arasında yetişemiyorsan Yavaş seç: aralar %60 uzar, geri sayım 5 saniye olur.</p>
          </div>
          <Switch label="Her tekrardan önce 3-2-1 geri sayım" checked={ayar.countdown} onChange={(v) => setAyar(saveSettings({ countdown: v }))} />
          <p className="text-[14px] text-slate-700 dark:text-[#d8c8bf] -mt-1">Geri sayım her tekrardan önce çalışır; nefes alıp hazırlanman için zaman bırakır.</p>
          <div>
            <span className="text-[16px] text-slate-700 dark:text-[#e2d5cd]">Günlük hedef (seans sayısı)</span>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {[1, 2, 3].map((n) => (
                <button key={n} onClick={() => setAyar(saveSettings({ dailyGoal: n }))} className={`min-h-[50px] rounded-2xl text-[16px] font-semibold transition ${ayar.dailyGoal === n ? 'bg-ses-600 text-white' : 'bg-slate-100 dark:bg-[#352820] text-slate-700 dark:text-[#f5ece4]'}`}>
                  {n} / gün
                </button>
              ))}
            </div>
            <p className="text-[14px] text-slate-700 dark:text-[#d8c8bf] mt-1">Araştırmalarda etkili bulunan doz günde 2 kısa seans (sabah/akşam), 6-8 hafta. Ana sayfadaki hedef kartı buna göre işler.</p>
          </div>
        </section>

        <section className="ses-card space-y-3">
          <h3 className="ses-label">Program (kanıta dayalı ön ayar)</h3>
          {(['felc', 'presbifoni', 'genel'] as Program[]).map((p) => (
            <button
              key={p}
              onClick={() => {
                if (ayar.program === p || confirm('Program değişince kapalı egzersiz listesi bu programa göre yeniden kurulur. Devam?')) setAyar(applyProgram(p))
              }}
              className={`w-full text-left rounded-2xl p-3 border-2 transition ${ayar.program === p ? 'border-ses-600 bg-ses-50 dark:bg-[#352820]' : 'border-slate-200 dark:border-[#4a3a30]'}`}
            >
              <span className="block text-[16px] font-semibold text-slate-900 dark:text-[#f5ece4]">{PROGRAM_LABEL[p]}</span>
              <span className="block text-[14px] text-slate-700 dark:text-[#e2d5cd] mt-0.5">{PROGRAM_DESC[p]}</span>
            </button>
          ))}
        </section>

        <section className="ses-card space-y-2">
          <h3 className="ses-label">Seanstaki egzersizler</h3>
          <p className="text-[14px] text-slate-700 dark:text-[#d8c8bf]">Program ön ayarının üstüne tek tek düzenle; hekimin/terapistin önermediklerini kapat.</p>
          {EXERCISES.map((e) => (
            <Switch
              key={e.id}
              label={`${e.emoji} ${e.name}`}
              checked={!ayar.disabled.includes(e.id)}
              onChange={(v) => setAyar(saveSettings({ disabled: v ? ayar.disabled.filter((x) => x !== e.id) : [...ayar.disabled, e.id] }))}
            />
          ))}
        </section>

        <section className="ses-card space-y-3">
          <h3 className="ses-label">Diksiyon</h3>
          <div>
            <span className="text-[16px] text-slate-700 dark:text-[#e2d5cd]">Okuma temposu</span>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {(['yavas', 'orta', 'hizli'] as DTempo[]).map((v) => (
                <button key={v} onClick={() => setAyar(saveSettings({ dTempo: v }))} className={`min-h-[50px] rounded-2xl text-[16px] font-semibold transition ${ayar.dTempo === v ? 'bg-ses-600 text-white' : 'bg-slate-100 dark:bg-[#352820] text-slate-700 dark:text-[#f5ece4]'}`}>
                  {DTEMPO_LABEL[v]}
                </button>
              ))}
            </div>
            <p className="text-[14px] text-slate-700 dark:text-[#d8c8bf] mt-1">Her satır için verilen süreyi ayarlar. Başlarken Yavaş seç; netleşince hızlan.</p>
          </div>
          <Switch
            label="Konuşma tanıma ile puanlama"
            hint="Her satırda söylediğin yazıya çevrilir, hedefle karşılaştırılıp % doğruluk verilir. Ses kaydedilmez."
            checked={ayar.score}
            onChange={(v) => setAyar(saveSettings({ score: v }))}
          />
          <p className="text-[14px] text-slate-700 dark:text-[#d8c8bf]">Diksiyon seansındaki egzersizler:</p>
          {(['nefes', 'sesli', 'unsuz', 'tekerleme', 'kalem', 'vurgu'] as DGroup[]).map((g) => (
            <div key={g}>
              <div className="text-[13px] font-semibold text-slate-600 dark:text-[#cdbdb3] mt-2 mb-1">{DGROUP_LABEL[g]}</div>
              {DEXERCISES.filter((e) => e.group === g).map((e) => (
                <Switch
                  key={e.id}
                  label={`${e.emoji} ${e.name}`}
                  checked={!ayar.dDisabled.includes(e.id)}
                  onChange={(v) => setAyar(saveSettings({ dDisabled: v ? ayar.dDisabled.filter((x) => x !== e.id) : [...ayar.dDisabled, e.id] }))}
                />
              ))}
            </div>
          ))}
        </section>

        <section className="ses-card space-y-3">
          <h3 className="ses-label">Yapay zeka geri bildirimi</h3>
          <p className="text-[14px] text-slate-700 dark:text-[#d8c8bf]">
            Seans sonunda sonuçların (doğruluk, yutulan sözcükler, hız, öz değerlendirme, MPT) Claude'a gönderilir ve kısa bir yazılı geri bildirim alırsın. Ses kaydı gönderilmez; yapay zeka sesi duymaz, yalnızca yazıya çevrilmiş metni ve sayıları değerlendirir. Anahtar yalnızca bu cihazda saklanır, yedeğe yazılmaz.
          </p>
          <label className="block">
            <span className="text-[16px] text-slate-700 dark:text-[#e2d5cd]">Claude API anahtarı</span>
            <input
              className="ses-input mt-1"
              type="password"
              autoComplete="off"
              value={ayar.apiKey}
              placeholder="sk-ant-…"
              onChange={(e) => setAyar(saveSettings({ apiKey: e.target.value.trim() }))}
            />
          </label>
          <p className="text-[13px] text-slate-600 dark:text-[#cdbdb3]">
            Anahtar console.anthropic.com › API Keys bölümünden alınır. {ayar.apiKey ? `Kayıtlı: ${ayar.apiKey.length} karakter, sonu …${ayar.apiKey.slice(-4)}` : 'Henüz anahtar yok.'}
          </p>
        </section>

        <section className="ses-card space-y-3">
          <h3 className="ses-label">Günlük hatırlatma</h3>
          {!isNative() && <p className="text-[14px] text-slate-700 dark:text-[#d8c8bf]">Bildirimler yalnızca telefona kurulan uygulamada (APK) çalışır.</p>}
          {ayar.reminders.map((r) => (
            <div key={r.id} className="flex items-center gap-3">
              <input
                type="time"
                className="ses-input flex-1"
                value={r.time}
                onChange={(e) => {
                  const t = e.target.value
                  if (!/^\d{2}:\d{2}$/.test(t)) return
                  void hatirlaticiKaydet(ayar.reminders.map((x) => (x.id === r.id ? { ...x, time: t } : x)))
                }}
              />
              <button
                onClick={() => void hatirlaticiKaydet(ayar.reminders.map((x) => (x.id === r.id ? { ...x, enabled: !x.enabled } : x)))}
                className={`min-h-[50px] px-4 rounded-2xl text-[16px] font-semibold transition ${r.enabled ? 'bg-ses-600 text-white' : 'bg-slate-100 dark:bg-[#352820] text-slate-700 dark:text-[#f5ece4]'}`}
              >
                {r.enabled ? 'Açık' : 'Kapalı'}
              </button>
            </div>
          ))}
        </section>

        <section className="ses-card space-y-3">
          <h3 className="ses-label">Geri bildirim</h3>
          <Switch
            label="Sesli işaret"
            hint="Geri sayım tıkı, başla/dinlen sesi"
            checked={ayar.sound}
            onChange={(v) => {
              setAyar(saveSettings({ sound: v }))
              if (v) {
                unlockAudio()
                sfxSample()
              }
            }}
          />
          <Switch label="Titreşim" checked={ayar.vibrate} onChange={(v) => setAyar(saveSettings({ vibrate: v }))} />
        </section>

        <section className="ses-card space-y-3">
          <h3 className="ses-label">Görünüm</h3>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ['auto', 'Otomatik'],
                ['light', 'Açık'],
                ['dark', 'Koyu']
              ] as [ThemePref, string][]
            ).map(([v, l]) => (
              <button
                key={v}
                onClick={() => {
                  setThemePref(v)
                  setTema(v)
                }}
                className={`min-h-[50px] rounded-2xl text-[16px] font-semibold transition ${tema === v ? 'bg-ses-600 text-white' : 'bg-slate-100 dark:bg-[#352820] text-slate-700 dark:text-[#f5ece4]'}`}
              >
                {l}
              </button>
            ))}
          </div>
          <Switch
            label="Büyük yazı"
            hint="Tüm yazıları yaklaşık %15 büyütür"
            checked={buyuk}
            onChange={(v) => {
              setBigText(v)
              setBuyuk(v)
            }}
          />
        </section>

        <section className="ses-card space-y-3">
          <h3 className="ses-label">Yedek</h3>
          <p className="text-[15px] text-slate-700 dark:text-[#d8c8bf]">{sayi} seans kayıtlı. Veriler yalnızca bu telefonda.</p>
          <button className="ses-btn-soft w-full" onClick={downloadBackup}>
            ⬇️ Yedeği indir
          </button>
          <button className="ses-btn-ghost w-full" onClick={() => dosyaRef.current?.click()}>
            ⬆️ Yedekten geri yükle
          </button>
          <input ref={dosyaRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void geriYukle(e.target.files?.[0])} />
          <button
            className="ses-btn-danger w-full"
            onClick={() => {
              if (confirm('Tüm seanslar, ölçümler ve ayarlar silinsin mi? Bu geri alınamaz.')) {
                wipeAll()
                setAyar(readSettings())
                setSayi(0)
                bilgi('Tüm veriler silindi')
              }
            }}
          >
            Tüm verileri sil
          </button>
        </section>

        <section className="ses-card space-y-2">
          <h3 className="ses-label">Kaynaklar</h3>
          <p className="text-[14px] text-slate-700 dark:text-[#d8c8bf]">Egzersiz seçimi, dozu ve ölçüm eşikleri aşağıdaki çalışmalara dayanır. Bağlantılar özet sayfalarını açar.</p>
          <ul className="space-y-2">
            {SOURCES.map((k) => (
              <li key={k.url} className="text-[14px]">
                <a href={k.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-ses-700 dark:text-ses-300 underline">
                  {k.title}
                </a>
                <span className="block text-slate-700 dark:text-[#e2d5cd]">{k.note}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="ses-card space-y-2">
          <h3 className="ses-label">Önemli uyarı</h3>
          <ul className="space-y-2">
            {DISCLAIMER.map((m, i) => (
              <li key={i} className="flex gap-2 text-[15px] text-slate-700 dark:text-[#e2d5cd]">
                <span className="text-ses-600">•</span>
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}

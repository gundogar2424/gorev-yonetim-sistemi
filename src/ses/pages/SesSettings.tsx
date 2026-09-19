import { useRef, useState } from 'react'
import SesHeader from '../SesHeader'
import Switch from '../components/Switch'
import { DISCLAIMER, EXERCISES } from '../lib/content'
import { downloadBackup, LEVEL_LABEL, readSessions, readSettings, restoreBackup, saveSettings, wipeAll, type Level, type Reminder } from '../lib/store'
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
      <div className="px-4 space-y-4 pb-6">
        {durum && <div className="ses-card py-3 text-[15px] text-emerald-700 bg-emerald-50">{durum}</div>}
        {hata && <div className="ses-card py-3 text-[15px] text-rose-600 bg-rose-50 whitespace-pre-wrap">{hata}</div>}

        <section className="ses-card space-y-3">
          <h3 className="ses-label">Kişisel</h3>
          <label className="block">
            <span className="text-[15px] text-slate-600 dark:text-[#d8c8bf]">Adın (selamlamada kullanılır)</span>
            <input className="ses-input mt-1" value={ayar.name} placeholder="örn. Ayşe" onChange={(e) => setAyar(saveSettings({ name: e.target.value.slice(0, 24) }))} />
          </label>
        </section>

        <section className="ses-card space-y-3">
          <h3 className="ses-label">Seans</h3>
          <div>
            <span className="text-[15px] text-slate-600 dark:text-[#d8c8bf]">Yoğunluk (tekrar sayısı)</span>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {(['hafif', 'orta', 'yogun'] as Level[]).map((v) => (
                <button key={v} onClick={() => setAyar(saveSettings({ level: v }))} className={`min-h-[48px] rounded-2xl text-[15px] font-semibold transition ${ayar.level === v ? 'bg-ses-600 text-white' : 'bg-slate-100 dark:bg-[#352820] text-slate-700 dark:text-[#f5ece4]'}`}>
                  {LEVEL_LABEL[v]}
                </button>
              ))}
            </div>
            <p className="text-[13px] text-slate-500 dark:text-[#a3908a] mt-1">Hafif: %60 · Orta: standart · Yoğun: %140. Sesin yorgunsa Hafif seç.</p>
          </div>
          <Switch label="Her tekrardan önce 3-2-1 geri sayım" checked={ayar.countdown} onChange={(v) => setAyar(saveSettings({ countdown: v }))} />
        </section>

        <section className="ses-card space-y-2">
          <h3 className="ses-label">Seanstaki egzersizler</h3>
          <p className="text-[13px] text-slate-500 dark:text-[#a3908a]">Hekimin/terapistin önermediklerini kapat.</p>
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
          <h3 className="ses-label">Günlük hatırlatma</h3>
          {!isNative() && <p className="text-[13px] text-slate-500 dark:text-[#a3908a]">Bildirimler yalnızca telefona kurulan uygulamada (APK) çalışır.</p>}
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
                className={`min-h-[48px] px-4 rounded-2xl text-[15px] font-semibold transition ${r.enabled ? 'bg-ses-600 text-white' : 'bg-slate-100 dark:bg-[#352820] text-slate-700 dark:text-[#f5ece4]'}`}
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
                className={`min-h-[48px] rounded-2xl text-[15px] font-semibold transition ${tema === v ? 'bg-ses-600 text-white' : 'bg-slate-100 dark:bg-[#352820] text-slate-700 dark:text-[#f5ece4]'}`}
              >
                {l}
              </button>
            ))}
          </div>
          <Switch
            label="Büyük yazı"
            checked={buyuk}
            onChange={(v) => {
              setBigText(v)
              setBuyuk(v)
            }}
          />
        </section>

        <section className="ses-card space-y-3">
          <h3 className="ses-label">Yedek</h3>
          <p className="text-[14px] text-slate-500 dark:text-[#a3908a]">{sayi} seans kayıtlı. Veriler yalnızca bu telefonda.</p>
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
          <h3 className="ses-label">Önemli uyarı</h3>
          <ul className="space-y-2">
            {DISCLAIMER.map((m, i) => (
              <li key={i} className="flex gap-2 text-[14px] text-slate-600 dark:text-[#d8c8bf]">
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

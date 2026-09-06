import { useEffect, useRef, useState } from 'react'
import TmHeader from '../TmHeader'
import { readTmSettings, saveTmSettings, tmDb } from '../db'
import { downloadBackup, restoreBackup } from '../lib/backup'
import { getThemePref, setThemePref, type ThemePref } from '../lib/theme'

export default function TmSettings() {
  const [autoAdvance, setAutoAdvance] = useState(true)
  const [sound, setSound] = useState(true)
  const [keepAwake, setKeepAwake] = useState(true)
  const [tema, setTema] = useState<ThemePref>(getThemePref())
  const [durum, setDurum] = useState('')
  const [hata, setHata] = useState('')
  const [tarifSayisi, setTarifSayisi] = useState(0)
  const dosyaRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void readTmSettings().then((s) => {
      setAutoAdvance(s.autoAdvance)
      setSound(s.sound)
      setKeepAwake(s.keepAwake)
    })
    void tmDb.recipes.count().then(setTarifSayisi)
  }, [])

  async function kaydet(patch: Parameters<typeof saveTmSettings>[0], mesaj = 'Kaydedildi ✔') {
    await saveTmSettings(patch)
    setDurum(mesaj)
    setTimeout(() => setDurum(''), 1800)
  }

  async function geriYukle(file?: File) {
    if (!file) return
    setHata('')
    try {
      const { eklendi, atlandi } = await restoreBackup(file)
      setDurum(`${eklendi} tarif eklendi${atlandi ? `, ${atlandi} tanesi zaten vardı` : ''} ✔`)
      setTarifSayisi(await tmDb.recipes.count())
    } catch (e) {
      setHata((e as Error).message)
    }
  }

  return (
    <div>
      <TmHeader title="Ayarlar" subtitle={`Termomiks Defteri · sürüm ${__APP_BUILD__}`} />

      <div className="px-4 py-3 space-y-4">
        {durum && <div className="tm-card p-3 text-sm text-emerald-600 bg-emerald-50 dark:bg-[#252733]">{durum}</div>}
        {hata && <div className="tm-card p-3 text-sm text-rose-600 whitespace-pre-wrap bg-rose-50 dark:bg-[#252733]">{hata}</div>}

        {/* Pisirme modu */}
        <section className="tm-card space-y-3">
          <h3 className="tm-label">Pişirme modu</h3>
          <Switch
            label="Süre bitince sonraki adıma geç"
            checked={autoAdvance}
            onChange={(v) => {
              setAutoAdvance(v)
              void kaydet({ autoAdvance: v })
            }}
          />
          <Switch
            label="Süre bitince sesli uyarı + titreşim"
            checked={sound}
            onChange={(v) => {
              setSound(v)
              void kaydet({ sound: v })
            }}
          />
          <Switch
            label="Pişirirken ekran açık kalsın"
            checked={keepAwake}
            onChange={(v) => {
              setKeepAwake(v)
              void kaydet({ keepAwake: v })
            }}
          />
        </section>

        {/* Gorunum */}
        <section className="tm-card space-y-2">
          <h3 className="tm-label">Görünüm</h3>
          <div className="grid grid-cols-3 gap-2">
            {(['auto', 'light', 'dark'] as ThemePref[]).map((p) => (
              <button
                key={p}
                onClick={() => {
                  setThemePref(p)
                  setTema(p)
                }}
                className={`py-2.5 rounded-xl text-sm font-semibold border ${
                  tema === p
                    ? 'bg-tm-600 text-white border-tm-600'
                    : 'bg-white dark:bg-[#252733] text-slate-600 border-slate-200 dark:border-[#2f3240]'
                }`}
              >
                {p === 'auto' ? 'Otomatik' : p === 'light' ? 'Açık' : 'Koyu'}
              </button>
            ))}
          </div>
        </section>

        {/* Yedek */}
        <section className="tm-card space-y-3">
          <h3 className="tm-label">Yedekleme</h3>
          <p className="text-[12px] text-slate-500">
            Defterde {tarifSayisi} tarif var. Yedek tek bir dosyaya iner; telefon değişince geri yüklersin.
          </p>
          <div className="flex gap-2">
            <button onClick={() => void downloadBackup()} className="tm-btn-soft flex-1 py-2.5 text-sm">
              Yedeği indir
            </button>
            <button onClick={() => dosyaRef.current?.click()} className="tm-btn-soft flex-1 py-2.5 text-sm">
              Yedekten yükle
            </button>
          </div>
          <input
            ref={dosyaRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => void geriYukle(e.target.files?.[0])}
          />
        </section>

        <p className="text-[11px] text-slate-400 text-center px-4">
          Bu program Saha CRM ve Diyet Koçu’ndan tamamen ayrıdır; kendi veritabanını kullanır.
        </p>
      </div>
    </div>
  )
}

function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer">
      <span className="text-sm text-slate-700 dark:text-slate-300">{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="w-5 h-5 flex-shrink-0" />
    </label>
  )
}

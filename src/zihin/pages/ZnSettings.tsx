import { useRef, useState } from 'react'
import ZnHeader from '../ZnHeader'
import { downloadBackup, readResults, readSettings, restoreBackup, saveSettings, wipeAll } from '../lib/store'
import { getBigText, getThemePref, setBigText, setThemePref, type ThemePref } from '../lib/theme'
import { sfxCorrect } from '../lib/sound'

export default function ZnSettings() {
  const [ayar, setAyar] = useState(readSettings())
  const [tema, setTema] = useState<ThemePref>(getThemePref())
  const [buyuk, setBuyuk] = useState(getBigText())
  const [durum, setDurum] = useState('')
  const [hata, setHata] = useState('')
  const [sayi, setSayi] = useState(readResults().length)
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
      setSayi(readResults().length)
      bilgi(`${n} oturum geri yüklendi ✔`)
    } catch (e) {
      setHata((e as Error).message)
    }
  }

  return (
    <div>
      <ZnHeader title="Ayarlar" subtitle={`Zihin Jimnastiği · sürüm ${__APP_BUILD__}`} />
      <div className="px-4 space-y-4">
        {durum && <div className="zn-card py-3 text-[15px] text-emerald-700 bg-emerald-50">{durum}</div>}
        {hata && <div className="zn-card py-3 text-[15px] text-rose-600 bg-rose-50 whitespace-pre-wrap">{hata}</div>}

        <section className="zn-card space-y-3">
          <h3 className="zn-label">Kişisel</h3>
          <label className="block">
            <span className="text-[15px] text-slate-600 dark:text-[#b7b1c8]">Adın (selamlamada kullanılır)</span>
            <input
              className="mt-1 w-full rounded-2xl bg-slate-50 dark:bg-[#241f38] dark:text-[#ece8f7] px-4 py-3 text-[17px] outline-none focus:ring-4 focus:ring-zn-100"
              value={ayar.name}
              placeholder="örn. Ayşe"
              onChange={(e) => setAyar(saveSettings({ name: e.target.value.slice(0, 24) }))}
            />
          </label>
        </section>

        <section className="zn-card space-y-3">
          <h3 className="zn-label">Görünüm</h3>
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
                className={`min-h-[48px] rounded-2xl text-[15px] font-semibold transition ${
                  tema === v ? 'bg-zn-600 text-white' : 'bg-slate-100 dark:bg-[#241f38] text-slate-700 dark:text-[#d7d2e6]'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
          <Switch
            label="Büyük yazı"
            hint="Tüm yazılar ve düğmeler büyür"
            checked={buyuk}
            onChange={(v) => {
              setBigText(v)
              setBuyuk(v)
            }}
          />
        </section>

        <section className="zn-card space-y-3">
          <h3 className="zn-label">Geri bildirim</h3>
          <Switch
            label="Sesler"
            hint="Doğru/yanlış ve tebrik sesleri"
            checked={ayar.sound}
            onChange={(v) => {
              setAyar(saveSettings({ sound: v }))
              if (v) sfxCorrect()
            }}
          />
          <Switch label="Titreşim" checked={ayar.vibrate} onChange={(v) => setAyar(saveSettings({ vibrate: v }))} />
        </section>

        <section className="zn-card space-y-3">
          <h3 className="zn-label">Yedek</h3>
          <p className="text-[14px] text-slate-500 dark:text-[#8b849e]">
            Veriler yalnızca bu telefonda saklanır ({sayi} oturum). Telefon değişince yedeği alıp yeni cihazda geri yükle.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button className="zn-btn-soft" onClick={downloadBackup}>
              Yedeği indir
            </button>
            <button className="zn-btn-ghost" onClick={() => dosyaRef.current?.click()}>
              Geri yükle
            </button>
          </div>
          <input
            ref={dosyaRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              void geriYukle(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          <button
            className="zn-btn-danger w-full"
            onClick={() => {
              if (window.confirm('Tüm oyun geçmişi ve seviyeler silinsin mi? Bu işlem geri alınamaz.')) {
                wipeAll()
                setAyar(readSettings())
                setSayi(0)
                bilgi('Sıfırlandı')
              }
            }}
          >
            Her şeyi sıfırla
          </button>
        </section>

        <section className="zn-card space-y-2">
          <h3 className="zn-label">Bilmeniz gerekenler</h3>
          <p className="text-[15px] leading-relaxed text-slate-700 dark:text-[#d7d2e6]">
            Bu oyunlar Alzheimer ya da demansı <b>önlemez, tedavi etmez</b>; tanı aracı da değildir. Araştırmalar,
            zihni düzenli zorlayan uğraşların “bilişsel rezerv” oluşturduğunu ve belirtilerin ortaya çıkışını
            geciktirebileceğini gösteriyor. En güçlü koruyucu etkenler ise fiziksel hareket, tansiyon-şeker kontrolü,
            iyi uyku, işitmenin düzeltilmesi, sigarayı bırakmak ve sosyal bağlardır.
          </p>
          <p className="text-[15px] leading-relaxed text-slate-700 dark:text-[#d7d2e6]">
            Kendinizde ya da bir yakınınızda günlük yaşamı etkileyen unutkanlık fark ederseniz zaman kaybetmeden bir{' '}
            <b>nöroloji uzmanına</b> başvurun. Erken tanı, en fazla seçeneğin olduğu dönemdir.
          </p>
        </section>
      </div>
    </div>
  )
}

function Switch({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="w-full flex items-center justify-between gap-3 py-1 text-left">
      <span>
        <span className="block text-[16px] text-slate-800 dark:text-[#ece8f7]">{label}</span>
        {hint && <span className="block text-[13px] text-slate-500 dark:text-[#8b849e]">{hint}</span>}
      </span>
      <span className={`relative inline-flex h-8 w-14 flex-shrink-0 rounded-full transition ${checked ? 'bg-zn-600' : 'bg-slate-300 dark:bg-[#3a3157]'}`}>
        <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${checked ? 'left-7' : 'left-1'}`} />
      </span>
    </button>
  )
}

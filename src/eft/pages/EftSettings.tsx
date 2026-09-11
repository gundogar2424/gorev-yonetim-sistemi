import { useRef, useState } from 'react'
import EftHeader from '../EftHeader'
import Switch from '../components/Switch'
import { downloadBackup, readSessions, readSettings, restoreBackup, saveSettings, wipeAll, type Tempo } from '../lib/store'
import { getBigText, getThemePref, setBigText, setThemePref, type ThemePref } from '../lib/theme'
import { sfxSample } from '../lib/sound'
import { openTtsInstall, speak, speechSupported, turkishAvailable } from '../lib/speech'

export default function EftSettings() {
  const [ayar, setAyar] = useState(readSettings())
  const [tema, setTema] = useState<ThemePref>(getThemePref())
  const [buyuk, setBuyuk] = useState(getBigText())
  const [durum, setDurum] = useState('')
  const [hata, setHata] = useState('')
  const [sayi, setSayi] = useState(readSessions().length)
  const dosyaRef = useRef<HTMLInputElement>(null)
  const [sesDurum, setSesDurum] = useState<'' | 'var' | 'yok' | 'bilinmiyor'>('')

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
      bilgi(`${n} seans geri yüklendi ✔`)
    } catch (e) {
      setHata((e as Error).message)
    }
  }

  return (
    <div>
      <EftHeader title="Ayarlar" subtitle={`EFT Dokunma · sürüm ${__APP_BUILD__}`} />
      <div className="px-4 space-y-4">
        {durum && <div className="eft-card py-3 text-[15px] text-emerald-700 bg-emerald-50">{durum}</div>}
        {hata && <div className="eft-card py-3 text-[15px] text-rose-600 bg-rose-50 whitespace-pre-wrap">{hata}</div>}

        <section className="eft-card space-y-3">
          <h3 className="eft-label">Kişisel</h3>
          <label className="block">
            <span className="text-[15px] text-slate-600 dark:text-[#b7cbc9]">Adın (selamlamada kullanılır)</span>
            <input
              className="eft-input mt-1"
              value={ayar.name}
              placeholder="örn. Ayşe"
              onChange={(e) => setAyar(saveSettings({ name: e.target.value.slice(0, 24) }))}
            />
          </label>
        </section>

        <section className="eft-card space-y-3">
          <h3 className="eft-label">Vuruş ritmi</h3>
          <div>
            <span className="text-[15px] text-slate-600 dark:text-[#b7cbc9]">Hız</span>
            <Secim<Tempo>
              deger={ayar.tempo}
              secenekler={[
                ['yavas', 'Yavaş'],
                ['orta', 'Orta'],
                ['hizli', 'Hızlı']
              ]}
              onChange={(v) => setAyar(saveSettings({ tempo: v }))}
            />
          </div>
          <div>
            <span className="text-[15px] text-slate-600 dark:text-[#b7cbc9]">Nokta başına vuruş</span>
            <Secim<number>
              deger={ayar.taps}
              secenekler={[
                [5, '5'],
                [7, '7'],
                [9, '9']
              ]}
              onChange={(v) => setAyar(saveSettings({ taps: v }))}
            />
          </div>
          <Switch
            label="Noktalar kendiliğinden ilerlesin"
            hint="Kapalıysa her noktada 'Sonraki' düğmesine basarsın"
            checked={ayar.auto}
            onChange={(v) => setAyar(saveSettings({ auto: v }))}
          />
        </section>

        <section className="eft-card space-y-3">
          <h3 className="eft-label">Sesli rehber</h3>
          <Switch
            label="Cümleleri sesli oku"
            hint="Kurulum cümlesi, nokta adı ve ifadeler okunur; telefona bakmadan uygula"
            checked={ayar.voice}
            onChange={(v) => {
              setAyar(saveSettings({ voice: v }))
              if (v) speak('Sesli rehber açık. Kaş başı. Bu kaygı.')
            }}
          />
          <div>
            <span className="text-[15px] text-slate-600 dark:text-[#b7cbc9]">Konuşma hızı</span>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {(
                [
                  ['yavas', 'Yavaş'],
                  ['normal', 'Normal']
                ] as ['yavas' | 'normal', string][]
              ).map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => {
                    setAyar(saveSettings({ voiceRate: v }))
                    speak('Her ne kadar bu kaygıyı hissetsem de, kendimi kabul ediyorum.')
                  }}
                  className={`min-h-[48px] rounded-2xl text-[15px] font-semibold transition ${
                    ayar.voiceRate === v ? 'bg-eft-600 text-white' : 'bg-slate-100 dark:bg-[#1e3231] text-slate-700 dark:text-[#d5e6e4]'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              className="eft-btn-soft min-h-[48px] text-[15px]"
              onClick={async () => {
                speak('Merhaba. Sesli rehber çalışıyor. Kaş başı. Bu kaygı.')
                setSesDurum(await turkishAvailable())
              }}
            >
              🔊 Sesi dene
            </button>
            <button
              className="eft-btn-ghost min-h-[48px] text-[15px]"
              onClick={async () => {
                const ok = await openTtsInstall()
                if (!ok) setHata('Bu ekran yalnızca Android uygulamasında açılır. Telefonda Ayarlar › Dil ve giriş › Metin okuma bölümünden Türkçe ses verisi yükleyin.')
              }}
            >
              Türkçe ses yükle
            </button>
          </div>
          {sesDurum === 'var' && <p className="text-[13px] text-emerald-700">Türkçe ses bulundu ✔ Ses gelmiyorsa telefonun medya sesini ve sessiz modunu kontrol edin.</p>}
          {sesDurum === 'yok' && (
            <p className="text-[13px] text-rose-600">
              Bu telefonda Türkçe okuma sesi yüklü değil. "Türkçe ses yükle" ile açılan ekrandan Google Metin Okuma › Türkçe verisini indirin.
            </p>
          )}
          {sesDurum === 'bilinmiyor' && <p className="text-[13px] text-slate-500 dark:text-[#7f9896]">Ses durumu sorgulanamadı; deneme cümlesi duyulduysa sorun yok.</p>}
          {!speechSupported() && (
            <p className="text-[13px] text-rose-600">Bu cihazda sesli okuma desteklenmiyor. Metinler ekranda gösterilmeye devam eder.</p>
          )}
          <p className="text-[13px] text-slate-500 dark:text-[#7f9896]">
            Ses, telefonun kendi Türkçe okuma sesidir (Google Metin Okuma). Türkçe ses yüklü değilse Ayarlar › Dil ve giriş › Metin okuma
            bölümünden Türkçe veri indirilebilir.
          </p>
        </section>

        <section className="eft-card space-y-3">
          <h3 className="eft-label">Geri bildirim</h3>
          <Switch
            label="Vuruş sesi"
            hint="Her vuruşta hafif bir tık"
            checked={ayar.sound}
            onChange={(v) => {
              setAyar(saveSettings({ sound: v }))
              if (v) sfxSample()
            }}
          />
          <Switch label="Titreşim" hint="Her vuruşta kısa titreşim" checked={ayar.vibrate} onChange={(v) => setAyar(saveSettings({ vibrate: v }))} />
        </section>

        <section className="eft-card space-y-3">
          <h3 className="eft-label">Görünüm</h3>
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
                  tema === v ? 'bg-eft-600 text-white' : 'bg-slate-100 dark:bg-[#1e3231] text-slate-700 dark:text-[#d5e6e4]'
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

        <section className="eft-card space-y-3">
          <h3 className="eft-label">Yedek</h3>
          <p className="text-[14px] text-slate-500 dark:text-[#7f9896]">
            Veriler yalnızca bu telefonda saklanır ({sayi} seans). Telefon değişince yedeği alıp yeni cihazda geri yükle.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button className="eft-btn-soft" onClick={downloadBackup}>
              Yedeği indir
            </button>
            <button className="eft-btn-ghost" onClick={() => dosyaRef.current?.click()}>
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
            className="eft-btn-danger w-full"
            onClick={() => {
              if (window.confirm('Tüm seans geçmişi ve ayarlar silinsin mi? Bu işlem geri alınamaz.')) {
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

        <section className="eft-card space-y-2">
          <h3 className="eft-label">Bilmeniz gerekenler</h3>
          <p className="text-[15px] leading-relaxed text-slate-700 dark:text-[#d5e6e4]">
            EFT bir <b>kendine yardım ve gevşeme tekniğidir</b>; tıbbi ya da psikolojik tedavinin yerini tutmaz. Kaygı, stres ve
            bazı ağrılarda rahatlama sağladığına dair çalışmalar vardır; ancak etkisi kişiden kişiye değişir.
          </p>
          <p className="text-[15px] leading-relaxed text-slate-700 dark:text-[#d5e6e4]">
            Depresyon, panik bozukluk, travma sonrası stres ya da kendine zarar verme düşünceleri gibi durumlarda bir{' '}
            <b>ruh sağlığı uzmanına</b> başvurun. Şiddetli ya da açıklanamayan bedensel ağrıda önce hekime görünün. Uygulama
            sırasında yoğun bir sıkıntı yükselirse durun, nefes alın ve gerekirse destek isteyin.
          </p>
        </section>
      </div>
    </div>
  )
}

function Secim<T extends string | number>({ deger, secenekler, onChange }: { deger: T; secenekler: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2 mt-1">
      {secenekler.map(([v, l]) => (
        <button
          key={String(v)}
          onClick={() => onChange(v)}
          className={`min-h-[48px] rounded-2xl text-[15px] font-semibold transition ${
            deger === v ? 'bg-eft-600 text-white' : 'bg-slate-100 dark:bg-[#1e3231] text-slate-700 dark:text-[#d5e6e4]'
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  )
}

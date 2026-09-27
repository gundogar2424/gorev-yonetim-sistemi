import { useRef, useState } from 'react'
import { Header, Logo, T_BASLIK, T_GOVDE, T_SOLUK } from '../components/ui'
import {
  VARSAYILAN_MODEL,
  anahtarKaydet,
  anahtarOku,
  anahtarTest,
  genelProfil,
  genelProfilKaydet,
  modelOku,
  modelYaz,
  saglayici,
  saglayiciKaydet,
  type Saglayici
} from '../lib/ai'
import { downloadBackup, restoreBackup } from '../lib/backup'
import { getThemePref, setThemePref, type ThemePref } from '../lib/theme'
import { lzDb } from '../db'
import { SES_MODELLERI, sesModeli, sesModeliKaydet, type SesModeli } from '../lib/video'

export default function LzSettings() {
  const [sag, setSag] = useState<Saglayici>(saglayici())
  const [anahtar, setAnahtar] = useState(anahtarOku(saglayici()))
  const [model, setModel] = useState(modelOku(saglayici()))
  const [test, setTest] = useState('')
  const [tema, setTema] = useState<ThemePref>(getThemePref())
  const [mesaj, setMesaj] = useState('')
  const [profil, setProfil] = useState(genelProfil())
  const [profilKayit, setProfilKayit] = useState(false)
  const [ses, setSes] = useState<SesModeli>(sesModeli())
  const dosya = useRef<HTMLInputElement>(null)

  return (
    <div>
      <Header title="Ayarlar" />
      <div className="px-4 space-y-3 pb-8">
        <section className="lz-card p-4 space-y-3">
          <div className={`font-semibold ${T_BASLIK}`}>✨ Yapay zeka (isteğe bağlı)</div>
          <p className={`text-[13px] ${T_SOLUK}`}>
            Videodan ve fotoğraftan tarif çıkarma, “Ne pişirsem?” ve aileye göre menü yapay zekayla çalışır. Anahtar yalnızca bu telefonda saklanır,
            yedeğe yazılmaz.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['gemini', 'Google Gemini', 'Ücretsiz kullanım hakkı var; videoyu kendisi izler'],
                ['claude', 'Claude', 'Ücretli, kullandıkça']
              ] as [Saglayici, string, string][]
            ).map(([id, ad, alt]) => (
              <button
                key={id}
                onClick={() => {
                  setSag(id)
                  setAnahtar(anahtarOku(id))
                  setModel(modelOku(id))
                  setTest('')
                }}
                className={`text-left rounded-2xl p-3 border transition ${
                  sag === id ? 'border-lz-500 bg-lz-50 dark:bg-[#3a1d16]' : 'border-[#efe6dc] dark:border-[#2f2824]'
                }`}
              >
                <span className={`block font-semibold text-[14px] ${T_BASLIK}`}>{ad}</span>
                <span className={`block text-[11.5px] leading-snug ${T_SOLUK}`}>{alt}</span>
              </button>
            ))}
          </div>
          {sag === 'gemini' ? (
            <p className={`text-[12.5px] ${T_GOVDE}`}>
              Ücretsiz anahtar: telefondan{' '}
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-lz-600 font-semibold underline">
                aistudio.google.com/apikey
              </a>{' '}
              adresine Google hesabınla gir, “Create API key”e bas, çıkan anahtarı kopyalayıp aşağıya yapıştır. Ücretsiz kullanımın günlük bir sınırı
              vardır; aşılırsa ertesi gün yenilenir.
            </p>
          ) : (
            <p className={`text-[12.5px] ${T_GOVDE}`}>
              Anahtar:{' '}
              <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="text-lz-600 font-semibold underline">
                console.anthropic.com
              </a>{' '}
              (bakiye yüklenir, kullandıkça düşer).
            </p>
          )}
          <input
            className="lz-input font-mono text-sm"
            type="password"
            placeholder={sag === 'gemini' ? 'AIza…' : 'sk-ant-…'}
            value={anahtar}
            onChange={(e) => setAnahtar(e.target.value)}
            autoComplete="off"
          />
          <input className="lz-input font-mono text-sm" placeholder={VARSAYILAN_MODEL[sag]} value={model} onChange={(e) => setModel(e.target.value)} />
          <div className="flex gap-2">
            <button
              className="lz-btn-primary flex-1"
              onClick={() => {
                saglayiciKaydet(sag)
                anahtarKaydet(sag, anahtar)
                modelYaz(sag, model)
                setTest(anahtar.trim() ? 'Kaydedildi.' : 'Anahtar kaldırıldı.')
              }}
            >
              Kaydet
            </button>
            <button
              className="lz-btn-soft flex-1"
              disabled={!anahtar.trim()}
              onClick={async () => {
                saglayiciKaydet(sag)
                anahtarKaydet(sag, anahtar)
                modelYaz(sag, model)
                setTest('Deneniyor…')
                setTest(await anahtarTest())
              }}
            >
              Dene
            </button>
          </div>
          {test && <p className={`text-[13px] ${T_GOVDE}`}>{test}</p>}
        </section>

        <section className="lz-card p-4 space-y-3">
          <div className={`font-semibold ${T_BASLIK}`}>🎬 Videodaki konuşma</div>
          <p className={`text-[13px] ${T_SOLUK}`}>
            Claude seçiliyken, tarif açıklamada yazmıyorsa videoda söylenenler telefonun içinde yazıya çevrilir (ses hiçbir yere gönderilmez). Model
            ilk kullanımda bir kez indirilir. Gemini seçiliyse bu gerekmez: Gemini videoyu kendisi dinler (18 MB’tan büyük videolarda yine bu kullanılır).
          </p>
          <div className="space-y-2">
            {SES_MODELLERI.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  setSes(m.id)
                  sesModeliKaydet(m.id)
                }}
                className={`w-full text-left rounded-2xl p-3 border transition ${
                  ses === m.id ? 'border-lz-500 bg-lz-50 dark:bg-[#3a1d16]' : 'border-[#efe6dc] dark:border-[#2f2824]'
                }`}
              >
                <span className={`block font-semibold text-[14px] ${T_BASLIK}`}>{m.ad}</span>
                <span className={`block text-[12px] ${T_SOLUK}`}>{m.aciklama}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="lz-card p-4 space-y-3">
          <div className={`font-semibold ${T_BASLIK}`}>Beslenme biçimi</div>
          <p className={`text-[13px] ${T_SOLUK}`}>
            Tüm evi ilgilendiren tercihler. Kişiye özel olanları (eşinin sevmedikleri, çocuğunun alerjisi) Tariflerim › Sofralarım’da ilgili sofraya
            yaz. “Ne pişirsem?” ve sihirli haftalık menü bunlara uyar.
          </p>
          <textarea
            className="lz-input min-h-[80px] text-[15px]"
            placeholder="Örn. az yağlı pişiririz, domuz ürünü yok, haftada bir balık"
            value={profil}
            onChange={(e) => {
              setProfil(e.target.value)
              setProfilKayit(false)
            }}
          />
          <button
            className="lz-btn-soft w-full"
            onClick={() => {
              genelProfilKaydet(profil)
              setProfilKayit(true)
            }}
          >
            {profilKayit ? '✓ Kaydedildi' : 'Kaydet'}
          </button>
        </section>

        <section className="lz-card p-4 space-y-3">
          <div className={`font-semibold ${T_BASLIK}`}>Görünüm</div>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ['auto', 'Otomatik'],
                ['light', 'Açık'],
                ['dark', 'Koyu']
              ] as [ThemePref, string][]
            ).map(([v, ad]) => (
              <button
                key={v}
                className={`lz-chip justify-center ${tema === v ? 'lz-chip-on' : ''}`}
                onClick={() => {
                  setTema(v)
                  setThemePref(v)
                }}
              >
                {ad}
              </button>
            ))}
          </div>
        </section>

        <section className="lz-card p-4 space-y-3">
          <div className={`font-semibold ${T_BASLIK}`}>Yedekleme</div>
          <p className={`text-[13px] ${T_SOLUK}`}>
            Tarifler yalnızca bu telefonda saklanır. Telefon değiştirirken yedeği indir, yeni telefonda geri yükle (fotoğraflar, sofralar, plan ve
            alışveriş listesi dahil).
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button className="lz-btn-soft" onClick={() => void downloadBackup()}>
              Yedeği indir
            </button>
            <button className="lz-btn-soft" onClick={() => dosya.current?.click()}>
              Geri yükle
            </button>
          </div>
          <input
            ref={dosya}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (!f) return
              try {
                const s = await restoreBackup(f)
                setMesaj(`✓ ${s.eklendi} tarif eklendi${s.atlandi ? `, ${s.atlandi} zaten vardı` : ''}.`)
              } catch (err) {
                setMesaj((err as Error).message)
              }
            }}
          />
          {mesaj && <p className={`text-[13px] ${T_GOVDE}`}>{mesaj}</p>}
          <button
            className="lz-btn-danger w-full text-sm"
            onClick={async () => {
              if (!confirm('Tüm tarifler, sofralar, plan ve alışveriş listesi silinsin mi? Geri alınamaz.')) return
              await Promise.all([lzDb.recipes.clear(), lzDb.sofralar.clear(), lzDb.plans.clear(), lzDb.shopping.clear()])
              setMesaj('Tüm veriler silindi.')
            }}
          >
            Tüm verileri sil
          </button>
        </section>

        <div className="flex flex-col items-center gap-1 pt-2">
          <Logo className="w-10 h-10" />
          <div className={`font-semibold ${T_BASLIK}`}>Lezzet Defteri</div>
          <div className={`text-[12px] ${T_SOLUK}`}>Sürüm 1.0.{__APP_BUILD__} · Hesap yok, veriler telefonda</div>
        </div>
      </div>
    </div>
  )
}

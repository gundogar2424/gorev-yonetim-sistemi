import { useRef, useState } from 'react'
import { Header, Logo, T_BASLIK, T_GOVDE, T_SOLUK } from '../components/ui'
import { VARSAYILAN_MODEL, anahtarTest, apiAnahtari, apiAnahtariKaydet, genelProfil, genelProfilKaydet, modelAdi, modelKaydet } from '../lib/ai'
import { downloadBackup, restoreBackup } from '../lib/backup'
import { getThemePref, setThemePref, type ThemePref } from '../lib/theme'
import { lzDb } from '../db'

export default function LzSettings() {
  const [anahtar, setAnahtar] = useState(apiAnahtari())
  const [model, setModel] = useState(modelAdi())
  const [test, setTest] = useState('')
  const [tema, setTema] = useState<ThemePref>(getThemePref())
  const [mesaj, setMesaj] = useState('')
  const [profil, setProfil] = useState(genelProfil())
  const [profilKayit, setProfilKayit] = useState(false)
  const dosya = useRef<HTMLInputElement>(null)

  return (
    <div>
      <Header title="Ayarlar" />
      <div className="px-4 space-y-3 pb-8">
        <section className="lz-card p-4 space-y-3">
          <div className={`font-semibold ${T_BASLIK}`}>✨ Yapay zeka (isteğe bağlı)</div>
          <p className={`text-[13px] ${T_SOLUK}`}>
            Sosyal medya açıklamaları dağınık olur. Claude API anahtarı girersen linkten ya da metinden gelen tarifler yapay zekayla düzenli
            malzeme listesine ve adımlara çevrilir. Anahtar yalnızca bu telefonda saklanır, yedeğe yazılmaz. Anahtarı console.anthropic.com
            adresinden alabilirsin.
          </p>
          <input
            className="lz-input font-mono text-sm"
            type="password"
            placeholder="sk-ant-…"
            value={anahtar}
            onChange={(e) => setAnahtar(e.target.value)}
            autoComplete="off"
          />
          <input className="lz-input font-mono text-sm" placeholder={VARSAYILAN_MODEL} value={model} onChange={(e) => setModel(e.target.value)} />
          <div className="flex gap-2">
            <button
              className="lz-btn-primary flex-1"
              onClick={() => {
                apiAnahtariKaydet(anahtar)
                modelKaydet(model)
                setTest(anahtar.trim() ? 'Kaydedildi.' : 'Anahtar kaldırıldı.')
              }}
            >
              Kaydet
            </button>
            <button
              className="lz-btn-soft flex-1"
              disabled={!anahtar.trim()}
              onClick={async () => {
                apiAnahtariKaydet(anahtar)
                modelKaydet(model)
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

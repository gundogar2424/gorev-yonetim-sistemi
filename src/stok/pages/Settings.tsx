import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { readStokSettings, saveStokSettings, listProducts } from '../db'
import { exportBackup, importBackup } from '../lib/backup'
import { getThemePref, setThemePref, type ThemePref } from '../lib/theme'

const inputCls =
  'w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-card p-4 space-y-3">
      <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">{title}</h2>
      {children}
    </section>
  )
}

export default function Settings() {
  const settings = useLiveQuery(() => readStokSettings(), [])
  const products = useLiveQuery(() => listProducts(), [])
  const importRef = useRef<HTMLInputElement>(null)
  const [theme, setTheme] = useState<ThemePref>(getThemePref())
  const [shopName, setShopName] = useState<string | null>(null)

  // İlk yüklemede işletme adını ayarlardan al (henüz elle değiştirilmediyse)
  const shopValue = shopName ?? settings?.shopName ?? ''

  function pickTheme(p: ThemePref) {
    setTheme(p)
    setThemePref(p)
  }

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const replace = confirm(
      'Yedeği nasıl yükleyelim?\n\nTAMAM = Mevcut verinin ÜZERİNE yaz (her şeyi değiştir)\nİPTAL = Mevcut veriye ekle/birleştir'
    )
    try {
      const res = await importBackup(file, replace)
      alert(`Yedek yüklendi. ${res.products} ürün.`)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Yedek yüklenemedi.')
    } finally {
      e.target.value = ''
    }
  }

  const themeOptions: { key: ThemePref; label: string }[] = [
    { key: 'auto', label: 'Otomatik' },
    { key: 'light', label: 'Açık' },
    { key: 'dark', label: 'Koyu' }
  ]

  return (
    <div className="pb-6">
      <header className="px-4 pt-5 pb-3">
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Ayarlar</h1>
      </header>

      <div className="px-4 space-y-4">
        <Section title="İşletme">
          <label className="block">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">İşletme adı (başlıkta görünür)</span>
            <input
              value={shopValue}
              onChange={(e) => setShopName(e.target.value)}
              onBlur={() => saveStokSettings({ shopName: shopValue.trim() })}
              placeholder="örn. Ahmet Aksesuar"
              className={`${inputCls} mt-1`}
            />
          </label>
        </Section>

        <Section title="Görünüm">
          <div className="grid grid-cols-3 gap-2">
            {themeOptions.map((o) => (
              <button
                key={o.key}
                onClick={() => pickTheme(o.key)}
                className={`py-2 rounded-xl text-sm font-medium border transition-colors ${
                  theme === o.key
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Yedekleme">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Tüm ürünlerinizi (fotoğraflar dahil) tek dosyaya indirin; telefon değişince ya da veri kaybına karşı geri
            yükleyin.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => exportBackup()}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-medium active:scale-95"
            >
              Yedeği indir
            </button>
            <input ref={importRef} type="file" accept="application/json,.json" onChange={onImport} className="hidden" />
            <button
              onClick={() => importRef.current?.click()}
              className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium active:scale-95"
            >
              Yedeği yükle
            </button>
          </div>
          <p className="text-xs text-slate-400">
            {products == null ? '' : `Şu an ${products.length} çeşit ürün kayıtlı.`}
          </p>
        </Section>

        <Section title="Hakkında">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Stok Takip — telefonunuzda çalışan, internetsiz de kullanılabilen bağımsız stok/ürün kataloğudur. Verileriniz
            yalnızca bu cihazda saklanır.
          </p>
        </Section>
      </div>
    </div>
  )
}

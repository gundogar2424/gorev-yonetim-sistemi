import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDistance } from '../lib/geo'
import { AI_MODELS, aiModelInfo, testClaudeKey, type AiModel } from '../lib/ai'
import { testGoogleKey } from '../lib/google'
import { getSettings, RADIUS_OPTIONS, saveSettings } from '../lib/store'
import { getThemePref, setThemePref, type ThemePref } from '../lib/theme'

const card = 'rounded-2xl bg-white dark:bg-[#1f1b19] border border-slate-200/70 dark:border-[#2f2926] p-4'
const label = 'text-[12px] font-bold uppercase tracking-wide text-slate-400 dark:text-[#8a817b]'
const body = 'text-[14px] text-slate-600 dark:text-[#cfc5bd]'

function Segment<T extends string | number>({
  value,
  options,
  onChange
}: {
  value: T
  options: [T, string][]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-[#2a2421] mt-2">
      {options.map(([v, l]) => (
        <button
          key={String(v)}
          onClick={() => onChange(v)}
          className={`flex-1 h-10 rounded-lg text-[14px] font-semibold ${
            value === v
              ? 'bg-white dark:bg-[#3a322e] text-et-700 dark:text-et-200 shadow-card'
              : 'text-slate-500 dark:text-[#a59b94]'
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  )
}

export default function Settings() {
  const navigate = useNavigate()
  const [s, setS] = useState(getSettings)
  const [key, setKey] = useState(s.googleKey)
  const [theme, setTheme] = useState<ThemePref>(getThemePref)
  const [test, setTest] = useState('')
  const [testing, setTesting] = useState(false)
  const [cKey, setCKey] = useState(s.claudeKey)
  const [cTest, setCTest] = useState('')
  const [cTesting, setCTesting] = useState(false)

  async function runClaudeTest() {
    setCTesting(true)
    setCTest('')
    setCTest(await testClaudeKey(cKey, s.aiModel))
    setCTesting(false)
  }

  useEffect(() => window.scrollTo(0, 0), [])

  async function runTest() {
    setTesting(true)
    setTest('')
    setTest(await testGoogleKey(key.trim()))
    setTesting(false)
  }

  return (
    <div className="flex-1">
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-[#faf7f5]/90 dark:bg-[#141211]/90 px-4 pt-4 pb-3 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="w-11 h-11 rounded-full bg-white dark:bg-[#24201e] border border-slate-200 dark:border-[#332d29] flex items-center justify-center text-slate-700 dark:text-[#eae2dc]"
          aria-label="Geri"
        >
          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2.4}>
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div>
          <h1 className="text-[24px] font-bold text-slate-900 dark:text-[#f5eee9]">Ayarlar</h1>
          <p className="text-[13px] text-slate-500 dark:text-[#a59b94]">Etrafımda · sürüm {__APP_BUILD__}</p>
        </div>
      </header>

      <div className="px-4 pb-10 space-y-4">
        <section className={card}>
          <h3 className={label}>Google puanları (isteğe bağlı)</h3>
          <p className={`${body} mt-2`}>
            Anahtar olmadan da çalışır (OpenStreetMap). Google Places API anahtarı eklersen restoran/kafe/müze puanları,
            yorum sayıları, fiyat seviyesi ve “şu an açık” bilgisi de gelir; popülerlik puanı çok daha isabetli olur.
          </p>
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="AIza…"
            autoComplete="off"
            spellCheck={false}
            className="mt-3 w-full h-12 px-3 rounded-xl bg-slate-50 dark:bg-[#24201e] border border-slate-200 dark:border-[#332d29] text-slate-900 dark:text-[#f2ebe6] font-mono text-[14px]"
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => {
                setS(saveSettings({ googleKey: key.trim() }))
                setTest('Kaydedildi ✓')
              }}
              className="flex-1 h-11 rounded-xl bg-et-600 text-white font-semibold"
            >
              Kaydet
            </button>
            <button
              onClick={runTest}
              disabled={!key.trim() || testing}
              className="flex-1 h-11 rounded-xl bg-slate-100 dark:bg-[#2a2421] text-slate-800 dark:text-[#eae2dc] font-semibold disabled:opacity-50"
            >
              {testing ? 'Deneniyor…' : 'Anahtarı dene'}
            </button>
          </div>
          {test && <p className="mt-2 text-[14px] text-slate-700 dark:text-[#d9d0c9] break-words">{test}</p>}
          <details className="mt-3">
            <summary className="text-[14px] font-semibold text-et-700 dark:text-et-300">Anahtar nasıl alınır?</summary>
            <ol className={`${body} mt-2 list-decimal pl-5 space-y-1`}>
              <li>console.cloud.google.com adresinde bir proje aç.</li>
              <li>
                “APIs &amp; Services › Library” bölümünden <b>Places API (New)</b>'i etkinleştir.
              </li>
              <li>“Credentials › Create credentials › API key” ile anahtar üret, buraya yapıştır.</li>
              <li>Güvenlik için anahtarı yalnızca Places API (New) ile sınırla.</li>
            </ol>
            <p className={`${body} mt-2`}>
              Her tarama, kategori başına 1 istek (8 istek) yapar. Google'ın aylık ücretsiz kullanım payı kişisel
              kullanım için genellikle yeter; yine de faturalandırma hesabı istenir ve aşımda ücret çıkar.
            </p>
          </details>
        </section>

        <section className={card}>
          <h3 className={label}>🤖 Yapay zekâ hype yorumu (isteğe bağlı)</h3>
          <p className={`${body} mt-2`}>
            Anthropic (Claude) API anahtarı eklersen, bir mekânın ayrıntısında “Ne kadar konuşuluyor?” düğmesi çıkar:
            Claude web araması yapıp Instagram, TikTok, Ekşi Sözlük, blog ve haberlerde ne konuşulduğunu bulur; 0-100
            hype puanı, eğilim, övülen/şikâyet edilen yönler ve kaynak bağlantıları verir. Bu puan, popülerlik
            sıralamasında tahmini puanın yerine geçer.
          </p>
          <input
            value={cKey}
            onChange={(e) => setCKey(e.target.value)}
            placeholder="sk-ant-…"
            autoComplete="off"
            spellCheck={false}
            className="mt-3 w-full h-12 px-3 rounded-xl bg-slate-50 dark:bg-[#24201e] border border-slate-200 dark:border-[#332d29] text-slate-900 dark:text-[#f2ebe6] font-mono text-[14px]"
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => {
                setS(saveSettings({ claudeKey: cKey.trim() }))
                setCTest('Kaydedildi ✓')
              }}
              className="flex-1 h-11 rounded-xl bg-et-600 text-white font-semibold"
            >
              Kaydet
            </button>
            <button
              onClick={runClaudeTest}
              disabled={!cKey.trim() || cTesting}
              className="flex-1 h-11 rounded-xl bg-slate-100 dark:bg-[#2a2421] text-slate-800 dark:text-[#eae2dc] font-semibold disabled:opacity-50"
            >
              {cTesting ? 'Deneniyor…' : 'Anahtarı dene'}
            </button>
          </div>
          <p className={`${body} mt-3 font-semibold`}>Model</p>
          <Segment<AiModel>
            value={s.aiModel}
            options={AI_MODELS.map((m) => [m.id, m.label] as [AiModel, string])}
            onChange={(v) => setS(saveSettings({ aiModel: v }))}
          />
          <p className="mt-1.5 text-[13px] text-slate-500 dark:text-[#a59b94]">
            {s.aiModel === 'claude-sonnet-5-5'
              ? "Claude Sonnet 5.5: Opus 5.5'in yaklaşık yarı fiyatı."
              : 'Claude Opus 5.5: en yetenekli model, varsayılan.'}{' '}
            Mekân başına {aiModelInfo(s.aiModel).cost}.
          </p>
          {cTest && <p className="mt-2 text-[14px] text-slate-700 dark:text-[#d9d0c9] break-words">{cTest}</p>}
          <details className="mt-3">
            <summary className="text-[14px] font-semibold text-et-700 dark:text-et-300">Anahtar ve ücret</summary>
            <ol className={`${body} mt-2 list-decimal pl-5 space-y-1`}>
              <li>console.anthropic.com adresinde hesap aç, “Billing” bölümünden kredi yükle.</li>
              <li>“API Keys › Create Key” ile anahtar üret, buraya yapıştır.</li>
              <li>Web araması Console › Settings › Privacy bölümünde açık olmalı (varsayılan açık).</li>
            </ol>
            <p className={`${body} mt-2`}>
              Her yorum en fazla 5 web araması yapar; mekân başına Opus 5.5 ile yaklaşık 0,10-0,30 $, Sonnet 5.5 ile
              yaklaşık 0,06-0,15 $ tutar. Sonuç 7 gün bu cihazda saklanır, bu sürede aynı mekân için tekrar ücret çıkmaz
              (“Yenile” demedikçe). Anahtar yalnızca bu cihazda durur ve doğrudan Anthropic'e gönderilir.
            </p>
          </details>
        </section>

        <section className={card}>
          <h3 className={label}>Varsayılan tarama çapı</h3>
          <Segment
            value={s.radiusM}
            options={RADIUS_OPTIONS.map((r) => [r, formatDistance(r)] as [number, string])}
            onChange={(v) => setS(saveSettings({ radiusM: v }))}
          />
        </section>

        <section className={card}>
          <h3 className={label}>Tema</h3>
          <Segment<ThemePref>
            value={theme}
            options={[
              ['auto', 'Otomatik'],
              ['light', 'Açık'],
              ['dark', 'Koyu']
            ]}
            onChange={(v) => {
              setThemePref(v)
              setTheme(v)
            }}
          />
        </section>

        <section className={card}>
          <h3 className={label}>Popülerlik (hype) puanı nasıl hesaplanıyor?</h3>
          <p className={`${body} mt-2`}>
            Instagram ve TikTok, bir mekânın ne kadar konuşulduğunu herkese açık olarak paylaşmıyor. Bu yüzden puan{' '}
            <b>tahminidir</b>: en güçlü işaret Google'daki yorum sayısıdır (çok konuşulan yer çok yorum alır), yanına
            puan, Instagram/Facebook hesabı, web sitesi ve Vikipedi sayfası olup olmadığı eklenir. Bir mekânın sosyal
            medyasına bakmak için ayrıntı ekranındaki “Instagram” ve “TikTok'ta ara” düğmelerini kullan. Claude anahtarı
            eklediysen “Ne kadar konuşuluyor?” ile yapay zekânın web taramasına dayalı puanı alınır ve 🤖 işaretiyle
            gösterilir.
          </p>
        </section>

        <section className={card}>
          <h3 className={label}>Veri ve gizlilik</h3>
          <p className={`${body} mt-2`}>
            Konumun yalnızca tarama anında, yakındaki yerleri sorgulamak için OpenStreetMap (Overpass) sunucularına ve
            anahtar girdiysen Google'a gönderilir. Yapay zekâ yorumu istediğinde mekânın adı, türü, adresi ve konumu
            Anthropic'e gönderilir. Ayarlar, son tarama, kaydedilenler ve yapay zekâ yorumları yalnızca bu cihazda
            saklanır.
          </p>
          <p className="mt-2 text-[12px] text-slate-400 dark:text-[#857b74]">
            Harita verisi © OpenStreetMap katkıcıları (ODbL), harita altlığı © CARTO.
          </p>
        </section>
      </div>
    </div>
  )
}

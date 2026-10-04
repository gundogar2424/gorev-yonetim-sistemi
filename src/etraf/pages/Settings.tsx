import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDistance } from '../lib/geo'
import { AI_MODELS, aiModelInfo, providerOf, testAiKey, type AiModel } from '../lib/ai'
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
  const provider = providerOf(s.aiModel)
  // Her servisin kutusu kendi taslagini tutar: servis degisince obur
  // servisin anahtari kutuda gorunmez (yanlis yere kaydedilmesin).
  const [aiDrafts, setAiDrafts] = useState({ gemini: s.geminiKey, claude: s.claudeKey })
  const aiKey = aiDrafts[provider]
  const setAiKey = (v: string) => setAiDrafts((d) => ({ ...d, [provider]: v }))
  const [aiTest, setAiTest] = useState('')
  const [aiTesting, setAiTesting] = useState(false)

  async function runAiTest() {
    setAiTesting(true)
    setAiTest('')
    setAiTest(await testAiKey(aiKey, s.aiModel))
    setAiTesting(false)
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
            Bir yapay zekâ anahtarı eklersen, mekânın ayrıntısında “Ne kadar konuşuluyor?” düğmesi çıkar: yapay zekâ
            web'de arama yapıp Instagram, TikTok, Ekşi Sözlük, blog ve haberlerde ne konuşulduğunu bulur; 0-100 hype
            puanı, eğilim, övülen/şikâyet edilen yönler ve kaynak bağlantıları verir. Bu puan, popülerlik sıralamasında
            tahmini puanın yerine geçer.
          </p>
          <p className={`${body} mt-3 font-semibold`}>Servis</p>
          <Segment<AiModel>
            value={s.aiModel}
            options={AI_MODELS.map((m) => [m.id, m.label] as [AiModel, string])}
            onChange={(v) => {
              setS(saveSettings({ aiModel: v }))
              setAiTest('')
            }}
          />
          <p className="mt-1.5 text-[13px] text-slate-500 dark:text-[#a59b94]">
            {aiModelInfo(s.aiModel).note}: mekân başına {aiModelInfo(s.aiModel).cost}.
          </p>
          <input
            key={provider}
            value={aiKey}
            onChange={(e) => setAiKey(e.target.value)}
            placeholder={provider === 'gemini' ? 'Gemini API anahtarı (AIza…)' : 'Claude API anahtarı (sk-ant-…)'}
            autoComplete="off"
            spellCheck={false}
            className="mt-3 w-full h-12 px-3 rounded-xl bg-slate-50 dark:bg-[#24201e] border border-slate-200 dark:border-[#332d29] text-slate-900 dark:text-[#f2ebe6] font-mono text-[14px]"
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => {
                setS(saveSettings(provider === 'gemini' ? { geminiKey: aiKey.trim() } : { claudeKey: aiKey.trim() }))
                setAiTest('Kaydedildi ✓')
              }}
              className="flex-1 h-11 rounded-xl bg-et-600 text-white font-semibold"
            >
              Kaydet
            </button>
            <button
              onClick={runAiTest}
              disabled={!aiKey.trim() || aiTesting}
              className="flex-1 h-11 rounded-xl bg-slate-100 dark:bg-[#2a2421] text-slate-800 dark:text-[#eae2dc] font-semibold disabled:opacity-50"
            >
              {aiTesting ? 'Deneniyor…' : 'Anahtarı dene'}
            </button>
          </div>
          {aiTest && <p className="mt-2 text-[14px] text-slate-700 dark:text-[#d9d0c9] break-words">{aiTest}</p>}
          <details className="mt-3">
            <summary className="text-[14px] font-semibold text-et-700 dark:text-et-300">
              Anahtar nasıl alınır, ücret
            </summary>
            {provider === 'gemini' ? (
              <>
                <ol className={`${body} mt-2 list-decimal pl-5 space-y-1`}>
                  <li>aistudio.google.com adresine Google hesabınla gir.</li>
                  <li>“Get API key › Create API key” ile anahtar üret, buraya yapıştır. Kart bilgisi gerekmez.</li>
                </ol>
                <p className={`${body} mt-2`}>
                  Model: gemini-flash-latest (her zaman en yeni Gemini Flash). Ücretsiz kotada Google Arama ile günde
                  yaklaşık 500 istek yapılabilir; kota dolarsa ertesi gün yenilenir. Ücretsiz kullanımda Google,
                  gönderilen bilgileri (mekânın adı, türü, adresi, konumu) ürünlerini geliştirmek için kullanabilir.
                  Gemini Uygulaması aboneliği (Gemini Advanced / Google AI Pro) bu anahtar yerine geçmez; anahtar AI
                  Studio'dan ayrıca alınır.
                </p>
              </>
            ) : (
              <>
                <ol className={`${body} mt-2 list-decimal pl-5 space-y-1`}>
                  <li>console.anthropic.com adresinde hesap aç, “Billing” bölümünden kredi yükle.</li>
                  <li>“API Keys › Create Key” ile anahtar üret, buraya yapıştır.</li>
                  <li>Web araması Console › Settings › Privacy bölümünde açık olmalı (varsayılan açık).</li>
                </ol>
                <p className={`${body} mt-2`}>
                  Her yorum en fazla 5 web araması yapar; mekân başına Opus 5.5 ile yaklaşık 0,10-0,30 $, Sonnet 5.5 ile
                  yaklaşık 0,06-0,15 $ tutar.
                </p>
              </>
            )}
            <p className={`${body} mt-2`}>
              Sonuç 7 gün bu cihazda saklanır; bu sürede aynı mekân yeniden sorulmaz (“Yenile” demedikçe). Anahtar
              yalnızca bu cihazda durur ve doğrudan ilgili servise (Google ya da Anthropic) gönderilir.
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
            medyasına bakmak için ayrıntı ekranındaki “Instagram” ve “TikTok'ta ara” düğmelerini kullan. Yapay zekâ
            anahtarı (Gemini ya da Claude) eklediysen “Ne kadar konuşuluyor?” ile yapay zekânın web taramasına dayalı
            puanı alınır ve 🤖 işaretiyle gösterilir.
          </p>
        </section>

        <section className={card}>
          <h3 className={label}>Veri ve gizlilik</h3>
          <p className={`${body} mt-2`}>
            Konumun yalnızca tarama anında, yakındaki yerleri sorgulamak için OpenStreetMap (Overpass) sunucularına ve
            anahtar girdiysen Google'a gönderilir. Yapay zekâ yorumu istediğinde mekânın adı, türü, adresi ve konumu
            seçtiğin servise (Google ya da Anthropic) gönderilir. Ayarlar, son tarama, kaydedilenler ve yapay zekâ
            yorumları yalnızca bu cihazda saklanır.
          </p>
          <p className="mt-2 text-[12px] text-slate-400 dark:text-[#857b74]">
            Harita verisi © OpenStreetMap katkıcıları (ODbL), harita altlığı © CARTO.
          </p>
        </section>
      </div>
    </div>
  )
}

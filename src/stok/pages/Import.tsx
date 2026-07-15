import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { readStokSettings, addProductsMany } from '../db'
import { extractProducts, extractProductsFromChunks } from '../ai'
import { fetchSiteContent, crawlSite } from '../lib/webfetch'
import { parseProductPaste } from '../lib/parseImport'
import { fileToCompressedDataUrl } from '../lib/image'
import { extractPdfText, chunkText } from '../lib/pdf'
import type { ExtractedProduct } from '../types'

type Method = 'link' | 'file' | 'paste'

const inputCls =
  'w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400'

export default function Import() {
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)

  const [method, setMethod] = useState<Method>('paste')
  const [url, setUrl] = useState('')
  const [wide, setWide] = useState(true)
  const [maxPages, setMaxPages] = useState('25')
  const [pasteText, setPasteText] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [items, setItems] = useState<ExtractedProduct[] | null>(null)
  const [savedMsg, setSavedMsg] = useState('')

  async function needApiKey(): Promise<string | null> {
    const s = await readStokSettings()
    if (!s.apiKey?.trim()) {
      setError('Yapay zeka ile okuma için önce Ayarlar’dan API anahtarınızı girin. (Ya da "Yapıştır" yöntemini kullanın — anahtar gerekmez.)')
      return null
    }
    return s.apiKey.trim()
  }

  async function runLink() {
    setError('')
    setItems(null)
    const seeds = url
      .split(/[\s\n]+/)
      .map((u) => u.trim())
      .filter(Boolean)
    if (seeds.length === 0) return
    const apiKey = await needApiKey()
    if (!apiKey) return
    const s = await readStokSettings()

    try {
      if (wide) {
        // GENİŞ TARAMA: site içinde gez, tüm sayfaların metnini topla + PDF'leri oku
        const limit = Math.max(1, Math.min(80, Number(maxPages) || 25))
        setBusy('Site taranıyor…')
        const crawl = await crawlSite(seeds, {
          maxPages: limit,
          onProgress: (done, max) => setBusy(`Site taranıyor… ${done}/${max} sayfa`)
        })
        const allText: string[] = [...crawl.texts]
        // Rastlanan PDF kataloglarının da metnini çıkar
        for (let i = 0; i < crawl.pdfDataUrls.length; i++) {
          setBusy(`Katalog PDF okunuyor… ${i + 1}/${crawl.pdfDataUrls.length}`)
          try {
            const { text } = await extractPdfText(crawl.pdfDataUrls[i])
            if (text.trim().length >= 60) allText.push(text)
          } catch {
            /* bu PDF atlansın */
          }
        }
        const combined = allText.join('\n')
        if (combined.trim().length < 60) {
          setBusy('')
          setError(
            crawl.failed > 0
              ? 'Sayfalar okunamadı (tarayıcıda CORS engeli olabilir; bu özellik kurulu uygulamada/APK daha güvenilir çalışır).'
              : 'Taranan sayfalarda okunur içerik bulunamadı.'
          )
          return
        }
        const chunks = chunkText(combined, 6000)
        const list = await extractProductsFromChunks({
          apiKey,
          model: s.model,
          chunks,
          onProgress: (c, t) => setBusy(`Ürünler okunuyor… bölüm ${c}/${t}`)
        })
        setItems(list)
        if (list.length === 0)
          setError(`${crawl.visited} sayfa tarandı ama ürün bulunamadı. Doğrudan ürün/katalog sayfasının linkini verin.`)
        else setSavedMsg(`${crawl.visited} sayfa tarandı.`)
        return
      }

      // TEK SAYFA (dar): yalnızca verilen ilk linki oku
      setBusy('Site indiriliyor…')
      const fetched = await fetchSiteContent(seeds[0])
      if (fetched.kind === 'fail') {
        setError(fetched.note || 'Site okunamadı.')
        setBusy('')
        return
      }
      let list: ExtractedProduct[]
      if (fetched.kind === 'pdf' && fetched.pdfDataUrl) {
        setBusy('PDF açılıyor…')
        const { pages, text } = await extractPdfText(fetched.pdfDataUrl)
        if (text.trim().length < 60) {
          setBusy('')
          setError(`Bağlantıdaki PDF taranmış görünüyor (${pages} sayfa), yazı çıkmadı. Sayfa fotoğrafıyla deneyin.`)
          return
        }
        const chunks = chunkText(text, 6000)
        list = await extractProductsFromChunks({
          apiKey,
          model: s.model,
          chunks,
          onProgress: (c, t) => setBusy(`Okunuyor… bölüm ${c}/${t}`)
        })
      } else {
        setBusy('Yapay zeka ürünleri okuyor…')
        list = await extractProducts({ apiKey, model: s.model, text: fetched.text })
      }
      setItems(list)
      if (list.length === 0) setError('Bu sayfada ürün bulunamadı. Farklı bir bağlantı veya PDF katalog deneyin.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hata oluştu.')
    } finally {
      setBusy('')
    }
  }

  async function runFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError('')
    setItems(null)
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const apiKey = await needApiKey()
    if (!apiKey) return
    const s = await readStokSettings()
    try {
      let list: ExtractedProduct[]
      if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
        // Büyük PDF: dosyayı AI'ye YOLLAMA — telefonda metnini çıkar, parçala, oku.
        setBusy('PDF açılıyor…')
        const dataUrl = await fileToDataUrl(file)
        const { pages, text } = await extractPdfText(dataUrl)
        if (text.trim().length < 60) {
          // Taranmış / resim tabanlı PDF: metin yok
          setBusy('')
          setError(
            `Bu PDF taranmış/görüntü tabanlı görünüyor (${pages} sayfa), içinden yazı çıkmadı. ` +
              'Böyle katalogları "PDF / Foto" ile sayfa sayfa fotoğraflayarak okutabilirsiniz.'
          )
          return
        }
        const chunks = chunkText(text, 6000)
        list = await extractProductsFromChunks({
          apiKey,
          model: s.model,
          chunks,
          onProgress: (c, t) => setBusy(`Okunuyor… bölüm ${c}/${t}`)
        })
      } else {
        setBusy('Yapay zeka okuyor…')
        const dataUrl = await fileToCompressedDataUrl(file, 1600, 0.85)
        list = await extractProducts({ apiKey, model: s.model, imageDataUrl: dataUrl })
      }
      setItems(list)
      if (list.length === 0) setError('İçerikte ürün bulunamadı.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hata oluştu.')
    } finally {
      setBusy('')
    }
  }

  function runPaste() {
    setError('')
    setItems(null)
    const list = parseProductPaste(pasteText)
    if (list.length === 0) {
      setError('Ürün ayrıştırılamadı. Excel’den başlıklı bir tablo yapıştırmayı deneyin.')
      return
    }
    setItems(list)
  }

  async function runPasteAI() {
    setError('')
    setItems(null)
    if (!pasteText.trim()) return
    const apiKey = await needApiKey()
    if (!apiKey) return
    const s = await readStokSettings()
    setBusy('Yapay zeka okuyor…')
    try {
      const list = await extractProducts({ apiKey, model: s.model, text: pasteText })
      setItems(list)
      if (list.length === 0) setError('Ürün bulunamadı.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hata oluştu.')
    } finally {
      setBusy('')
    }
  }

  function toggle(i: number) {
    setItems((prev) => (prev ? prev.map((p, j) => (j === i ? { ...p, _selected: !p._selected } : p)) : prev))
  }

  async function saveSelected() {
    if (!items) return
    const chosen = items.filter((p) => p._selected)
    if (chosen.length === 0) return
    const res = await addProductsMany(
      chosen.map((p) => ({
        name: p.name,
        company: p.company,
        category: p.category,
        code: p.code,
        salePrice: p.salePrice,
        buyPrice: p.buyPrice,
        qty: p.qty ?? 0,
        unit: p.unit,
        description: p.description,
        photoUrl: p.photoUrl,
        active: false, // katalog: önce pasif; aktif listenizle işaretlenecek
        source: 'catalog' as const
      }))
    )
    setItems(null)
    setPasteText('')
    setUrl('')
    setSavedMsg(`${res.added} ürün kataloğa eklendi.${res.skipped ? ` ${res.skipped} tekrar atlandı.` : ''}`)
  }

  const methods: { key: Method; label: string }[] = [
    { key: 'paste', label: 'Yapıştır' },
    { key: 'link', label: 'Web linki' },
    { key: 'file', label: 'PDF / Foto' }
  ]

  const selectedCount = items?.filter((p) => p._selected).length ?? 0

  return (
    <div className="pb-6">
      <header className="px-4 pt-5 pb-3">
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">İçe aktar</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Firma sitesi, PDF katalog veya Excel listesinden ürünleri kataloğa çek.
        </p>
      </header>

      <div className="px-4 space-y-4">
        {/* Yöntem seçici */}
        <div className="grid grid-cols-3 gap-2">
          {methods.map((m) => (
            <button
              key={m.key}
              onClick={() => {
                setMethod(m.key)
                setItems(null)
                setError('')
              }}
              className={`py-2 rounded-xl text-sm font-medium border transition-colors ${
                method === m.key
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {savedMsg && (
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-3 py-2.5 text-sm flex items-center justify-between gap-3">
            <span>{savedMsg}</span>
            <button onClick={() => navigate('/')} className="font-semibold underline shrink-0">
              Ürünlere git
            </button>
          </div>
        )}

        {/* Yöntem gövdesi */}
        {method === 'paste' && (
          <div className="space-y-2">
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={7}
              placeholder={'Excel’den tabloyu kopyala-yapıştır ya da her satıra bir ürün yaz.\n\nÖrnek:\nÜrün\tFirma\tFiyat\tAdet\nSilikon Kılıf\tBaseus\t250\t10'}
              className={inputCls}
            />
            <div className="flex gap-2">
              <button onClick={runPaste} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-medium active:scale-95">
                Ayrıştır (anahtarsız)
              </button>
              <button
                onClick={runPasteAI}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium active:scale-95"
              >
                Yapay zeka ile oku
              </button>
            </div>
          </div>
        )}

        {method === 'link' && (
          <div className="space-y-2">
            <textarea
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              rows={3}
              placeholder={'Firma sitesi ya da ürün/katalog sayfası linki.\nBirden fazla link için her satıra bir tane yaz.\n\nörn. firma.com/urunler'}
              className={inputCls}
              inputMode="url"
            />

            {/* Geniş tarama ayarı */}
            <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Geniş tarama
                <span className="block text-xs font-normal text-slate-400">Site içindeki kategori/ürün sayfalarını da gez.</span>
              </span>
              <input type="checkbox" checked={wide} onChange={(e) => setWide(e.target.checked)} className="h-5 w-5 accent-indigo-600" />
            </label>
            {wide && (
              <label className="flex items-center justify-between gap-3 px-1">
                <span className="text-sm text-slate-600 dark:text-slate-300">En fazla sayfa</span>
                <input
                  value={maxPages}
                  onChange={(e) => setMaxPages(e.target.value)}
                  inputMode="numeric"
                  className="w-20 px-2 py-1.5 text-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                />
              </label>
            )}

            <button onClick={runLink} className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-medium active:scale-95">
              {wide ? 'Siteyi geniş tara' : 'Siteyi oku'}
            </button>
            <p className="text-xs text-slate-400">
              Not: Web tarama en güvenilir şekilde telefona kurulu uygulamada (APK) çalışır; tarayıcıda bazı siteler
              güvenlik (CORS) nedeniyle engelleyebilir. Çok sayfa taramak biraz sürebilir ve daha çok yapay zeka kullanır.
            </p>
          </div>
        )}

        {method === 'file' && (
          <div className="space-y-2">
            <input ref={fileRef} type="file" accept="application/pdf,image/*" onChange={runFile} className="hidden" />
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full py-8 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-500 flex flex-col items-center gap-2"
            >
              <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={1.6}>
                <path d="M12 3v12" />
                <polyline points="7 8 12 3 17 8" />
                <path d="M5 21h14" />
              </svg>
              <span className="text-sm font-medium">PDF katalog ya da fotoğraf seç</span>
            </button>
            <p className="text-xs text-slate-400">
              Büyük PDF olabilir: dosya buluta gönderilmez, telefonda yazısı çıkarılıp parça parça okunur. Taranmış
              (yazısız) kataloglarda sayfa fotoğrafı çekmeniz gerekir.
            </p>
          </div>
        )}

        {busy && (
          <div className="rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 px-3 py-2.5 text-sm flex items-center gap-2">
            <span className="h-4 w-4 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
            {busy}
          </div>
        )}
        {error && (
          <div className="rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 px-3 py-2.5 text-sm">{error}</div>
        )}

        {/* Önizleme */}
        {items && items.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">{items.length} ürün bulundu</h2>
              <button
                onClick={() =>
                  setItems((prev) => {
                    if (!prev) return prev
                    const allOn = prev.every((p) => p._selected)
                    return prev.map((p) => ({ ...p, _selected: !allOn }))
                  })
                }
                className="text-xs text-indigo-600 dark:text-indigo-400 font-medium"
              >
                Tümünü seç/kaldır
              </button>
            </div>
            <div className="space-y-1.5 max-h-[46vh] overflow-y-auto pr-1">
              {items.map((p, i) => (
                <label
                  key={i}
                  className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer ${
                    p._selected
                      ? 'border-indigo-300 dark:border-indigo-600 bg-indigo-50/50 dark:bg-indigo-500/10'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 opacity-60'
                  }`}
                >
                  <input type="checkbox" checked={!!p._selected} onChange={() => toggle(i)} className="mt-1 accent-indigo-600" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{p.name}</p>
                    <p className="text-xs text-slate-400 truncate">
                      {[p.company, p.category, p.code].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                  {p.salePrice != null && p.salePrice > 0 && (
                    <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 shrink-0">
                      {p.salePrice.toLocaleString('tr-TR')} ₺
                    </span>
                  )}
                </label>
              ))}
            </div>
            <button
              onClick={saveSelected}
              disabled={selectedCount === 0}
              className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold active:scale-95 disabled:opacity-50"
            >
              Seçilen {selectedCount} ürünü kataloğa ekle
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('Dosya okunamadı'))
    r.readAsDataURL(file)
  })
}

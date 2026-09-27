import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Header, Icon, T_BASLIK, T_GOVDE, T_SOLUK } from '../components/ui'
import { linkAyikla, linktenTarif, platformBul } from '../lib/importer'
import { metniAyristir } from '../lib/parse'
import { aiFotograftan, aiIleAyikla, apiAnahtari } from '../lib/ai'
import { fotoOku, uzaktanFotoIndir } from '../lib/image'
import type { LzDraft } from '../types'

type Mod = 'link' | 'metin' | 'foto'

export default function AddRecipe() {
  const navigate = useNavigate()
  const [mod, setMod] = useState<Mod>('link')
  const [link, setLink] = useState('')
  const [metin, setMetin] = useState('')
  const [yukleniyor, setYukleniyor] = useState('')
  const [hata, setHata] = useState('')
  const aiVar = !!apiAnahtari()
  const fotoGiris = useRef<HTMLInputElement>(null)

  const panodan = async () => {
    try {
      const t = await navigator.clipboard.readText()
      if (mod === 'link') setLink(linkAyikla(t) || t.trim())
      else setMetin(t)
    } catch {
      setHata('Pano okunamadı; kutuya uzun basıp “Yapıştır” de.')
    }
  }

  // Taslagi hazirlayip duzenleme ekranina gecer. Fotograf bir https adresiyse
  // (paylasim kapak gorseli) bir kez indirilir: sosyal medya gorsel adresleri
  // bir sure sonra gecersiz oluyor, cihazda saklanmasi gerekir.
  const taslakAc = async (d: LzDraft, not = '') => {
    if (/^https:\/\//i.test(d.photo)) {
      setYukleniyor('Fotoğraf alınıyor…')
      try {
        d.photo = await uzaktanFotoIndir(d.photo)
      } catch {
        d.photo = ''
      }
    }
    navigate('/yeni', { state: { draft: d, not } })
  }

  const yapilandir = async (ham: string, d: LzDraft): Promise<{ d: LzDraft; not: string }> => {
    if (aiVar) {
      setYukleniyor('Yapay zeka tarifi düzenliyor…')
      try {
        const ai = await aiIleAyikla(ham, d.title)
        return { d: { ...d, ...ai, title: ai.title || d.title }, not: '' }
      } catch (e) {
        const kural = metniAyristir(ham)
        return {
          d: { ...d, ...kural, title: kural.title || d.title, notes: ham },
          not: `${(e as Error).message} Basit ayrıştırma kullanıldı; kontrol et.`
        }
      }
    }
    const kural = metniAyristir(ham)
    const zayif = !kural.ingredients?.length
    return {
      d: { ...d, ...kural, title: d.title || kural.title || '', notes: zayif ? ham : '' },
      not: zayif
        ? 'Malzemeler otomatik ayrılamadı; açıklama “Notlar”a kondu. Ayarlar’dan API anahtarı girersen yapay zeka düzenler.'
        : 'Otomatik ayrıldı; kontrol edip kaydet.'
    }
  }

  const linktenGetir = async () => {
    setHata('')
    const url = linkAyikla(link)
    if (!url) {
      setHata('Geçerli bir link yapıştır (https://…).')
      return
    }
    setYukleniyor('Paylaşım okunuyor…')
    try {
      const s = await linktenTarif(url)
      if (s.yapilandirilmis) {
        await taslakAc(s.draft)
        return
      }
      if (!s.hamMetin || s.hamMetin.length < 20) {
        if (!s.draft.title && !s.draft.photo) {
          setHata(s.not)
          setYukleniyor('')
          return
        }
        await taslakAc(s.draft, s.not)
        return
      }
      const { d, not } = await yapilandir(s.hamMetin, s.draft)
      await taslakAc(d, not || s.not)
    } catch (e) {
      setHata((e as Error).message || 'Bir sorun oluştu.')
      setYukleniyor('')
    }
  }

  const metindenGetir = async () => {
    setHata('')
    if (metin.trim().length < 15) {
      setHata('Tarif metnini yapıştır (malzemeler ve yapılışı).')
      return
    }
    const url = linkAyikla(metin)
    const bos: LzDraft = {
      title: '',
      photo: '',
      sourceUrl: url,
      platform: url ? platformBul(url) : 'manual',
      author: '',
      servings: 0,
      minutes: 0,
      ingredients: [],
      steps: [],
      notes: '',
      tags: []
    }
    try {
      const { d, not } = await yapilandir(metin, bos)
      await taslakAc(d, not)
    } catch (e) {
      setHata((e as Error).message)
      setYukleniyor('')
    }
  }

  // Yemek kitabi sayfasi / el yazisi / ekran goruntusu -> tarif (yapay zeka).
  // Anahtar yoksa fotograf tarifin kapagi olur, gerisi elle yazilir.
  const fotograftan = async (f: File) => {
    setHata('')
    setYukleniyor('Fotoğraf hazırlanıyor…')
    try {
      const kapak = await fotoOku(f)
      const bos: LzDraft = {
        title: '',
        photo: kapak,
        sourceUrl: '',
        platform: 'manual',
        author: '',
        servings: 0,
        minutes: 0,
        ingredients: [],
        steps: [],
        notes: '',
        tags: []
      }
      if (!aiVar) {
        navigate('/yeni', { state: { draft: bos, not: 'Fotoğraftan okumak için Ayarlar’dan API anahtarı gir; şimdilik tarifi elle yazabilirsin.' } })
        return
      }
      setYukleniyor('Yapay zeka fotoğrafı okuyor…')
      // Yazinin okunabilmesi icin daha buyuk bir kopya gonderilir
      const okunakli = await fotoOku(f, 1600, 0.85)
      const ai = await aiFotograftan(okunakli)
      navigate('/yeni', { state: { draft: { ...bos, ...ai }, not: 'Fotoğraftan okundu; kontrol edip kaydet.' } })
    } catch (e) {
      setHata((e as Error).message || 'Fotoğraf okunamadı.')
      setYukleniyor('')
    }
  }

  return (
    <div>
      <Header title="Tarif ekle" back />
      <div className="px-4 space-y-4 pb-6">
        <div className="grid grid-cols-3 bg-[#f3ebe2] dark:bg-[#221d1a] rounded-full p-1">
          {(['link', 'metin', 'foto'] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMod(m)
                setHata('')
              }}
              className={`py-2 rounded-full text-sm font-semibold transition ${mod === m ? 'bg-lz-600 text-white' : 'text-[#8c7d72] dark:text-[#a3968b]'}`}
            >
              {m === 'link' ? 'Linkten' : m === 'metin' ? 'Metinden' : 'Fotoğraftan'}
            </button>
          ))}
        </div>

        {mod === 'link' ? (
          <div className="lz-card p-4 space-y-3">
            <div className={`font-semibold ${T_BASLIK}`}>Sosyal medyadan tarif ekle</div>
            <p className={`text-[13px] ${T_SOLUK}`}>
              Instagram, TikTok, YouTube, Pinterest paylaşımında “Paylaş → Bağlantıyı kopyala” de, buraya yapıştır. Tarif sitelerinin linkleri de olur.
            </p>
            <div className="flex gap-2">
              <input
                className="lz-input"
                placeholder="https://www.instagram.com/reel/…"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                inputMode="url"
              />
              <button onClick={() => void panodan()} className="lz-btn-soft px-4 flex-shrink-0" aria-label="Panodan yapıştır">
                Yapıştır
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {['Instagram', 'TikTok', 'YouTube', 'Pinterest', 'Tarif siteleri'].map((p) => (
                <span key={p} className="lz-pill">
                  {p}
                </span>
              ))}
            </div>
            <button className="lz-btn-primary w-full" disabled={!!yukleniyor || !link.trim()} onClick={() => void linktenGetir()}>
              {yukleniyor || 'Tarifi getir'}
            </button>
          </div>
        ) : mod === 'foto' ? (
          <div className="lz-card p-4 space-y-3">
            <div className={`font-semibold ${T_BASLIK}`}>Fotoğraftan tarif ekle</div>
            <p className={`text-[13px] ${T_SOLUK}`}>
              Yemek kitabı sayfası, anneannenin el yazısı defteri ya da bir paylaşımın ekran görüntüsü… Fotoğrafını çek ya da galeriden seç; yapay zeka
              yazıyı okuyup malzeme ve adımlara ayırsın.
            </p>
            <input
              ref={fotoGiris}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) void fotograftan(f)
              }}
            />
            <button className="lz-btn-primary w-full" disabled={!!yukleniyor} onClick={() => fotoGiris.current?.click()}>
              {yukleniyor || '📷 Fotoğraf seç'}
            </button>
            {!aiVar && <p className={`text-[12px] ${T_SOLUK}`}>Yazıyı okumak için yapay zeka gerekir (Ayarlar › API anahtarı).</p>}
          </div>
        ) : (
          <div className="lz-card p-4 space-y-3">
            <div className={`font-semibold ${T_BASLIK}`}>Açıklamadan tarif ekle</div>
            <p className={`text-[13px] ${T_SOLUK}`}>
              Paylaşımın açıklamasını, bir mesajı ya da web sayfasındaki tarifi kopyalayıp yapıştır. Malzemeler ve adımlar ayrılır.
            </p>
            <textarea
              className="lz-input min-h-[200px] text-[15px]"
              placeholder={'Fırında Köfte 😋\nMalzemeler:\n500 gr kıyma\n1 soğan\n…\nYapılışı:\n1. …'}
              value={metin}
              onChange={(e) => setMetin(e.target.value)}
            />
            <div className="flex gap-2">
              <button onClick={() => void panodan()} className="lz-btn-soft flex-shrink-0">
                Yapıştır
              </button>
              <button className="lz-btn-primary flex-1" disabled={!!yukleniyor || !metin.trim()} onClick={() => void metindenGetir()}>
                {yukleniyor || 'Tarife dönüştür'}
              </button>
            </div>
          </div>
        )}

        {hata && <div className="rounded-2xl bg-rose-50 dark:bg-[#2a1a1d] text-rose-700 dark:text-rose-300 text-sm p-3.5">{hata}</div>}

        <div className={`text-[13px] px-1 ${T_GOVDE}`}>
          {aiVar ? (
            <span>✨ Yapay zeka açık: dağınık açıklamalar düzenli tarife çevrilir.</span>
          ) : (
            <span>
              İpucu: <Link to="/ayarlar" className="text-lz-600 font-semibold">Ayarlar</Link>’dan Claude API anahtarı girersen dağınık açıklamalar da
              yapay zekayla düzenli tarife çevrilir. Anahtarsız da çalışır.
            </span>
          )}
        </div>

        <Link to="/ne-pisirsem" className="lz-card p-4 flex items-center gap-3">
          <span className="w-11 h-11 rounded-2xl bg-lz-50 dark:bg-[#3a1d16] text-xl flex items-center justify-center">✨</span>
          <span className="flex-1">
            <span className={`block font-semibold ${T_BASLIK}`}>Ne pişirsem?</span>
            <span className={`block text-[13px] ${T_SOLUK}`}>İsteğini ya da dolabındakileri yaz, tarif hazırlansın</span>
          </span>
          <Icon name="back" className={`w-5 h-5 rotate-180 ${T_SOLUK}`} />
        </Link>

        <Link to="/yeni" className="lz-card p-4 flex items-center gap-3">
          <span className="w-11 h-11 rounded-2xl bg-lz-50 dark:bg-[#3a1d16] text-lz-600 flex items-center justify-center">
            <Icon name="edit" />
          </span>
          <span className="flex-1">
            <span className={`block font-semibold ${T_BASLIK}`}>Elle yaz</span>
            <span className={`block text-[13px] ${T_SOLUK}`}>Anneannenin tarifi, kendi tarifin…</span>
          </span>
          <Icon name="back" className={`w-5 h-5 rotate-180 ${T_SOLUK}`} />
        </Link>
      </div>
    </div>
  )
}

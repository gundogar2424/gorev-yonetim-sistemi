import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Header, Icon, T_BASLIK, T_GOVDE, T_SOLUK } from '../components/ui'
import { linkAyikla, platformBul } from '../lib/importer'
import { geminiyeHazirla, linktenTaslak, taslakHazirla, yapilandir } from '../lib/pipeline'
import { TarifYokHatasi, aiAdi, aiFotograftan, aiVideodan, apiAnahtari, saglayici, type VideoParcalari } from '../lib/ai'
import { mekanLinktenEkle } from '../lib/mekan'
import { kareler, konusmayiYaziyaCevir, sesModeli } from '../lib/video'
import { fotoOku } from '../lib/image'
import { paylasilanTarifOku } from '../lib/paylas'
import { addRecipe, updateRecipe } from '../db'
import type { LzDraft, LzRecipe } from '../types'
import { ayniLinkliTarif, benzerTarif } from '../lib/kopya'

type Mod = 'link' | 'metin' | 'foto' | 'video'

export default function AddRecipe() {
  const navigate = useNavigate()
  const [mod, setMod] = useState<Mod>('link')
  const [link, setLink] = useState('')
  const [metin, setMetin] = useState('')
  const [yukleniyor, setYukleniyor] = useState('')
  const [hata, setHata] = useState('')
  const [kopya, setKopya] = useState<{ tarif: LzRecipe; neden: string; devam: () => void } | null>(null)
  const aiVar = !!apiAnahtari()
  const fotoGiris = useRef<HTMLInputElement>(null)
  const videoGiris = useRef<HTMLInputElement>(null)
  const dosyaGiris = useRef<HTMLInputElement>(null)

  const panodan = async () => {
    try {
      const t = await navigator.clipboard.readText()
      if (mod === 'link') setLink(linkAyikla(t) || t.trim())
      else setMetin(t)
    } catch {
      setHata('Pano okunamadı; kutuya uzun basıp “Yapıştır” de.')
    }
  }

  // Taslagi son haline getirip (kapak indirme vb.) duzenleme ekranina gecer
  const taslakAc = async (d: LzDraft, not = '', yedekKapak = '') => {
    const t = await taslakHazirla(d, not, yedekKapak, setYukleniyor)
    navigate('/yeni', { state: t })
  }

  const linktenGetir = async (girdi = link, zorla = false) => {
    setHata('')
    setKopya(null)
    // Ayni link defterde varsa yapay zekaya hic gitmeden haber ver
    const var_ = zorla ? undefined : await ayniLinkliTarif(linkAyikla(girdi))
    if (var_) {
      setKopya({ tarif: var_, neden: 'bu link daha önce eklenmiş', devam: () => void linktenGetir(girdi, true) })
      return
    }
    setYukleniyor('Paylaşım okunuyor…')
    try {
      const t = await linktenTaslak(girdi, setYukleniyor)
      navigate('/yeni', { state: t })
    } catch (e) {
      // Tarif degil de bir mekan paylasildiysa Mekanlarim'a kaydedilir
      if (e instanceof TarifYokHatasi) {
        try {
          const { id, yeni } = await mekanLinktenEkle(girdi, setYukleniyor)
          navigate(`/mekan/${id}`, { state: yeni ? undefined : { zatenVar: true } })
          return
        } catch (e2) {
          setHata((e2 as Error).message)
          setYukleniyor('')
          return
        }
      }
      setHata((e as Error).message || 'Bir sorun oluştu.')
      setYukleniyor('')
    }
  }

  // Instagram/TikTok'taki "Paylaş" menusunden gelindiyse link kendiliginden islenir
  const paylasim = (useLocation().state as { paylasim?: string } | null)?.paylasim
  const islenen = useRef('')
  useEffect(() => {
    if (!paylasim || islenen.current === paylasim) return
    islenen.current = paylasim
    const u = linkAyikla(paylasim)
    if (u) {
      setMod('link')
      setLink(u)
      void linktenGetir(u)
    } else {
      setMod('metin')
      setMetin(paylasim)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paylasim])

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
      const { d, not } = await yapilandir(metin, bos, setYukleniyor)
      await taslakAc(d, not)
    } catch (e) {
      setHata((e as Error).message)
      setYukleniyor('')
    }
  }

  // Yemek kitabi sayfasi / el yazisi / ekran goruntusu -> tarif (yapay zeka).
  // Anahtar yoksa fotograf tarifin kapagi olur, gerisi elle yazilir.
  // GALERIDEN VIDEO: Instagram videoyu vermezse en kesin yol. Reel telefonun
  // ekran kaydiyla (sesli) kaydedilir, buradan secilir; yapay zeka izler.
  const videodan = async (f: File) => {
    setHata('')
    if (!aiVar) {
      setHata('Videodan tarif çıkarmak için Ayarlar’dan Gemini (ücretsiz) ya da Claude anahtarı gir.')
      return
    }
    const parca: VideoParcalari = { baslik: '', aciklama: '', altyazi: '', konusma: '', kareler: [] }
    let kapak = ''
    try {
      if (saglayici() === 'gemini') {
        kapak = await geminiyeHazirla(f, parca, setYukleniyor)
      } else {
        setYukleniyor('Videodan kareler alınıyor…')
        const k = await kareler(f, 8)
        parca.kareler = k.kareler
        kapak = k.kareler[1] ?? ''
        const model = sesModeli()
        if (model !== 'kapali') parca.konusma = await konusmayiYaziyaCevir(f, model, setYukleniyor).catch(() => '')
      }
      setYukleniyor(`${aiAdi()} videoyu izliyor…`)
      const ai = await aiVideodan(parca)
      const d: LzDraft = {
        title: ai.title ?? '',
        photo: kapak,
        sourceUrl: '',
        platform: 'manual',
        author: '',
        servings: ai.servings ?? 0,
        minutes: ai.minutes ?? 0,
        ingredients: ai.ingredients ?? [],
        steps: ai.steps ?? [],
        notes: ai.notes ?? '',
        tags: ai.tags ?? []
      }
      await taslakAc(d, 'Videodan çıkarıldı; kontrol edip kaydet. İstersen “Kaynak link”e Instagram linkini yapıştır.')
    } catch (e) {
      setHata((e as Error).message || 'Video işlenemedi.')
      setYukleniyor('')
    }
  }

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
        <div className="grid grid-cols-4 bg-[#f3ebe2] dark:bg-[#221d1a] rounded-full p-1">
          {(['link', 'video', 'metin', 'foto'] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMod(m)
                setHata('')
              }}
              className={`py-2 rounded-full text-sm font-semibold transition ${mod === m ? 'bg-lz-600 text-white' : 'text-[#8c7d72] dark:text-[#a3968b]'}`}
            >
              {m === 'link' ? 'Link' : m === 'video' ? 'Video' : m === 'metin' ? 'Metin' : 'Fotoğraf'}
            </button>
          ))}
        </div>

        {mod === 'link' ? (
          <div className="lz-card p-4 space-y-3">
            <div className={`font-semibold ${T_BASLIK}`}>Sosyal medyadan tarif ekle</div>
            <p className={`text-[13px] ${T_SOLUK}`}>
              Instagram, TikTok, YouTube, Pinterest paylaşımında “Paylaş → Lezzet Defteri”ni seç ya da bağlantıyı kopyalayıp buraya yapıştır.
              Açıklamada tarif yazmıyorsa video da incelenir: söylenenler ve ekrandaki yazılar okunur.
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
            <p className={`text-[12px] ${T_SOLUK}`}>Instagram, TikTok, YouTube, Pinterest, Facebook ve tarif sitelerinin linkleri olur.</p>
            <button className="lz-btn-primary w-full" disabled={!!yukleniyor || !link.trim()} onClick={() => void linktenGetir()}>
              {yukleniyor || 'Tarifi getir'}
            </button>
          </div>
        ) : mod === 'video' ? (
          <div className="lz-card p-4 space-y-3">
            <div className={`font-semibold ${T_BASLIK}`}>Videodan tarif ekle</div>
            <p className={`text-[13px] ${T_SOLUK}`}>
              Link videoyu vermezse en kesin yol bu. Reel’i telefonun <b>ekran kaydı</b>yla sesli kaydet (bildirim panelinden “Ekran kaydedici”, “Medya
              sesleri” seçili olsun), sonra buradan seç. Yapay zeka videoyu izleyip dinler.
            </p>
            <input
              ref={videoGiris}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) void videodan(f)
              }}
            />
            <button className="lz-btn-primary w-full" disabled={!!yukleniyor} onClick={() => videoGiris.current?.click()}>
              {yukleniyor || '🎬 Galeriden video seç'}
            </button>
            {!aiVar && <p className={`text-[12px] ${T_SOLUK}`}>Bunun için Ayarlar’dan Gemini (ücretsiz) ya da Claude anahtarı gir.</p>}
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
        {kopya && <KopyaUyarisi {...kopya} kapat={() => setKopya(null)} />}

        <div className={`text-[13px] px-1 ${T_GOVDE}`}>
          {aiVar ? (
            <span>✨ Yapay zeka açık: dağınık açıklamalar düzenli tarife çevrilir.</span>
          ) : (
            <span>
              İpucu: <Link to="/ayarlar" className="text-lz-600 font-semibold">Ayarlar</Link>’dan ücretsiz Gemini ya da Claude anahtarı girersen videolar ve dağınık açıklamalar da
              yapay zekayla düzenli tarife çevrilir. Anahtarsız da çalışır.
            </span>
          )}
        </div>

        <button onClick={() => dosyaGiris.current?.click()} className="lz-card p-4 flex items-center gap-3 w-full text-left">
          <span className="w-11 h-11 rounded-2xl bg-lz-50 dark:bg-[#3a1d16] text-xl flex items-center justify-center">📄</span>
          <span className="flex-1">
            <span className={`block font-semibold ${T_BASLIK}`}>Dosyadan</span>
            <span className={`block text-[13px] ${T_SOLUK}`}>Sana paylaşılan tarif dosyasını deftere al</span>
          </span>
          <Icon name="back" className={`w-5 h-5 rotate-180 ${T_SOLUK}`} />
        </button>
        <input
          ref={dosyaGiris}
          type="file"
          accept=".html,.htm,.json,text/html,application/json"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f) return
            setHata('')
            try {
              const t = paylasilanTarifOku(await f.text())
              const b = await benzerTarif({ title: t.title ?? '', ingredients: t.ingredients ?? [], sourceUrl: t.sourceUrl })
              if (b && !confirm(`“${b.tarif.title}” zaten defterinde (${b.neden}). Yine de eklensin mi?`)) {
                navigate(`/tarif/${b.tarif.id}`)
                return
              }
              const id = await addRecipe({
                title: t.title ?? 'Tarif',
                photo: t.photo ?? '',
                sourceUrl: t.sourceUrl ?? '',
                platform: t.platform ?? 'manual',
                author: t.author ?? '',
                servings: t.servings ?? 0,
                minutes: t.minutes ?? 0,
                ingredients: t.ingredients ?? [],
                steps: t.steps ?? [],
                notes: t.notes ?? '',
                tags: t.tags ?? [],
                besin: t.besin
              })
              if (t.tm) await updateRecipe(id, { tm: t.tm })
              navigate(`/tarif/${id}`)
            } catch (err) {
              setHata((err as Error).message)
            }
          }}
        />

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

export function KopyaUyarisi({ tarif, neden, devam, kapat, devamYazi = 'Yine de ekle' }: { tarif: LzRecipe; neden: string; devam: () => void; kapat: () => void; devamYazi?: string }) {
  return (
    <div className="rounded-2xl bg-amber-50 dark:bg-[#2a2113] text-amber-900 dark:text-amber-200 text-[13.5px] p-3.5 space-y-2.5">
      <div>
        <b>Bu tarif zaten defterinde:</b> “{tarif.title}” <span className="opacity-80">({neden})</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link to={`/tarif/${tarif.id}`} className="lz-btn-primary px-3 py-1.5 text-[12.5px]">
          Var olanı aç
        </Link>
        <button
          className="lz-btn-soft px-3 py-1.5 text-[12.5px]"
          onClick={() => {
            kapat()
            devam()
          }}
        >
          {devamYazi}
        </button>
      </div>
    </div>
  )
}

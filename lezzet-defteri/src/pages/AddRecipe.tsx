import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Header, Icon, T_BASLIK, T_GOVDE, T_SOLUK } from '../components/ui'
import { linkAyikla, linktenTarif, metinIndir, platformBul, type LinkSonucu } from '../lib/importer'
import { metniAyristir } from '../lib/parse'
import { aiAdi, aiFotograftan, aiIleAyikla, aiVideodan, apiAnahtari, saglayici, type VideoParcalari } from '../lib/ai'
import { instagramVeri, kareler, konusmayiYaziyaCevir, sesModeli, videoAdresiBul, videoIndir, youtubeBilgi } from '../lib/video'
import { fotoOku, uzaktanFotoIndir } from '../lib/image'
import type { LzDraft } from '../types'

type Mod = 'link' | 'metin' | 'foto' | 'video'

export default function AddRecipe() {
  const navigate = useNavigate()
  const [mod, setMod] = useState<Mod>('link')
  const [link, setLink] = useState('')
  const [metin, setMetin] = useState('')
  const [yukleniyor, setYukleniyor] = useState('')
  const [hata, setHata] = useState('')
  const aiVar = !!apiAnahtari()
  const fotoGiris = useRef<HTMLInputElement>(null)
  const videoGiris = useRef<HTMLInputElement>(null)

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
  const taslakAc = async (d: LzDraft, not = '', yedekKapak = '') => {
    if (/^https:\/\//i.test(d.photo)) {
      setYukleniyor('Fotoğraf alınıyor…')
      try {
        d.photo = await uzaktanFotoIndir(d.photo)
      } catch {
        d.photo = yedekKapak // kapak inmezse videodan alinan kare
      }
    }
    if (!d.photo && yedekKapak) d.photo = yedekKapak
    if (!d.ingredients.filter((x) => x.trim()).length) {
      not = `⚠️ Malzemeler bulunamadı, listeyi kendin yaz. ${not}`.trim()
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
          not: `⚠️ Yapay zeka çalışmadı: ${(e as Error).message} Tarif yalnızca basit kurallarla ayrıldı; kontrol et.`
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

  // Videonun kendisinden bilgi toplar: YouTube'da altyazi + tam aciklama;
  // Instagram/TikTok/Facebook'ta video indirilir, kareleri alinir ve konusma
  // cihazda yaziya cevrilir. Her adim ayri denenir; biri olmazsa digerleriyle devam.
  const videoTopla = async (url: string, s: LinkSonucu): Promise<{ parca: VideoParcalari; kapak: string; notlar: string[] }> => {
    const parca: VideoParcalari = { baslik: s.draft.title, aciklama: s.hamMetin, altyazi: '', konusma: '', kareler: [] }
    const notlar: string[] = []
    let kapak = ''
    const ua = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36'

    if (s.draft.platform === 'youtube') {
      setYukleniyor('YouTube altyazısı okunuyor…')
      const yt = await youtubeBilgi(s.html, (u) => metinIndir(u, ua)).catch(() => ({ aciklama: '', altyazi: '' }))
      if (yt.aciklama.length > parca.aciklama.length) parca.aciklama = yt.aciklama
      parca.altyazi = yt.altyazi
      // Gemini YouTube videosunu dogrudan izleyebilir (altyazi olmasa da)
      if (saglayici() === 'gemini') parca.youtube = url
      else if (!yt.altyazi) notlar.push('videonun altyazısı yok ya da alınamadı')
      return { parca, kapak, notlar }
    }

    let videoUrl = videoAdresiBul(s.html, s.draft.platform)
    const kod = url.match(/instagram\.com\/(?:[^/]+\/)?(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/)?.[1]
    if (!videoUrl && kod) {
      // Instagram'in gomme sayfasi girissiz de video adresini ve aciklamayi verir
      try {
        const gomme = await metinIndir(`https://www.instagram.com/p/${kod}/embed/captioned/`, ua)
        videoUrl = videoAdresiBul(gomme, 'instagram')
        if (!parca.aciklama) {
          const c = gomme.match(/class="Caption"[^>]*>([\s\S]*?)<div class="CaptionComments"/)
          if (c) parca.aciklama = c[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/[ \t]+/g, ' ').trim()
        }
      } catch {
        /* gomme sayfasi da kapali */
      }
    }
    if (!videoUrl && kod) {
      setYukleniyor('Instagram’dan video bilgisi isteniyor…')
      const v = await instagramVeri(kod)
      videoUrl = v.videoUrl
      if (v.aciklama.length > parca.aciklama.length) parca.aciklama = v.aciklama
      if (v.kapak) kapak = v.kapak
    }
    if (!videoUrl) {
      notlar.push('video dosyasına ulaşılamadı (Instagram izin vermedi ya da paylaşım gizli)')
      return { parca, kapak, notlar }
    }

    let video: Blob
    try {
      setYukleniyor('Video indiriliyor…')
      video = await videoIndir(videoUrl, url)
    } catch (e) {
      notlar.push((e as Error).message.toLocaleLowerCase('tr'))
      return { parca, kapak, notlar }
    }

    // Gemini videoyu (ses + goruntu) kendisi anlar: kare/ses isine gerek yok.
    // Dogrudan gonderme siniri ~20 MB; daha buyuk videolarda asagidaki yol kullanilir.
    if (saglayici() === 'gemini' && video.size <= 18 * 1024 * 1024) {
      setYukleniyor('Video hazırlanıyor…')
      const b64 = await new Promise<string>((res, rej) => {
        const fr = new FileReader()
        fr.onload = () => res(String(fr.result).split(',')[1] ?? '')
        fr.onerror = () => rej(new Error('okunamadı'))
        fr.readAsDataURL(video)
      })
      parca.video = { mime: video.type && video.type.startsWith('video/') ? video.type : 'video/mp4', data: b64 }
      try {
        kapak = (await kareler(video, 2)).kareler[1] ?? ''
      } catch {
        /* kapak olmadan da olur */
      }
      return { parca, kapak, notlar }
    }

    try {
      setYukleniyor('Videodan kareler alınıyor…')
      const k = await kareler(video, 8)
      parca.kareler = k.kareler
      kapak = k.kareler[Math.min(1, k.kareler.length - 1)] ?? ''
    } catch {
      notlar.push('videodan kare alınamadı')
    }

    const model = sesModeli()
    if (model !== 'kapali') {
      try {
        parca.konusma = await konusmayiYaziyaCevir(video, model, setYukleniyor)
      } catch (e) {
        notlar.push(`konuşma yazıya çevrilemedi (${(e as Error).message})`)
      }
    }
    return { parca, kapak, notlar }
  }

  const linktenGetir = async (girdi = link) => {
    setHata('')
    const url = linkAyikla(girdi)
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

      // Yapay zeka aciksa video HER ZAMAN izlenir ve aciklamayla birlestirilir:
      // aciklama cogu zaman tarifin yalnizca bir kismini yazar, gerisi videodadir.
      const videoPlatformu = s.draft.platform !== 'web'

      if (aiVar && videoPlatformu && (s.html || s.hamMetin)) {
        const { parca, kapak, notlar } = await videoTopla(url, s)
        if (parca.altyazi || parca.konusma || parca.kareler.length || parca.aciklama || parca.video || parca.youtube) {
          setYukleniyor(`${aiAdi()} tarifi hazırlıyor…`)
          try {
            const ai = await aiVideodan(parca)
            const kaynak = [
              parca.aciklama && 'açıklama',
              parca.altyazi && 'altyazı',
              parca.konusma && 'videodaki konuşma',
              (parca.video || parca.youtube) && 'videonun kendisi (Gemini izledi)',
              parca.kareler.length && 'ekrandaki yazılar'
            ].filter(Boolean)
            const d: LzDraft = { ...s.draft, ...ai, title: ai.title || s.draft.title }
            const izlendi = !!(parca.video || parca.youtube || parca.konusma || parca.altyazi || parca.kareler.length)
            if (!izlendi) {
              await taslakAc(
                d,
                '⚠️ VİDEO İZLENEMEDİ: tarif yalnızca paylaşımın yazılı açıklamasından çıkarıldı, videodaki malzemeler eksik ya da farklı olabilir. ' +
                  'En doğru sonuç için reel’i telefonun ekran kaydıyla (sesli) kaydedip “Tarif ekle → Videodan” ile seç.' +
                  (notlar.length ? ` (${notlar.join('; ')})` : ''),
                kapak
              )
              return
            }
            await taslakAc(
              d,
              `Tarif şunlardan çıkarıldı: ${kaynak.join(', ')}.` + (notlar.length ? ` Not: ${notlar.join('; ')}.` : '') + ' Kontrol edip kaydet.',
              kapak
            )
            return
          } catch (e) {
            // Sessizce gecme: sebep kullaniciya kirmizi uyariyla gosterilir
            if (!s.hamMetin) throw e
            const { d, not } = await yapilandir(s.hamMetin, s.draft)
            await taslakAc(
              d,
              `⚠️ Yapay zeka videoyu işleyemedi: ${(e as Error).message}` + (not.startsWith('⚠️') ? '' : ' Tarif yalnızca paylaşımın yazısından çıkarıldı.'),
              kapak
            )
            return
          }
        }
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
      const { d, not } = await yapilandir(metin, bos)
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
      if (saglayici() === 'gemini' && f.size <= 18 * 1024 * 1024) {
        setYukleniyor('Video hazırlanıyor…')
        const b64 = await new Promise<string>((res, rej) => {
          const fr = new FileReader()
          fr.onload = () => res(String(fr.result).split(',')[1] ?? '')
          fr.onerror = () => rej(new Error('Video okunamadı.'))
          fr.readAsDataURL(f)
        })
        parca.video = { mime: f.type && f.type.startsWith('video/') ? f.type : 'video/mp4', data: b64 }
        kapak = (await kareler(f, 2).catch(() => ({ kareler: [] as string[] }))).kareler[1] ?? ''
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

// TARIF CIKARMA HATTI: link / video -> duzenlenmis tarif taslagi.
// Hem "Tarif ekle" ekrani hem de arka arkaya paylasimlari isleyen sira
// (lib/sira.ts) ayni kodu kullanir. Ekrana bagli degildir; ilerleme mesajlari
// geri cagirimla bildirilir.
import { linkAyikla, linktenTarif, metinIndir, type LinkSonucu, youtubeId } from './importer'
import { metniAyristir } from './parse'
import { aiAdi, aiIleAyikla, aiVideodan, apiAnahtari, saglayici, type VideoParcalari } from './ai'
import { GEMINI_DOGRUDAN_MAX, instagramVeri, kareler, sesWavBase64, konusmayiYaziyaCevir, sesModeli, videoAdresiBul, videoIndir, youtubeBilgi } from './video'
import { uzaktanFotoIndir } from './image'
import type { LzDraft } from '../types'

export type Ilerleme = (mesaj: string) => void
export interface Taslak {
  draft: LzDraft
  not: string
}

// Taslagi son haline getirir: kapak bir https adresiyse bir kez indirilir
// (sosyal medya gorsel adresleri zamanla gecersiz olur), malzeme yoksa uyari eklenir.
export async function taslakHazirla(d: LzDraft, not = '', yedekKapak = '', ilerleme: Ilerleme = () => {}): Promise<Taslak> {
  if (/^https:\/\//i.test(d.photo)) {
    ilerleme('Fotoğraf alınıyor…')
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
  return { draft: d, not }
}


export async function yapilandir(ham: string, d: LzDraft, ilerleme: Ilerleme = () => {}): Promise<{ d: LzDraft; not: string }> {
  if (apiAnahtari()) {
    ilerleme('Yapay zeka tarifi düzenliyor…')
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


// Gemini icin videoyu hazirlar: kucukse videonun kendisi, buyukse 10 kare +
// ayri ses dosyasi (tek istek siniri asilmasin diye). Kapak karesini dondurur.
export async function geminiyeHazirla(video: Blob, parca: VideoParcalari, ilerleme: Ilerleme = () => {}): Promise<string> {
  if (video.size <= GEMINI_DOGRUDAN_MAX) {
    ilerleme('Video hazırlanıyor…')
    const b64 = await new Promise<string>((res, rej) => {
      const fr = new FileReader()
      fr.onload = () => res(String(fr.result).split(',')[1] ?? '')
      fr.onerror = () => rej(new Error('Video okunamadı.'))
      fr.readAsDataURL(video)
    })
    parca.video = { mime: video.type && video.type.startsWith('video/') ? video.type : 'video/mp4', data: b64 }
    return (await kareler(video, 2).catch(() => ({ kareler: [] as string[] }))).kareler[1] ?? ''
  }
  ilerleme('Video büyük; kareler ve ses ayrılıyor…')
  const k = await kareler(video, 10).catch(() => ({ kareler: [] as string[] }))
  parca.kareler = k.kareler
  try {
    parca.ses = { mime: 'audio/wav', data: await sesWavBase64(video) }
  } catch {
    /* ses ayrilamazsa yalnizca karelerle devam */
  }
  return k.kareler[1] ?? ''
}


// Videonun kendisinden bilgi toplar: YouTube'da altyazi + tam aciklama;
// Instagram/TikTok/Facebook'ta video indirilir, kareleri alinir ve konusma
// cihazda yaziya cevrilir. Her adim ayri denenir; biri olmazsa digerleriyle devam.
async function videoTopla(url: string, s: LinkSonucu, ilerleme: Ilerleme): Promise<{ parca: VideoParcalari; kapak: string; notlar: string[] }> {
  const parca: VideoParcalari = { baslik: s.draft.title, aciklama: s.hamMetin, altyazi: '', konusma: '', kareler: [] }
  const notlar: string[] = []
  let kapak = ''
  const ua = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36'

  if (s.draft.platform === 'youtube') {
    ilerleme('YouTube altyazısı okunuyor…')
    const yt = await youtubeBilgi(s.html, (u) => metinIndir(u, ua)).catch(() => ({ aciklama: '', altyazi: '' }))
    if (yt.aciklama.length > parca.aciklama.length) parca.aciklama = yt.aciklama
    parca.altyazi = yt.altyazi
    // Gemini YouTube videosunu dogrudan izleyebilir (altyazi olmasa da)
    // Gemini YouTube'u yalnizca tam "watch?v=" adresiyle izler (youtu.be/…?si= kisa linki taninmayabilir)
    const ytId = youtubeId(url)
    if (saglayici() === 'gemini') parca.youtube = ytId ? `https://www.youtube.com/watch?v=${ytId}` : url
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
    ilerleme('Instagram’dan video bilgisi isteniyor…')
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
    ilerleme('Video indiriliyor…')
    video = await videoIndir(videoUrl, url)
  } catch (e) {
    notlar.push((e as Error).message.toLocaleLowerCase('tr'))
    return { parca, kapak, notlar }
  }

  // Gemini videoyu (ses + goruntu) kendisi anlar: kare/ses isine gerek yok.
  // Dogrudan gonderme siniri ~20 MB; daha buyuk videolarda asagidaki yol kullanilir.
  if (saglayici() === 'gemini') {
    kapak = (await geminiyeHazirla(video, parca, ilerleme)) || kapak
    return { parca, kapak, notlar }
  }

  try {
    ilerleme('Videodan kareler alınıyor…')
    const k = await kareler(video, 8)
    parca.kareler = k.kareler
    kapak = k.kareler[Math.min(1, k.kareler.length - 1)] ?? ''
  } catch {
    notlar.push('videodan kare alınamadı')
  }

  const model = sesModeli()
  if (model !== 'kapali') {
    try {
      parca.konusma = await konusmayiYaziyaCevir(video, model, ilerleme)
    } catch (e) {
      notlar.push(`konuşma yazıya çevrilemedi (${(e as Error).message})`)
    }
  }
  return { parca, kapak, notlar }
}


export async function linktenTaslak(girdi: string, ilerleme: Ilerleme = () => {}): Promise<Taslak> {
  const url = linkAyikla(girdi)
  if (!url) throw new Error('Geçerli bir link yapıştır (https://…).')
  ilerleme('Paylaşım okunuyor…')
  {
    const s = await linktenTarif(url)
    if (s.yapilandirilmis) {
      return await taslakHazirla(s.draft, '', '', ilerleme)
    }

    // Yapay zeka aciksa video HER ZAMAN izlenir ve aciklamayla birlestirilir:
    // aciklama cogu zaman tarifin yalnizca bir kismini yazar, gerisi videodadir.
    const videoPlatformu = s.draft.platform !== 'web'

    if (apiAnahtari() && videoPlatformu && (s.html || s.hamMetin)) {
      const { parca, kapak, notlar } = await videoTopla(url, s, ilerleme)
      if (parca.altyazi || parca.konusma || parca.kareler.length || parca.aciklama || parca.video || parca.youtube) {
        ilerleme(`${aiAdi()} tarifi hazırlıyor…`)
        try {
          const ai = await aiVideodan(parca)
          const kaynak = [
            parca.aciklama && 'açıklama',
            parca.altyazi && 'altyazı',
            parca.konusma && 'videodaki konuşma',
            (parca.video || parca.youtube) && 'videonun kendisi (Gemini izledi)',
            parca.ses && 'videonun sesi (Gemini dinledi)',
            parca.kareler.length && 'ekrandaki yazılar'
          ].filter(Boolean)
          const d: LzDraft = { ...s.draft, ...ai, title: ai.title || s.draft.title }
          const izlendi = !!(parca.video || parca.youtube || parca.ses || parca.konusma || parca.altyazi || parca.kareler.length)
          if (!izlendi) {
            return await taslakHazirla(
              d,
              '⚠️ VİDEO İZLENEMEDİ: tarif yalnızca paylaşımın yazılı açıklamasından çıkarıldı, videodaki malzemeler eksik ya da farklı olabilir. ' +
                'En doğru sonuç için reel’i telefonun ekran kaydıyla (sesli) kaydedip “Tarif ekle → Videodan” ile seç.' +
                (notlar.length ? ` (${notlar.join('; ')})` : ''),
              kapak,
              ilerleme
            )
          }
          return await taslakHazirla(
            d,
            `Tarif şunlardan çıkarıldı: ${kaynak.join(', ')}.` + (notlar.length ? ` Not: ${notlar.join('; ')}.` : '') + ' Kontrol edip kaydet.',
            kapak,
            ilerleme
          )
        } catch (e) {
          // Sessizce gecme: sebep kullaniciya kirmizi uyariyla gosterilir
          if (!s.hamMetin) throw e
          const { d, not } = await yapilandir(s.hamMetin, s.draft, ilerleme)
          return await taslakHazirla(
            d,
            `⚠️ Yapay zeka videoyu işleyemedi: ${(e as Error).message}` + (not.startsWith('⚠️') ? '' : ' Tarif yalnızca paylaşımın yazısından çıkarıldı.'),
            kapak,
            ilerleme
          )
        }
      }
    }

    if (!s.hamMetin || s.hamMetin.length < 20) {
      if (!s.draft.title && !s.draft.photo) throw new Error(s.not || 'Paylaşım okunamadı.')
      return await taslakHazirla(s.draft, s.not, '', ilerleme)
    }
    const { d, not } = await yapilandir(s.hamMetin, s.draft, ilerleme)
    return await taslakHazirla(d, not || s.not, '', ilerleme)
  }
}


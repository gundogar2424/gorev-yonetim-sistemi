// Android "Paylaş" menüsünden Diyet Koçu'na gönderilen resmi yakalar.
// Samsung Health ekran görüntüsünü paylaş → uygulama açılır → Egzersiz
// sayfasına gidip fotoğrafı otomatik okur.
import { Capacitor } from '@capacitor/core'
import { urlToResizedDataUrl } from '../../lib/image'

// Paylaşımla gelen resim, Egzersiz sayfası alana kadar burada bekler.
let pendingSharedImage: string | null = null

// Egzersiz sayfası bunu okur (ve tüketir: bir kez alınınca temizlenir).
export function takeSharedImage(): string | null {
  const p = pendingSharedImage
  pendingSharedImage = null
  return p
}

// Uygulama açılışında ve paylaşımla tekrar açıldığında gelen içeriği kontrol eder.
export async function initShareIntent(navigate: (route: string) => void): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  let sendIntent: typeof import('send-intent')
  let filesystem: typeof import('@capacitor/filesystem')
  try {
    sendIntent = await import('send-intent')
    filesystem = await import('@capacitor/filesystem')
  } catch {
    return // eklenti yoksa sessizce geç
  }
  const { SendIntent } = sendIntent
  const { Filesystem } = filesystem

  const handle = async () => {
    try {
      const result = await SendIntent.checkSendIntentReceived()
      if (!result?.url) return
      const path = decodeURIComponent(result.url)

      let dataUrl = ''
      try {
        const content = await Filesystem.readFile({ path })
        const b64 = typeof content.data === 'string' ? content.data : ''
        if (!b64) return
        const mime = result.type && result.type.startsWith('image/') ? result.type : 'image/jpeg'
        dataUrl = `data:${mime};base64,${b64}`
      } catch {
        return // resim okunamadı
      }

      // Küçült (token/dosya boyutu için); başarısızsa ham hali kullan
      pendingSharedImage = (await urlToResizedDataUrl(dataUrl, 1400, 0.85)) || dataUrl
      try {
        await SendIntent.finish()
      } catch {
        /* yoksay */
      }
      navigate('/egzersiz?paylasim=1')
    } catch {
      /* yoksay */
    }
  }

  // Uygulama zaten açıkken paylaşım gelirse (onNewIntent → event)
  window.addEventListener('sendIntentReceived', () => void handle())
  // Soğuk açılışta (paylaşımla başlatıldıysa) da kontrol et
  void handle()
}

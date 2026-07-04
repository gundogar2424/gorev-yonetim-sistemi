// Paylasim ve dosya kaydetme — APK'da (native) Capacitor eklentilerini,
// web'de tarayici Share API / indirme kullanir. Boylece "Diyetisyene Gonder"
// dogrudan WhatsApp'a paylasilabilir ve yedek gercekten kaydedilir.
import { Capacitor } from '@capacitor/core'

export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed'

function isNative(): boolean {
  return Capacitor.isNativePlatform()
}

// Blob -> base64 (data: onekini ayiklar)
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onloadend = () => {
      const s = String(r.result)
      resolve(s.slice(s.indexOf(',') + 1))
    }
    r.onerror = () => reject(new Error('Dosya okunamadı'))
    r.readAsDataURL(blob)
  })
}

// Kullanici iptal etti mi? (paylas menusunu kapatma hata sayilmasin)
function isCancel(err: unknown): boolean {
  const m = (err as { message?: string })?.message?.toLowerCase() ?? ''
  return m.includes('cancel') || m.includes('abort') || m.includes('dismiss')
}

// ---- Yazili paylasim (WhatsApp vb.) ----
export async function shareTextSmart(text: string): Promise<ShareResult> {
  if (isNative()) {
    try {
      const { Share } = await import('@capacitor/share')
      await Share.share({ text, dialogTitle: 'Diyetisyene gönder' })
      return 'shared'
    } catch (err) {
      return isCancel(err) ? 'cancelled' : 'failed'
    }
  }
  // Web: once tarayici paylasim, olmazsa panoya kopyala
  const nav = navigator as Navigator & { share?: (d: { text: string }) => Promise<void> }
  if (typeof nav.share === 'function') {
    try {
      await nav.share({ text })
      return 'shared'
    } catch (err) {
      if (isCancel(err)) return 'cancelled'
    }
  }
  try {
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch {
    return 'failed'
  }
}

// ---- Gorsel paylasim (resmi WhatsApp'a gonder) ----
export async function shareImageSmart(blob: Blob, filename: string): Promise<ShareResult> {
  if (isNative()) {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem')
      const { Share } = await import('@capacitor/share')
      const base64 = await blobToBase64(blob)
      await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.Cache })
      const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache })
      // NOT: WhatsApp'a gorselle birlikte title/text GONDERILMEZ — metinle
      // birlikte gonderilince ilk denemede gorseli iliştirmeyip metni gonderiyor
      // (kullanici cikip tekrar deneyince gidiyordu). Sadece dosya + dialogTitle.
      await Share.share({ url: uri, dialogTitle: 'Diyetisyene gönder' })
      return 'shared'
    } catch (err) {
      return isCancel(err) ? 'cancelled' : 'failed'
    }
  }
  // Web: dosya paylasimi destekliyorsa paylas, yoksa indir
  const file = new File([blob], filename, { type: 'image/png' })
  const nav = navigator as Navigator & {
    canShare?: (d: { files: File[] }) => boolean
    share?: (d: { files: File[]; title?: string }) => Promise<void>
  }
  if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'Diyet Raporu' })
      return 'shared'
    } catch (err) {
      if (isCancel(err)) return 'cancelled'
    }
  }
  downloadBlob(blob, filename)
  return 'copied' // "indirildi" anlaminda
}

// ---- Birden cok gorseli birlikte paylas (WhatsApp'a 3-4 foto) ----
export async function shareImagesSmart(items: { blob: Blob; filename: string }[]): Promise<ShareResult> {
  if (!items.length) return 'failed'
  if (isNative()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem')
    const { Share } = await import('@capacitor/share')
    const uris: string[] = []
    try {
      for (const it of items) {
        const base64 = await blobToBase64(it.blob)
        await Filesystem.writeFile({ path: it.filename, data: base64, directory: Directory.Cache })
        const { uri } = await Filesystem.getUri({ path: it.filename, directory: Directory.Cache })
        uris.push(uri)
      }
    } catch {
      return 'failed'
    }
    // NOT: coklu dosya paylasiminda title/text GONDERILMEZ — bazi cihazlarda
    // (ozellikle WhatsApp hedefinde) metinle birlikte coklu gorsel tek gorsele
    // dusuyor ya da hic gitmiyor. Sadece files + dialogTitle en uyumlusu.
    try {
      await Share.share({ files: uris, dialogTitle: 'Diyetisyene gönder' })
      return 'shared'
    } catch (err) {
      if (isCancel(err)) return 'cancelled'
      // Yedek plan: coklu paylasim desteklenmiyorsa gorselleri TEK TEK paylas
      // (her biri icin paylasim menusu acilir; kullanici sirayla gonderir).
      try {
        for (const uri of uris) {
          try {
            await Share.share({ url: uri, dialogTitle: 'Diyetisyene gönder' })
          } catch (e2) {
            if (isCancel(e2)) return 'cancelled'
            throw e2
          }
        }
        return 'shared'
      } catch {
        return 'failed'
      }
    }
  }
  // Web: dosya dizisi paylasimi destekleniyorsa paylas, yoksa tek tek indir
  const files = items.map((it) => new File([it.blob], it.filename, { type: 'image/png' }))
  const nav = navigator as Navigator & {
    canShare?: (d: { files: File[] }) => boolean
    share?: (d: { files: File[]; title?: string }) => Promise<void>
  }
  if (typeof nav.share === 'function' && nav.canShare?.({ files })) {
    try {
      await nav.share({ files, title: 'Diyet Raporu' })
      return 'shared'
    } catch (err) {
      if (isCancel(err)) return 'cancelled'
    }
  }
  for (const it of items) downloadBlob(it.blob, it.filename)
  return 'copied'
}

// ---- Yedek (JSON) kaydet/paylas ----
export async function saveJsonSmart(json: string, filename: string): Promise<ShareResult> {
  if (isNative()) {
    try {
      const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
      const { Share } = await import('@capacitor/share')
      await Filesystem.writeFile({ path: filename, data: json, directory: Directory.Cache, encoding: Encoding.UTF8 })
      const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache })
      await Share.share({ title: 'Diyet Yedeği', url: uri, dialogTitle: 'Yedeği kaydet / gönder' })
      return 'shared'
    } catch (err) {
      return isCancel(err) ? 'cancelled' : 'failed'
    }
  }
  // Web: dosya olarak indir
  downloadBlob(new Blob([json], { type: 'application/json' }), filename)
  return 'copied'
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

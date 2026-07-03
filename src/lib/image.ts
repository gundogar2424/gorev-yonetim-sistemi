// Fotograf isleme: secilen resmi kucultup base64'e cevirir.
// Boylece veritabani sismez ve yedek dosyasi makul boyutta kalir.
export async function fileToResizedDataUrl(file: File, maxSize = 800, quality = 0.8): Promise<string> {
  const dataUrl = await readAsDataUrl(file)
  const img = await loadImage(dataUrl)

  let { width, height } = img
  if (width > height && width > maxSize) {
    height = Math.round((height * maxSize) / width)
    width = maxSize
  } else if (height > maxSize) {
    width = Math.round((width * maxSize) / height)
    height = maxSize
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl
  ctx.drawImage(img, 0, 0, width, height)
  return canvas.toDataURL('image/jpeg', quality)
}

// Bir URL'den (orn. Capacitor galeri webPath) resmi yukleyip kucultur.
// Yuklenemezse (orn. desteklenmeyen format) null doner.
export async function urlToResizedDataUrl(src: string, maxSize = 1400, quality = 0.8): Promise<string | null> {
  let img: HTMLImageElement
  try {
    img = await loadImage(src)
  } catch {
    return null
  }
  let { width, height } = img
  if (width > height && width > maxSize) {
    height = Math.round((height * maxSize) / width)
    width = maxSize
  } else if (height > maxSize) {
    width = Math.round((width * maxSize) / height)
    height = maxSize
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(img, 0, 0, width, height)
  return canvas.toDataURL('image/jpeg', quality)
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Resim okunamadi.'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Resim yuklenemedi.'))
    img.src = src
  })
}

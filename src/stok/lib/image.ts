// Fotoğrafı telefonda saklamadan önce küçültür (boyut/hız için).
// Dosyayı en fazla `max` piksele sığdırır, JPEG olarak data URL döner.
export async function fileToCompressedDataUrl(file: File, max = 1000, quality = 0.8): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('Dosya okunamadı'))
    r.readAsDataURL(file)
  })
  return compressDataUrl(dataUrl, max, quality)
}

export function compressDataUrl(dataUrl: string, max = 1000, quality = 0.8): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width > max || height > max) {
        const scale = max / Math.max(width, height)
        width = Math.round(width * scale)
        height = Math.round(height * scale)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(dataUrl)
        return
      }
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

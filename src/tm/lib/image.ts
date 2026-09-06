// Tarif fotografi: secilen gorseli kucultup data URI'ye cevirir.
//
// Neden kucultuyoruz: telefon fotograflari 3-5 MB olabiliyor; tarif
// veritabani (IndexedDB) icinde saklandigi ve yedege girdigi icin uzun kenari
// 1000 pikselde tutup JPEG'e ceviriyoruz (~100-200 KB).
export async function fotoOku(file: File, maxKenar = 1000, kalite = 0.82): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result))
    fr.onerror = () => reject(new Error('Fotoğraf okunamadı.'))
    fr.readAsDataURL(file)
  })
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = () => reject(new Error('Fotoğraf açılamadı.'))
    i.src = dataUrl
  })
  const oran = Math.min(1, maxKenar / Math.max(img.width, img.height))
  const w = Math.round(img.width * oran)
  const h = Math.round(img.height * oran)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl
  ctx.drawImage(img, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', kalite)
}

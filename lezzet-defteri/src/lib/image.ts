// Lezzet Defteri tarif fotografi (Termomiks'teki ile ayni yontem, ayri kopya): secilen gorseli kucultup data URI'ye cevirir.
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

// Kodla gelen fotograf bir https adresi olabilir (orn. video kapak gorseli).
// O hâlde internet yokken gorunmez. Bu islev gorseli BIR KEZ indirip cihazda
// saklanacak data URI'ye cevirir; sonrasinda tarif tamamen cevrimdisi calisir.
//
// Neden iki yol var: tarayicida uzak sunucular CORS yuzunden okunamaz. APK'da
// (Capacitor) istek yerel katmandan gider, CORS engeli yoktur. Once yerel yol
// denenir, olmazsa normal fetch; ikisi de olmazsa anlasilir bir hata doner.
export async function uzaktanFotoIndir(url: string): Promise<string> {
  if (!/^https:\/\//i.test(url)) throw new Error('Bu fotoğraf zaten cihazda saklı.')

  let dataUri = ''
  try {
    const { Capacitor, CapacitorHttp } = await import('@capacitor/core')
    if (Capacitor.isNativePlatform()) {
      const r = await CapacitorHttp.get({ url, responseType: 'blob' })
      const tip = (r.headers?.['Content-Type'] || r.headers?.['content-type'] || 'image/jpeg')
        .split(';')[0]
        .trim()
      if (typeof r.data === 'string' && r.data) dataUri = `data:${tip};base64,${r.data}`
    }
  } catch {
    /* yerel yol yok / basarisiz — asagida normal fetch denenir */
  }

  if (!dataUri) {
    try {
      const cevap = await fetch(url)
      if (!cevap.ok) throw new Error(String(cevap.status))
      const blob = await cevap.blob()
      dataUri = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader()
        fr.onload = () => resolve(String(fr.result))
        fr.onerror = () => reject(new Error('okunamadı'))
        fr.readAsDataURL(blob)
      })
    } catch {
      throw new Error(
        'Fotoğraf indirilemedi (bağlantı yok ya da adres kapalı). Fotoğrafı telefonuna kaydedip “Fotoğraf ekle” ile galeriden seçebilirsin.'
      )
    }
  }

  if (!dataUri.startsWith('data:image/')) throw new Error('Adresteki dosya bir fotoğraf değil.')
  return kucult(dataUri)
}

// Data URI'yi 1000 piksele kucultup JPEG'e cevirir (fotoOku ile ayni olcu).
async function kucult(dataUri: string, maxKenar = 1000, kalite = 0.82): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = () => reject(new Error('Fotoğraf açılamadı.'))
    i.src = dataUri
  })
  const oran = Math.min(1, maxKenar / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * oran)
  canvas.height = Math.round(img.height * oran)
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUri
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', kalite)
}

// Kayitli buyuk bir data URI fotografi kucultur (1000 px, JPEG 0.8). Kuculmezse aynisini dondurur.
export async function dataFotoSikistir(src: string, maxKenar = 1000, kalite = 0.8): Promise<string> {
  if (!src.startsWith('data:image')) return src
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = () => reject(new Error('açılamadı'))
    i.src = src
  })
  const oran = Math.min(1, maxKenar / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * oran)
  canvas.height = Math.round(img.height * oran)
  const ctx = canvas.getContext('2d')
  if (!ctx) return src
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  const yeni = canvas.toDataURL('image/jpeg', kalite)
  return yeni.length < src.length * 0.9 ? yeni : src
}

// Acilistan bir sure sonra arka planda: 300 KB'tan buyuk eski fotograflar sikistirilir (liste hizli acilsin).
// Bir kez calisir; her fotograf arasinda kisa mola (telefonu yormasin).
let sikistirildi = false
export async function buyukFotolariSikistir(): Promise<number> {
  if (sikistirildi) return 0
  sikistirildi = true
  const { lzDb } = await import('../db')
  const SINIR = 400_000 // data URI karakteri (~300 KB)
  let n = 0
  for (const r of await lzDb.recipes.toArray()) {
    if ((r.photo?.length ?? 0) <= SINIR) continue
    try {
      const yeni = await dataFotoSikistir(r.photo)
      if (yeni !== r.photo) {
        await lzDb.recipes.update(r.id!, { photo: yeni })
        n++
      }
    } catch {
      /* bozuk fotograf: dokunma */
    }
    await new Promise((x) => setTimeout(x, 200))
  }
  for (const m of await lzDb.mekanlar.toArray()) {
    if ((m.foto?.length ?? 0) <= SINIR) continue
    try {
      const yeni = await dataFotoSikistir(m.foto)
      if (yeni !== m.foto) {
        await lzDb.mekanlar.update(m.id!, { foto: yeni })
        n++
      }
    } catch {
      /* dokunma */
    }
    await new Promise((x) => setTimeout(x, 200))
  }
  return n
}

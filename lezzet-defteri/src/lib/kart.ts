// PAYLASIM KARTI: WhatsApp'ta dosyanin yaninda fotograf gibi gorunen kart resmi.
// Fotograf (varsa) ustte, altinda ad, kisa bilgiler ve "ekteki dosyayi ac" notu.
export interface KartBilgi {
  baslik: string
  alt: string // tur / semt ya da "Tarif"
  satirlar: string[]
  not: string // ek dosyada ne oldugu
  foto?: string // yalnizca data: adresi (uzak resim tuvali kirletir)
  tur: 'Tarif' | 'Mekan'
}

const W = 1080
const KIRMIZI = '#d93d20'

function satirBol(c: CanvasRenderingContext2D, metin: string, gen: number, enFazla: number): string[] {
  const kelimeler = metin.split(/\s+/)
  const sonuc: string[] = []
  let s = ''
  for (const k of kelimeler) {
    const d = s ? `${s} ${k}` : k
    if (c.measureText(d).width > gen && s) {
      sonuc.push(s)
      s = k
    } else s = d
  }
  if (s) sonuc.push(s)
  if (sonuc.length > enFazla) {
    const kes = sonuc.slice(0, enFazla)
    kes[enFazla - 1] = kes[enFazla - 1].replace(/\s*\S*$/, '') + '…'
    return kes
  }
  return sonuc
}

async function resimYukle(src: string): Promise<HTMLImageElement | null> {
  if (!src.startsWith('data:image/')) return null
  return new Promise((res) => {
    const i = new Image()
    i.onload = () => res(i)
    i.onerror = () => res(null)
    i.src = src
  })
}

// JPEG data URL dondurur
export async function kartResmi(b: KartBilgi): Promise<string> {
  const c = document.createElement('canvas').getContext('2d')!
  const yazi = "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
  const FH = 760
  const P = 64
  // Once yuksekligi hesapla
  c.font = `700 68px ${yazi}`
  const bas = satirBol(c, b.baslik, W - P * 2, 3)
  c.font = `500 40px ${yazi}`
  const sat = b.satirlar.filter(Boolean).flatMap((x) => satirBol(c, x, W - P * 2, 2)).slice(0, 7)
  const H = FH + 60 + bas.length * 80 + 60 + sat.length * 56 + 150
  const cv = c.canvas
  cv.width = W
  cv.height = H
  c.fillStyle = '#ffffff'
  c.fillRect(0, 0, W, H)
  // Fotograf: kirpilarak doldurulur; yoksa renkli zemin + bas harfler
  const img = b.foto ? await resimYukle(b.foto) : null
  if (img) {
    // Yalnizca ust alana kirpilir (dikey fotograf yazilarin ustune tasmasin)
    const o = Math.max(W / img.width, FH / img.height)
    const w = img.width * o
    const h = img.height * o
    c.save()
    c.beginPath()
    c.rect(0, 0, W, FH)
    c.clip()
    c.drawImage(img, (W - w) / 2, (FH - h) / 2, w, h)
    c.restore()
  } else {
    const g = c.createLinearGradient(0, 0, W, FH)
    g.addColorStop(0, '#ee4c2e')
    g.addColorStop(1, '#7a1e0e')
    c.fillStyle = g
    c.fillRect(0, 0, W, FH)
    c.fillStyle = 'rgba(255,255,255,.92)'
    c.font = `700 220px ${yazi}`
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    const harf = b.baslik
      .split(/\s+/)
      .filter((x) => /\p{L}/u.test(x))
      .slice(0, 2)
      .map((x) => x.match(/\p{L}/u)![0].toLocaleUpperCase('tr'))
      .join('')
    c.fillText(harf, W / 2, FH / 2)
    c.textAlign = 'left'
  }
  // Tur etiketi
  c.font = `700 36px ${yazi}`
  const et = b.tur.toLocaleUpperCase('tr')
  const ew = c.measureText(et).width + 48
  c.fillStyle = 'rgba(0,0,0,.6)'
  c.beginPath()
  c.roundRect(P, P - 16, ew, 64, 32)
  c.fill()
  c.fillStyle = '#fff'
  c.textBaseline = 'middle'
  c.fillText(et, P + 24, P + 16)
  // Metinler
  c.textBaseline = 'alphabetic'
  let y = FH + 60 + 60
  c.fillStyle = '#18181b'
  c.font = `700 68px ${yazi}`
  for (const s of bas) {
    c.fillText(s, P, y)
    y += 80
  }
  c.fillStyle = '#71717a'
  c.font = `500 40px ${yazi}`
  if (b.alt) {
    c.fillText(satirBol(c, b.alt, W - P * 2, 1)[0], P, y - 14)
    y += 46
  }
  c.fillStyle = '#3f3f46'
  for (const s of sat) {
    c.fillText(s, P, y + 10)
    y += 56
  }
  // Alt serit: ekteki dosya notu
  c.fillStyle = '#fff2ee'
  c.fillRect(0, H - 110, W, 110)
  c.fillStyle = KIRMIZI
  c.font = `600 36px ${yazi}`
  c.fillText(satirBol(c, b.not, W - P * 2, 1)[0], P, H - 44)
  return cv.toDataURL('image/jpeg', 0.86)
}

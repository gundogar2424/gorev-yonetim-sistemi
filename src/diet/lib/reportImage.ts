// Gunluk raporu GORSEL (PNG) olarak uretir: yemek fotograflari, basari
// yuzdesi/cubugu, olculer ve saglik verileri tek bir resimde. Diyetisyene
// resim olarak gonderilebilir. Token harcamaz; her sey cihazda cizilir.
import { dietDb } from '../db'
import { dayAdherence } from '../streak'
import { mealLabel, MEAL_OPTIONS } from './meals'
import type { DietEntry } from '../types'

const W = 820
const PAD = 32

function scoreColor(pct: number): string {
  return pct >= 80 ? '#059669' : pct >= 50 ? '#d97706' : '#e11d48'
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

function fillRound(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, color: string) {
  roundRectPath(ctx, x, y, w, h, r)
  ctx.fillStyle = color
  ctx.fill()
}

// Goruntuyu kareye "cover" sigdirir (kirparak)
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, size: number) {
  const ratio = Math.max(size / img.width, size / img.height)
  const w = img.width * ratio
  const h = img.height * ratio
  ctx.drawImage(img, x + (size - w) / 2, y + (size - h) / 2, w, h)
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text
  let t = text
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1)
  return t + '…'
}

// Kucuk renkli pill/chip cizer, genisligini dondurur
function drawChip(ctx: CanvasRenderingContext2D, x: number, yTop: number, text: string, bg: string, fg: string): number {
  ctx.font = 'bold 15px sans-serif'
  const w = ctx.measureText(text).width + 22
  fillRound(ctx, x, yTop, w, 26, 13, bg)
  ctx.fillStyle = fg
  ctx.fillText(text, x + 11, yTop + 18)
  return w
}

// Karar rozeti renkleri/etiketleri
const DEC_STYLE: Record<string, { t: string; bg: string; fg: string }> = {
  resisted: { t: '💪 Vazgeçti', bg: '#d1fae5', fg: '#065f46' },
  ate: { t: '😋 Yedi', bg: '#fef3c7', fg: '#92400e' },
  none: { t: '⏳ Karar yok', bg: '#f1f5f9', fg: '#64748b' }
}

// Metni verilen genislige gore satirlara boler (kelime bazli sarma)
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const test = line ? line + ' ' + w : w
    if (line && ctx.measureText(test).width > maxW) {
      lines.push(line)
      line = w
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

function measureLines(m: { weight?: number; waist?: number; navel?: number; fold?: number; hip?: number; chest?: number; arm?: number; leg?: number }): string {
  const p: string[] = []
  if (m.weight != null) p.push(`Kilo ${m.weight}kg`)
  if (m.arm != null) p.push(`Kol ${m.arm}cm`)
  if (m.chest != null) p.push(`Göğüs ${m.chest}cm`)
  if (m.fold != null) p.push(`Bel kıvrımı ${m.fold}cm`)
  if (m.navel != null) p.push(`Göbek deliği ${m.navel}cm`)
  if (m.hip != null) p.push(`Kalça ${m.hip}cm`)
  if (m.leg != null) p.push(`Bacak ${m.leg}cm`)
  return p.join(' · ')
}

// Bir gunun gorsel raporunu PNG Blob olarak uretir
export async function buildDailyImage(dateStr: string, userName?: string): Promise<Blob> {
  const [entries, measurements, vitals, exercises, waterRow] = await Promise.all([
    dietDb.entries.where('dateStr').equals(dateStr).toArray(),
    dietDb.measurements.where('dateStr').equals(dateStr).toArray(),
    dietDb.vitals.where('dateStr').equals(dateStr).toArray(),
    dietDb.exercises.where('dateStr').equals(dateStr).toArray(),
    dietDb.water.where('dateStr').equals(dateStr).first()
  ])
  const waterMl = waterRow ? (waterRow.ml != null ? waterRow.ml : (waterRow.glasses || 0) * 200) : 0
  exercises.sort((a, b) => a.createdAt - b.createdAt)
  entries.sort((a, b) => a.createdAt - b.createdAt)
  const photos = await Promise.all(entries.map((e) => (e.photo ? loadImage(e.photo) : Promise.resolve(null))))

  // Egzersiz metinlerini onceden satirlara bol (kesilmesin) + kart yuksekligi
  const EX_LINE = 27
  const mctx = document.createElement('canvas').getContext('2d')!
  mctx.font = '21px sans-serif'
  const exBlocks = exercises.map((ex) => {
    const meta = [ex.minutes ? `${ex.minutes} dk` : '', ex.kcal ? `~${ex.kcal} kcal` : ''].filter(Boolean).join(' · ')
    return { lines: wrapText(mctx, ex.text, W - 2 * PAD - 40), meta }
  })
  const exCardH = exBlocks.length
    ? 18 + exBlocks.reduce((s, b) => s + b.lines.length * EX_LINE + (b.meta ? 24 : 0) + 14, 0)
    : 0

  // Ogun kartlarini onceden hazirla: buyuk foto + adin satirlara bolunmesi
  const PHOTO = 122 // yemek fotografi (daha buyuk)
  const NAME_LH = 33 // yemek adi satir yuksekligi
  const nameMaxW = W - 2 * PAD - 56 - PHOTO
  const pairs = entries.map((e, i) => ({ e, img: photos[i] }))
  function buildMealCard(p: { e: DietEntry; img: HTMLImageElement | null }) {
    mctx.font = 'bold 26px sans-serif'
    let lines = wrapText(mctx, p.e.foodName, nameMaxW)
    if (lines.length > 2) lines = [lines[0], truncate(mctx, lines.slice(1).join(' '), nameMaxW)]
    const hasParts3 = p.e.compliancePercent >= 0 || !!p.e.satiety
    const textH = lines.length * NAME_LH + 34 + (hasParts3 ? 26 : 0)
    const cardH = 28 + Math.max(PHOTO, textH)
    return { ...p, lines, hasParts3, cardH }
  }
  const HEAD = 40
  const mealGroups = [...MEAL_OPTIONS.map((o) => o.value), undefined as undefined]
    .map((mt) => ({ mt, list: pairs.filter((p) => (p.e.mealType ?? undefined) === mt).map(buildMealCard) }))
    .filter((g) => g.list.length > 0)

  // Ozet seridi degerleri (kalori / su / spor)
  const kcalDay = entries.filter((e) => e.decision === 'ate').reduce((s, e) => s + (e.estimatedCalories || 0), 0)
  const exMin = exercises.reduce((s, e) => s + (e.minutes ?? 0), 0)

  // Yukseklik hesabi (cizimle ayni adimlar)
  const BANNER = 96
  let h = PAD + BANNER + 22 // baslik banneri
  h += 116 + 24 // basari blogu
  h += 78 + 18 // ozet seridi (kcal/su/spor)
  h += 40 // "Ogunler" basligi
  if (entries.length === 0) h += 44
  else for (const g of mealGroups) h += HEAD + g.list.reduce((s, c) => s + c.cardH + 14, 0)
  if (exercises.length) h += 44 + exCardH
  if (measurements.length) h += 48 + measurements.length * 30
  if (vitals.length) h += 48 + vitals.length * 30
  if (waterMl > 0) h += 44
  h += 50 // alt bilgi

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = Math.max(h, 480)
  const ctx = canvas.getContext('2d')!
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'

  // Arka plan
  ctx.fillStyle = '#f6f8fa'
  ctx.fillRect(0, 0, W, canvas.height)

  // Baslik banneri (yesil degrade)
  let y = PAD
  const grad = ctx.createLinearGradient(PAD, 0, W - PAD, 0)
  grad.addColorStop(0, '#059669')
  grad.addColorStop(1, '#34d399')
  roundRectPath(ctx, PAD, y, W - 2 * PAD, BANNER, 22)
  ctx.fillStyle = grad
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 32px sans-serif'
  ctx.fillText('🥗 Diyet Raporu', PAD + 26, y + 46)
  const dateNice = new Date(dateStr + 'T00:00:00').toLocaleDateString('tr-TR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
  ctx.font = '19px sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.fillText(dateNice + (userName ? ` · ${userName}` : ''), PAD + 26, y + 76)
  y += BANNER + 22

  // Basari blogu
  const pct = dayAdherence(entries, dateStr)
  fillRound(ctx, PAD, y, W - 2 * PAD, 116, 18, '#ffffff')
  ctx.fillStyle = '#64748b'
  ctx.font = 'bold 20px sans-serif'
  ctx.fillText('GÜNLÜK DİYET BAŞARISI', PAD + 26, y + 38)
  if (pct != null) {
    ctx.fillStyle = scoreColor(pct)
    ctx.font = 'bold 42px sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(`%${pct}`, W - PAD - 26, y + 46)
    ctx.textAlign = 'left'
    const bx = PAD + 26
    const by = y + 68
    const bw = W - 2 * PAD - 52
    fillRound(ctx, bx, by, bw, 20, 10, '#e2e8f0')
    fillRound(ctx, bx, by, (bw * pct) / 100, 20, 10, scoreColor(pct))
  } else {
    ctx.fillStyle = '#94a3b8'
    ctx.font = '22px sans-serif'
    ctx.fillText('Bu güne ait karar verilmiş öğün yok.', PAD + 26, y + 74)
  }
  y += 116 + 24

  // Ozet seridi: 3 kucuk istatistik kutusu (kalori / su / spor)
  {
    const tiles = [
      { label: 'ALINAN KALORİ', value: `${kcalDay}`, unit: 'kcal', color: '#ea580c' },
      { label: 'SU', value: waterMl > 0 ? `${waterMl}` : '—', unit: waterMl > 0 ? 'ml' : '', color: '#0284c7' },
      { label: 'SPOR', value: exercises.length ? (exMin > 0 ? `${exMin}` : `${exercises.length}`) : '—', unit: exercises.length ? (exMin > 0 ? 'dk' : 'adet') : '', color: '#7c3aed' }
    ]
    const gap = 14
    const tw = (W - 2 * PAD - gap * 2) / 3
    tiles.forEach((tl, i) => {
      const tx = PAD + i * (tw + gap)
      fillRound(ctx, tx, y, tw, 78, 16, '#ffffff')
      ctx.fillStyle = '#94a3b8'
      ctx.font = 'bold 13px sans-serif'
      ctx.fillText(tl.label, tx + 16, y + 26)
      ctx.fillStyle = tl.color
      ctx.font = 'bold 30px sans-serif'
      const vw = ctx.measureText(tl.value).width
      ctx.fillText(tl.value, tx + 16, y + 60)
      if (tl.unit) {
        ctx.font = 'bold 15px sans-serif'
        ctx.fillStyle = '#94a3b8'
        ctx.fillText(tl.unit, tx + 16 + vw + 6, y + 60)
      }
    })
    y += 78 + 18
  }

  // Ogunler
  ctx.fillStyle = '#0f172a'
  ctx.font = 'bold 26px sans-serif'
  ctx.fillText('🍽️ Öğünler', PAD, y + 6)
  y += 40

  if (entries.length === 0) {
    ctx.fillStyle = '#94a3b8'
    ctx.font = '20px sans-serif'
    ctx.fillText('Bugün öğün kaydı yok.', PAD, y + 8)
    y += 44
  } else {
    for (const g of mealGroups) {
      // Ogun basligi
      ctx.fillStyle = '#0f766e'
      ctx.font = 'bold 22px sans-serif'
      ctx.fillText('▸ ' + (g.mt ? mealLabel(g.mt) : 'Diğer'), PAD + 2, y + 22)
      y += HEAD
      for (const card of g.list) {
        const { e, img, lines, hasParts3, cardH } = card
        fillRound(ctx, PAD, y, W - 2 * PAD, cardH, 18, '#ffffff')
        const ix = PAD + 16
        const iy = y + 16
        if (img) {
          ctx.save()
          roundRectPath(ctx, ix, iy, PHOTO, PHOTO, 14)
          ctx.clip()
          drawCover(ctx, img, ix, iy, PHOTO)
          ctx.restore()
        } else {
          fillRound(ctx, ix, iy, PHOTO, PHOTO, 14, '#eef2f6')
          ctx.fillStyle = '#cbd5e1'
          ctx.font = '46px sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText('🍽️', ix + PHOTO / 2, iy + PHOTO / 2 + 16)
          ctx.textAlign = 'left'
        }
        const tx = ix + PHOTO + 20
        // Yemek adi (1-2 satir, kesilmez)
        ctx.fillStyle = '#0f172a'
        ctx.font = 'bold 26px sans-serif'
        let ty = y + 42
        for (const ln of lines) {
          ctx.fillText(ln, tx, ty)
          ty += NAME_LH
        }
        // Saat · kalori + karar rozeti
        ctx.fillStyle = '#64748b'
        ctx.font = '19px sans-serif'
        const t = new Date(e.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
        const meta = `${t}  ·  ~${e.estimatedCalories} kcal`
        ctx.fillText(meta, tx, ty + 4)
        const d = DEC_STYLE[e.decision] ?? DEC_STYLE.none
        drawChip(ctx, tx + ctx.measureText(meta).width + 14, ty - 14, d.t, d.bg, d.fg)
        ty += 32
        // Uyum / tokluk
        if (hasParts3) {
          const parts3: string[] = []
          if (e.compliancePercent >= 0) parts3.push(`✓ Uyum %${e.compliancePercent}`)
          if (e.satiety) parts3.push(`🍽️ Tokluk ${e.satiety}/10`)
          ctx.fillStyle = '#475569'
          ctx.font = '18px sans-serif'
          ctx.fillText(parts3.join('   ·   '), tx, ty + 2)
        }
        y += cardH + 14
      }
    }
  }

  // Egzersiz (beyaz kartta, uzun metin satirlara bolunur)
  if (exercises.length) {
    y += 8
    ctx.fillStyle = '#0f172a'
    ctx.font = 'bold 24px sans-serif'
    ctx.fillText('🏃 Egzersiz', PAD, y)
    y += 16
    fillRound(ctx, PAD, y, W - 2 * PAD, exCardH, 16, '#ffffff')
    let ry = y + 18
    for (const b of exBlocks) {
      ctx.fillStyle = '#334155'
      ctx.font = '21px sans-serif'
      for (const ln of b.lines) {
        ctx.fillText(ln, PAD + 20, ry + 20)
        ry += EX_LINE
      }
      if (b.meta) {
        ctx.fillStyle = '#0f766e'
        ctx.font = 'bold 17px sans-serif'
        ctx.fillText('⏱ ' + b.meta, PAD + 20, ry + 18)
        ry += 24
      }
      ry += 14
    }
    y += exCardH + 8
  }

  // Olculer
  if (measurements.length) {
    y += 8
    ctx.fillStyle = '#0f172a'
    ctx.font = 'bold 24px sans-serif'
    ctx.fillText('📏 Ölçüler & Kilo', PAD, y)
    y += 8
    ctx.fillStyle = '#334155'
    ctx.font = '20px sans-serif'
    for (const m of measurements) {
      y += 30
      ctx.fillText(truncate(ctx, '• ' + (measureLines(m) || '—'), W - 2 * PAD), PAD + 6, y)
    }
    y += 6
  }

  // Saglik
  if (vitals.length) {
    y += 8
    ctx.fillStyle = '#0f172a'
    ctx.font = 'bold 24px sans-serif'
    ctx.fillText('🩺 Şeker / Tansiyon', PAD, y)
    y += 8
    ctx.fillStyle = '#334155'
    ctx.font = '20px sans-serif'
    for (const v of vitals) {
      y += 30
      const line =
        v.kind === 'seker'
          ? `• ${v.time} — Şeker ${v.sugar} mg/dL${v.sugarContext ? ` (${v.sugarContext})` : ''}`
          : `• ${v.time} — Tansiyon ${v.systolic}/${v.diastolic}${v.pulse ? `, nabız ${v.pulse}` : ''}`
      ctx.fillText(line, PAD + 6, y)
    }
    y += 6
  }

  // Su
  if (waterMl > 0) {
    y += 8
    ctx.fillStyle = '#0f172a'
    ctx.font = 'bold 24px sans-serif'
    ctx.fillText('💧 Su', PAD, y)
    y += 8
    ctx.fillStyle = '#0284c7'
    ctx.font = 'bold 20px sans-serif'
    y += 30
    ctx.fillText(`${waterMl} ml`, PAD + 6, y)
    y += 6
  }

  // Alt bilgi
  ctx.fillStyle = '#94a3b8'
  ctx.font = '18px sans-serif'
  ctx.fillText('Diyet Koçu uygulamasından gönderildi', PAD, canvas.height - 22)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Görsel oluşturulamadı'))), 'image/png')
  })
}

// Tek uzun gorsel yerine, WhatsApp'a AYRI AYRI gonderilecek gorsel SETI uretir:
// her ogun turu icin bir gorsel (buyuk foto + buyuk yazi) + spor/saglik icin bir gorsel.
export async function buildDailyImageSet(dateStr: string, userName?: string): Promise<{ filename: string; blob: Blob }[]> {
  const [entries, measurements, vitals, exercises, waterRow] = await Promise.all([
    dietDb.entries.where('dateStr').equals(dateStr).toArray(),
    dietDb.measurements.where('dateStr').equals(dateStr).toArray(),
    dietDb.vitals.where('dateStr').equals(dateStr).toArray(),
    dietDb.exercises.where('dateStr').equals(dateStr).toArray(),
    dietDb.water.where('dateStr').equals(dateStr).first()
  ])
  const waterMl = waterRow ? (waterRow.ml != null ? waterRow.ml : (waterRow.glasses || 0) * 200) : 0
  entries.sort((a, b) => a.createdAt - b.createdAt)
  exercises.sort((a, b) => a.createdAt - b.createdAt)
  const photos = await Promise.all(entries.map((e) => (e.photo ? loadImage(e.photo) : Promise.resolve(null))))

  const dateNice = new Date(dateStr + 'T00:00:00').toLocaleDateString('tr-TR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
  const subtitle = dateNice + (userName ? ` · ${userName}` : '')
  const mctx = document.createElement('canvas').getContext('2d')!
  const out: { filename: string; blob: Blob }[] = []

  const PHOTO = 200
  const NAME_PX = 30
  const NAME_LH = 40
  const nameMaxW = W - 2 * PAD - 60 - PHOTO

  const toBlob = (canvas: HTMLCanvasElement) =>
    new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Görsel oluşturulamadı'))), 'image/png'))

  // Yesil baslikli bos bir tuval hazirlar; icerik alanini y ile dondurur
  function makeCanvas(title: string, contentH: number) {
    const BANNER = 88
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = Math.max(PAD + BANNER + 22 + contentH + 46, 340)
    const ctx = canvas.getContext('2d')!
    ctx.textBaseline = 'alphabetic'
    ctx.textAlign = 'left'
    ctx.fillStyle = '#f6f8fa'
    ctx.fillRect(0, 0, W, canvas.height)
    const grad = ctx.createLinearGradient(PAD, 0, W - PAD, 0)
    grad.addColorStop(0, '#059669')
    grad.addColorStop(1, '#34d399')
    roundRectPath(ctx, PAD, PAD, W - 2 * PAD, BANNER, 22)
    ctx.fillStyle = grad
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 30px sans-serif'
    ctx.fillText(title, PAD + 26, PAD + 42)
    ctx.font = '18px sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    ctx.fillText(subtitle, PAD + 26, PAD + 70)
    return { ctx, canvas, y: PAD + BANNER + 22 }
  }

  // Ogun kartini buyuk cizer
  function drawBigCard(ctx: CanvasRenderingContext2D, card: { e: DietEntry; img: HTMLImageElement | null; lines: string[]; hasParts3: boolean; cardH: number }, y: number) {
    fillRound(ctx, PAD, y, W - 2 * PAD, card.cardH, 20, '#ffffff')
    const ix = PAD + 18
    const iy = y + 18
    if (card.img) {
      ctx.save()
      roundRectPath(ctx, ix, iy, PHOTO, PHOTO, 16)
      ctx.clip()
      drawCover(ctx, card.img, ix, iy, PHOTO)
      ctx.restore()
    } else {
      fillRound(ctx, ix, iy, PHOTO, PHOTO, 16, '#eef2f6')
      ctx.fillStyle = '#cbd5e1'
      ctx.font = '64px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('🍽️', ix + PHOTO / 2, iy + PHOTO / 2 + 22)
      ctx.textAlign = 'left'
    }
    const tx = ix + PHOTO + 24
    ctx.fillStyle = '#0f172a'
    ctx.font = `bold ${NAME_PX}px sans-serif`
    let ty = y + 50
    for (const ln of card.lines) {
      ctx.fillText(ln, tx, ty)
      ty += NAME_LH
    }
    ctx.fillStyle = '#64748b'
    ctx.font = '20px sans-serif'
    const t = new Date(card.e.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    const meta = `${t}  ·  ~${card.e.estimatedCalories} kcal`
    ctx.fillText(meta, tx, ty + 8)
    const d = DEC_STYLE[card.e.decision] ?? DEC_STYLE.none
    drawChip(ctx, tx + ctx.measureText(meta).width + 16, ty - 10, d.t, d.bg, d.fg)
    ty += 36
    if (card.hasParts3) {
      const p3: string[] = []
      if (card.e.compliancePercent >= 0) p3.push(`✓ Uyum %${card.e.compliancePercent}`)
      if (card.e.satiety) p3.push(`🍽️ Tokluk ${card.e.satiety}/10`)
      ctx.fillStyle = '#475569'
      ctx.font = '19px sans-serif'
      ctx.fillText(p3.join('   ·   '), tx, ty + 4)
    }
  }

  // Ogun kartini olcup hazirla (satirlar + yukseklik)
  function prep(p: { e: DietEntry; img: HTMLImageElement | null }) {
    mctx.font = `bold ${NAME_PX}px sans-serif`
    let lines = wrapText(mctx, p.e.foodName, nameMaxW)
    if (lines.length > 3) lines = [lines[0], lines[1], truncate(mctx, lines.slice(2).join(' '), nameMaxW)]
    const hasParts3 = p.e.compliancePercent >= 0 || !!p.e.satiety
    const textH = lines.length * NAME_LH + 46 + (hasParts3 ? 32 : 0)
    const cardH = 32 + Math.max(PHOTO, textH)
    return { ...p, lines, hasParts3, cardH }
  }

  // Ogunler: her ogun turu icin bir gorsel
  const pairs = entries.map((e, i) => ({ e, img: photos[i] }))
  const mealGroups = [...MEAL_OPTIONS.map((o) => o.value), undefined as undefined]
    .map((mt) => ({ mt, list: pairs.filter((p) => (p.e.mealType ?? undefined) === mt).map(prep) }))
    .filter((g) => g.list.length > 0)

  let idx = 1
  for (const g of mealGroups) {
    const contentH = g.list.reduce((s, c) => s + c.cardH + 16, 0)
    const title = '🍽️ ' + (g.mt ? mealLabel(g.mt) : 'Diğer')
    const { ctx, canvas, y: y0 } = makeCanvas(title, contentH)
    let y = y0
    for (const card of g.list) {
      drawBigCard(ctx, card, y)
      y += card.cardH + 16
    }
    ctx.fillStyle = '#94a3b8'
    ctx.font = '16px sans-serif'
    ctx.fillText('Diyet Koçu uygulamasından gönderildi', PAD, canvas.height - 20)
    out.push({ filename: `diyet-${dateStr}-${idx++}-ogun.png`, blob: await toBlob(canvas) })
  }

  // Spor & Saglik: tek bir gorsel — her bolum kendi beyaz kartinda, ferah ve
  // buyuk yazili; seker olcumlerinde aclik/tok net renkli rozetle.
  if (exercises.length || vitals.length || measurements.length || waterMl > 0) {
    const EXLINE = 34 // egzersiz satir yuksekligi
    const ROW = 50 // vital/olcu satir yuksekligi (ferah)
    const CPAD = 22 // kart ic bosluğu
    const TITLE_H = 48 // bolum basligi + bosluk
    mctx.font = '24px sans-serif'
    const exB = exercises.map((ex) => {
      const meta = [ex.minutes ? `${ex.minutes} dk` : '', ex.kcal ? `~${ex.kcal} kcal` : ''].filter(Boolean).join(' · ')
      return { lines: wrapText(mctx, ex.text, W - 2 * PAD - 2 * CPAD), meta }
    })
    const exCardH = exB.length ? CPAD * 2 + exB.reduce((s, b) => s + b.lines.length * EXLINE + (b.meta ? 34 : 0) + 16, 0) : 0
    const exH = exB.length ? TITLE_H + exCardH + 22 : 0
    const vitH = vitals.length ? TITLE_H + CPAD * 2 + vitals.length * ROW + 22 : 0
    const meaH = measurements.length ? TITLE_H + CPAD * 2 + measurements.length * ROW + 22 : 0
    const watH = waterMl > 0 ? TITLE_H + 86 + 22 : 0
    const contentH = exH + vitH + meaH + watH + 10

    const { ctx, canvas, y: y0 } = makeCanvas('🏃 Spor & 🩺 Sağlık', contentH)
    let y = y0

    const drawTitle = (t: string) => {
      ctx.fillStyle = '#0f172a'
      ctx.font = 'bold 27px sans-serif'
      ctx.fillText(t, PAD, y + 28)
      y += TITLE_H
    }

    if (exB.length) {
      drawTitle('🏃 Egzersiz')
      fillRound(ctx, PAD, y, W - 2 * PAD, exCardH, 18, '#ffffff')
      let ry = y + CPAD
      for (const b of exB) {
        ctx.fillStyle = '#334155'
        ctx.font = '24px sans-serif'
        for (const ln of b.lines) {
          ctx.fillText(ln, PAD + CPAD, ry + 26)
          ry += EXLINE
        }
        if (b.meta) {
          ctx.fillStyle = '#0f766e'
          ctx.font = 'bold 20px sans-serif'
          ctx.fillText('⏱ ' + b.meta, PAD + CPAD, ry + 24)
          ry += 34
        }
        ry += 16
      }
      y += exCardH + 22
    }

    if (vitals.length) {
      drawTitle('🩺 Şeker / Tansiyon')
      const cardH = CPAD * 2 + vitals.length * ROW
      fillRound(ctx, PAD, y, W - 2 * PAD, cardH, 18, '#ffffff')
      let ry = y + CPAD
      for (const v of vitals) {
        const baseY = ry + 33
        ctx.fillStyle = '#0f172a'
        ctx.font = 'bold 25px sans-serif'
        if (v.kind === 'seker') {
          const txt = `${v.time}  ·  Şeker ${v.sugar} mg/dL`
          ctx.fillText(txt, PAD + CPAD, baseY)
          if (v.sugarContext) {
            const isTok = v.sugarContext.toLowerCase().startsWith('tok')
            const cw = ctx.measureText(txt).width
            drawChip(
              ctx,
              PAD + CPAD + cw + 16,
              baseY - 21,
              isTok ? '🍽️ Tok' : '🕐 Açlık',
              isTok ? '#e0f2fe' : '#fef3c7',
              isTok ? '#075985' : '#92400e'
            )
          }
        } else {
          ctx.fillText(`${v.time}  ·  Tansiyon ${v.systolic}/${v.diastolic}${v.pulse ? `  · nabız ${v.pulse}` : ''}`, PAD + CPAD, baseY)
        }
        ry += ROW
      }
      y += cardH + 22
    }

    if (measurements.length) {
      drawTitle('📏 Ölçüler & Kilo')
      const cardH = CPAD * 2 + measurements.length * ROW
      fillRound(ctx, PAD, y, W - 2 * PAD, cardH, 18, '#ffffff')
      let ry = y + CPAD
      for (const m of measurements) {
        ctx.fillStyle = '#334155'
        ctx.font = '24px sans-serif'
        ctx.fillText(truncate(ctx, measureLines(m) || '—', W - 2 * PAD - 2 * CPAD), PAD + CPAD, ry + 33)
        ry += ROW
      }
      y += cardH + 22
    }

    if (waterMl > 0) {
      drawTitle('💧 Su')
      fillRound(ctx, PAD, y, W - 2 * PAD, 86, 18, '#ffffff')
      ctx.fillStyle = '#0284c7'
      ctx.font = 'bold 40px sans-serif'
      ctx.fillText(`${waterMl} ml`, PAD + CPAD, y + 56)
      y += 86 + 22
    }

    ctx.fillStyle = '#94a3b8'
    ctx.font = '16px sans-serif'
    ctx.fillText('Diyet Koçu uygulamasından gönderildi', PAD, canvas.height - 20)
    out.push({ filename: `diyet-${dateStr}-${idx++}-spor-saglik.png`, blob: await toBlob(canvas) })
  }

  return out
}

// ---- TEK ÖĞÜN görseli: sadece bir yemeğin fotoğrafı + detayları ----
// Diyetisyene o öğünü tek tek göndermek için. Token harcamaz.
export async function buildMealImage(e: DietEntry, userName?: string): Promise<Blob> {
  const img = e.photo ? await loadImage(e.photo) : null

  const mctx = document.createElement('canvas').getContext('2d')!
  const contentW = W - 2 * PAD
  const innerW = contentW - 60 // beyaz kart ic genisligi (2*28 padding + tampon)

  // Diyetisyene tekli gonderimde SADE tut: yalnizca urunun aciklamasi (+varsa
  // gramaji). Kalori/uyum/puan/degerlendirme YOK — diyetisyenin isine karisma.
  // Yazilar BUYUK ve okunakli olsun.
  mctx.font = 'bold 48px sans-serif'
  const nameLines = wrapText(mctx, e.foodName || 'Öğün', innerW)

  const BANNER = 100
  const PHOTO_H = img ? 580 : 220
  const NAME_LH = 60

  // Bilgi kart yuksekligi: sadece ad satirlari + pad
  const infoH = 34 + nameLines.length * NAME_LH + 24

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = PAD + BANNER + 20 + PHOTO_H + 18 + infoH + 46
  const ctx = canvas.getContext('2d')!
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  ctx.fillStyle = '#f6f8fa'
  ctx.fillRect(0, 0, W, canvas.height)

  // Banner
  let y = PAD
  const grad = ctx.createLinearGradient(PAD, 0, W - PAD, 0)
  grad.addColorStop(0, '#059669')
  grad.addColorStop(1, '#34d399')
  roundRectPath(ctx, PAD, y, contentW, BANNER, 22)
  ctx.fillStyle = grad
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 36px sans-serif'
  const mealTitle = (e.mealType ? mealLabel(e.mealType) : 'Öğün')
  ctx.fillText(`🍽️ ${mealTitle}`, PAD + 28, y + 50)
  const t = new Date(e.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  const dateNice = new Date(e.dateStr + 'T00:00:00').toLocaleDateString('tr-TR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  })
  ctx.font = '22px sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.fillText(`${dateNice} · ${t}${userName ? ` · ${userName}` : ''}`, PAD + 28, y + 84)
  y += BANNER + 22

  // Fotograf (genis, kirparak sigdir)
  if (img) {
    ctx.save()
    roundRectPath(ctx, PAD, y, contentW, PHOTO_H, 20)
    ctx.clip()
    const ratio = Math.max(contentW / img.width, PHOTO_H / img.height)
    const iw = img.width * ratio
    const ih = img.height * ratio
    ctx.drawImage(img, PAD + (contentW - iw) / 2, y + (PHOTO_H - ih) / 2, iw, ih)
    ctx.restore()
  } else {
    fillRound(ctx, PAD, y, contentW, PHOTO_H, 20, '#eef2f6')
    ctx.fillStyle = '#cbd5e1'
    ctx.font = '72px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('🍽️', W / 2, y + PHOTO_H / 2 + 24)
    ctx.textAlign = 'left'
  }
  y += PHOTO_H + 18

  // Bilgi karti: yalnizca urunun aciklamasi (+varsa gramaji) — BUYUK yazi
  fillRound(ctx, PAD, y, contentW, infoH, 20, '#ffffff')
  const cx = PAD + 28
  let cy = y + 34
  ctx.fillStyle = '#0f172a'
  ctx.font = 'bold 48px sans-serif'
  for (const ln of nameLines) {
    cy += NAME_LH - 10
    ctx.fillText(ln, cx, cy)
    cy += 10
  }

  // Alt bilgi
  ctx.fillStyle = '#94a3b8'
  ctx.font = '20px sans-serif'
  ctx.fillText('Diyet Koçu uygulamasından gönderildi', PAD, canvas.height - 24)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Görsel oluşturulamadı'))), 'image/png')
  })
}

// ---- Ölçüm GÖRSEL raporu (kilo grafiği + ölçü değişimi + şeker/tansiyon) ----
const MEASURE_FIELDS_IMG: { key: 'weight' | 'navel' | 'fold' | 'hip' | 'chest' | 'arm' | 'leg'; label: string; unit: string; color: string }[] = [
  { key: 'weight', label: 'Kilo', unit: 'kg', color: '#059669' },
  { key: 'arm', label: 'Kol', unit: 'cm', color: '#14b8a6' },
  { key: 'chest', label: 'Göğüs', unit: 'cm', color: '#ec4899' },
  { key: 'fold', label: 'Bel kıvrımı', unit: 'cm', color: '#ef4444' },
  { key: 'navel', label: 'Göbek deliği', unit: 'cm', color: '#f59e0b' },
  { key: 'hip', label: 'Kalça', unit: 'cm', color: '#8b5cf6' },
  { key: 'leg', label: 'Bacak', unit: 'cm', color: '#64748b' }
]

function imgInLastDays(dateStr: string, days: number): boolean {
  if (!days) return true
  return new Date(dateStr + 'T00:00:00').getTime() >= Date.now() - days * 86_400_000
}

// Basit cizgi grafigi (eksen etiketi yok; uclarda deger yazilir)
function drawLine(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  vals: number[],
  color: string
) {
  if (vals.length === 0) return
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const pad = (max - min) * 0.2 || Math.max(1, Math.abs(max) * 0.05)
  const lo = min - pad
  const span = max + pad - lo || 1
  const px = (i: number) => (vals.length === 1 ? x + w / 2 : x + (w * i) / (vals.length - 1))
  const py = (v: number) => y + h - ((v - lo) / span) * h
  // taban cizgisi
  ctx.strokeStyle = '#e2e8f0'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x, y + h)
  ctx.lineTo(x + w, y + h)
  ctx.stroke()
  // cizgi
  ctx.strokeStyle = color
  ctx.lineWidth = 3
  ctx.beginPath()
  vals.forEach((v, i) => (i === 0 ? ctx.moveTo(px(i), py(v)) : ctx.lineTo(px(i), py(v))))
  ctx.stroke()
  // noktalar
  ctx.fillStyle = color
  vals.forEach((v, i) => {
    ctx.beginPath()
    ctx.arc(px(i), py(v), 4, 0, Math.PI * 2)
    ctx.fill()
  })
}

export async function buildMeasurementsImage(days: number, userName?: string): Promise<Blob> {
  const [measAll, vitAll] = await Promise.all([
    dietDb.measurements.orderBy('createdAt').toArray(),
    dietDb.vitals.orderBy('createdAt').toArray()
  ])
  const meas = measAll.filter((m) => imgInLastDays(m.dateStr, days))
  const vit = vitAll.filter((v) => imgInLastDays(v.dateStr, days))

  // Her metrik icin zaman serisi (kronolojik) hazirla
  const metricRows = MEASURE_FIELDS_IMG.map((f) => ({
    f,
    vals: meas.filter((m) => typeof m[f.key] === 'number').map((m) => m[f.key] as number)
  })).filter((r) => r.vals.length > 0)
  const sugars = vit.filter((v) => v.kind === 'seker' && typeof v.sugar === 'number')
  const bps = vit.filter((v) => v.kind === 'tansiyon' && typeof v.systolic === 'number')
  const recentVit = [...vit].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8).reverse()

  const ROW_H = 138 // her olcu icin kart yuksekligi (yaninda grafikle)
  const ROW_GAP = 14
  // Yukseklik hesabi
  let h = PAD + 36 + 40 + 28 + 16 // baslik + tarih
  if (metricRows.length) h += 44 + metricRows.length * (ROW_H + ROW_GAP)
  if (vit.length) {
    const avgLines = (sugars.length ? 1 : 0) + (bps.length ? 1 : 0)
    h += 56 + avgLines * 34 + recentVit.length * 30 + 20
  }
  if (!metricRows.length && !vit.length) h += 60
  h += 50

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = Math.max(h, 420)
  const ctx = canvas.getContext('2d')!
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  ctx.fillStyle = '#f1f5f9'
  ctx.fillRect(0, 0, W, canvas.height)

  let y = PAD + 36
  ctx.fillStyle = '#0f172a'
  ctx.font = 'bold 38px sans-serif'
  ctx.fillText('📐 Ölçüm Raporu', PAD, y)
  y += 40
  ctx.fillStyle = '#475569'
  ctx.font = '22px sans-serif'
  ctx.fillText(`${days ? `Son ${days} gün` : 'Tüm zamanlar'}${userName ? ` · ${userName}` : ''}`, PAD, y)
  y += 28 + 16

  const cardW = W - 2 * PAD

  // Ölçüler & Kilo — her ölçü kendi kartinda, yaninda grafigiyle
  if (metricRows.length) {
    ctx.fillStyle = '#0f172a'
    ctx.font = 'bold 24px sans-serif'
    ctx.fillText('📏 Ölçüler & Kilo', PAD, y + 24)
    y += 44

    const LEFT_W = 290 // sol bilgi sutunu genisligi
    for (const { f, vals } of metricRows) {
      fillRound(ctx, PAD, y, cardW, ROW_H, 16, '#ffffff')
      const first = vals[0]
      const last = vals[vals.length - 1]
      // Sol: ad + son deger + degisim
      ctx.textAlign = 'left'
      ctx.fillStyle = f.color
      ctx.font = 'bold 23px sans-serif'
      ctx.fillText(f.label, PAD + 24, y + 42)
      ctx.fillStyle = '#0f172a'
      ctx.font = 'bold 34px sans-serif'
      ctx.fillText(`${last}${f.unit}`, PAD + 24, y + 86)
      if (vals.length >= 2) {
        const diff = Math.round((last - first) * 10) / 10
        const arrow = diff === 0 ? '→' : diff < 0 ? '↓' : '↑'
        ctx.fillStyle = diff <= 0 ? '#059669' : '#e11d48'
        ctx.font = 'bold 18px sans-serif'
        ctx.fillText(`${first} ${arrow} ${last}  (${diff > 0 ? '+' : ''}${diff}${f.unit})`, PAD + 24, y + 116)
      } else {
        ctx.fillStyle = '#94a3b8'
        ctx.font = '17px sans-serif'
        ctx.fillText('tek ölçüm', PAD + 24, y + 116)
      }
      // Sag: o ölçünün zaman içindeki grafigi
      const chartX = PAD + LEFT_W
      const chartW = cardW - LEFT_W - 28
      drawLine(ctx, chartX, y + 26, chartW, ROW_H - 52, vals, f.color)
      // grafik baslangic/bitis degerleri (kucuk)
      ctx.fillStyle = '#94a3b8'
      ctx.font = '14px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(`${first}`, chartX, y + ROW_H - 12)
      ctx.textAlign = 'right'
      ctx.fillText(`${last}`, chartX + chartW, y + ROW_H - 12)
      ctx.textAlign = 'left'
      y += ROW_H + ROW_GAP
    }
  }

  // Şeker / tansiyon
  if (vit.length) {
    const avgLines = (sugars.length ? 1 : 0) + (bps.length ? 1 : 0)
    const cardH = 56 + avgLines * 34 + recentVit.length * 30
    fillRound(ctx, PAD, y, cardW, cardH, 16, '#ffffff')
    ctx.fillStyle = '#0f172a'
    ctx.font = 'bold 22px sans-serif'
    ctx.fillText('🩺 Şeker / Tansiyon', PAD + 24, y + 38)
    let ry = y + 56
    if (sugars.length) {
      const avg = Math.round(sugars.reduce((s, v) => s + (v.sugar || 0), 0) / sugars.length)
      ctx.fillStyle = '#e11d48'
      ctx.font = 'bold 20px sans-serif'
      ctx.fillText(`Şeker ort. ${avg} mg/dL (${sugars.length} ölçüm)`, PAD + 24, ry + 22)
      ry += 34
    }
    if (bps.length) {
      const as = Math.round(bps.reduce((s, v) => s + (v.systolic || 0), 0) / bps.length)
      const ad = Math.round(bps.reduce((s, v) => s + (v.diastolic || 0), 0) / bps.length)
      ctx.fillStyle = '#0ea5e9'
      ctx.font = 'bold 20px sans-serif'
      ctx.fillText(`Tansiyon ort. ${as}/${ad} (${bps.length} ölçüm)`, PAD + 24, ry + 22)
      ry += 34
    }
    ctx.fillStyle = '#475569'
    ctx.font = '18px sans-serif'
    for (const v of recentVit) {
      const line =
        v.kind === 'seker'
          ? `${v.dateStr} ${v.time} — Şeker ${v.sugar} mg/dL${v.sugarContext ? ` (${v.sugarContext})` : ''}`
          : `${v.dateStr} ${v.time} — Tansiyon ${v.systolic}/${v.diastolic}${v.pulse ? `, nabız ${v.pulse}` : ''}`
      ctx.fillText(truncate(ctx, '• ' + line, cardW - 48), PAD + 24, ry + 20)
      ry += 30
    }
    y += cardH + 20
  }

  if (!metricRows.length && !vit.length) {
    ctx.fillStyle = '#94a3b8'
    ctx.font = '20px sans-serif'
    ctx.fillText('Bu aralıkta ölçüm kaydı yok.', PAD, y + 8)
  }

  ctx.fillStyle = '#94a3b8'
  ctx.font = '18px sans-serif'
  ctx.fillText('Diyet Koçu uygulamasından gönderildi', PAD, canvas.height - 22)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Görsel oluşturulamadı'))), 'image/png')
  })
}

// SON ÖLÇÜLER — temiz, okunakli tek gorsel: kilo dahil her olcunun en guncel
// degeri, tarihi ve bir onceki degere gore degisimi (renkli rozet). Token yok.
export async function buildLatestMeasurementImage(userName?: string): Promise<Blob> {
  const measAll = await dietDb.measurements.orderBy('createdAt').toArray()

  // Her alan icin: en guncel deger + tarihi + bir onceki deger (kiyas)
  const rows = MEASURE_FIELDS_IMG.map((f) => {
    const withVal = measAll.filter((m) => typeof m[f.key] === 'number')
    if (!withVal.length) return null
    const latest = withVal[withVal.length - 1]
    const prev = withVal.length >= 2 ? (withVal[withVal.length - 2][f.key] as number) : null
    return { f, val: latest[f.key] as number, dateStr: latest.dateStr, prev }
  }).filter((r): r is NonNullable<typeof r> => !!r)

  const BANNER = 96
  const ROW_H = 78
  const ROW_GAP = 12
  const cardTop = PAD + BANNER + 20
  const cardH = rows.length ? 22 + rows.length * (ROW_H + ROW_GAP) + 10 : 90
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = cardTop + cardH + 56
  const ctx = canvas.getContext('2d')!
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  ctx.fillStyle = '#f6f8fa'
  ctx.fillRect(0, 0, W, canvas.height)

  // Banner
  const grad = ctx.createLinearGradient(PAD, 0, W - PAD, 0)
  grad.addColorStop(0, '#059669')
  grad.addColorStop(1, '#34d399')
  roundRectPath(ctx, PAD, PAD, W - 2 * PAD, BANNER, 22)
  ctx.fillStyle = grad
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 32px sans-serif'
  ctx.fillText('📐 Son Ölçüler', PAD + 26, PAD + 46)
  ctx.font = '19px sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  const today = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
  ctx.fillText(`${userName ? userName + ' · ' : ''}${today}`, PAD + 26, PAD + 76)

  // Beyaz kart
  fillRound(ctx, PAD, cardTop, W - 2 * PAD, cardH, 22, '#ffffff')

  if (!rows.length) {
    ctx.fillStyle = '#94a3b8'
    ctx.font = '20px sans-serif'
    ctx.fillText('Henüz ölçüm kaydı yok.', PAD + 26, cardTop + 52)
  }

  const shortD = (dateStr: string) =>
    new Date(dateStr + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })

  let y = cardTop + 22
  const rowX = PAD + 22
  const rowW = W - 2 * PAD - 44
  rows.forEach((r, i) => {
    // ince ayirici cizgi (ilk satir haric)
    if (i > 0) {
      ctx.strokeStyle = '#eef2f6'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(rowX, y)
      ctx.lineTo(rowX + rowW, y)
      ctx.stroke()
    }
    const cy = y + ROW_H / 2
    // renkli nokta
    ctx.fillStyle = r.f.color
    ctx.beginPath()
    ctx.arc(rowX + 12, cy, 9, 0, Math.PI * 2)
    ctx.fill()
    // etiket + tarih
    ctx.fillStyle = '#0f172a'
    ctx.font = 'bold 27px sans-serif'
    ctx.fillText(r.f.label, rowX + 36, cy - 2)
    ctx.fillStyle = '#94a3b8'
    ctx.font = '17px sans-serif'
    ctx.fillText(shortD(r.dateStr), rowX + 36, cy + 24)
    // deger (sagda, buyuk)
    ctx.textAlign = 'right'
    ctx.fillStyle = '#0f172a'
    ctx.font = 'bold 34px sans-serif'
    const valStr = `${r.val}${r.f.unit}`
    ctx.fillText(valStr, rowX + rowW, cy + 2)
    // degisim rozeti (deger yazisinin altinda)
    if (r.prev != null) {
      const diff = Math.round((r.val - r.prev) * 10) / 10
      const arrow = diff === 0 ? '→' : diff < 0 ? '↓' : '↑'
      const sign = diff > 0 ? '+' : ''
      const txt = `${arrow} ${sign}${diff}${r.f.unit}`
      // azalma = yesil (iyi), artis = kirmizi, ayni = gri
      const col = diff === 0 ? '#64748b' : diff < 0 ? '#059669' : '#e11d48'
      ctx.font = 'bold 17px sans-serif'
      const tw = ctx.measureText(txt).width
      ctx.textAlign = 'left'
      const chipX = rowX + rowW - tw - 20
      fillRound(ctx, chipX, cy + 12, tw + 20, 26, 13, diff === 0 ? '#f1f5f9' : diff < 0 ? '#ecfdf5' : '#fef2f2')
      ctx.fillStyle = col
      ctx.fillText(txt, chipX + 10, cy + 30)
    }
    ctx.textAlign = 'left'
    y += ROW_H + ROW_GAP
  })

  ctx.fillStyle = '#94a3b8'
  ctx.font = '18px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('Diyet Koçu uygulamasından gönderildi', PAD, canvas.height - 22)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Görsel oluşturulamadı'))), 'image/png')
  })
}

// Gorseli paylas: once cihazin paylas menusu (dosya), olmazsa indir
export async function shareImage(blob: Blob, filename: string): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], filename, { type: 'image/png' })
  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean
    share?: (data: { files: File[]; title?: string }) => Promise<void>
  }
  if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'Diyet Raporu' })
      return 'shared'
    } catch {
      // iptal/desteklenmedi — indirmeye dus
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  return 'downloaded'
}

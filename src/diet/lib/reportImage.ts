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
  const [entries, measurements, vitals, exercises] = await Promise.all([
    dietDb.entries.where('dateStr').equals(dateStr).toArray(),
    dietDb.measurements.where('dateStr').equals(dateStr).toArray(),
    dietDb.vitals.where('dateStr').equals(dateStr).toArray(),
    dietDb.exercises.where('dateStr').equals(dateStr).toArray()
  ])
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

  // Yukseklik hesabi (cizimle ayni adimlar)
  const BANNER = 96
  let h = PAD + BANNER + 22 // baslik banneri
  h += 116 + 24 // basari blogu
  h += 40 // "Ogunler" basligi
  if (entries.length === 0) h += 44
  else for (const g of mealGroups) h += HEAD + g.list.reduce((s, c) => s + c.cardH + 14, 0)
  if (exercises.length) h += 44 + exCardH
  if (measurements.length) h += 48 + measurements.length * 30
  if (vitals.length) h += 48 + vitals.length * 30
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

  // Alt bilgi
  ctx.fillStyle = '#94a3b8'
  ctx.font = '18px sans-serif'
  ctx.fillText('Diyet Koçu uygulamasından gönderildi', PAD, canvas.height - 22)

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

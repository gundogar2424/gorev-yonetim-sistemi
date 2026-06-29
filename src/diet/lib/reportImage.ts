// Gunluk raporu GORSEL (PNG) olarak uretir: yemek fotograflari, basari
// yuzdesi/cubugu, olculer ve saglik verileri tek bir resimde. Diyetisyene
// resim olarak gonderilebilir. Token harcamaz; her sey cihazda cizilir.
import { dietDb } from '../db'
import { dayAdherence } from '../streak'
import { mealLabel, MEAL_OPTIONS } from './meals'

const W = 820
const PAD = 32
const MEAL_H = 100

const TR_DECISION: Record<string, string> = {
  resisted: 'Vazgeçti ✅',
  ate: 'Yedi ⚠️',
  none: 'Karar yok ⏳'
}

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

function measureLines(m: { weight?: number; waist?: number; navel?: number; fold?: number; hip?: number; chest?: number; arm?: number; leg?: number }): string {
  const p: string[] = []
  if (m.weight != null) p.push(`Kilo ${m.weight}kg`)
  if (m.waist != null) p.push(`Bel ${m.waist}cm`)
  if (m.navel != null) p.push(`Göbek ${m.navel}cm`)
  if (m.fold != null) p.push(`Kıvrım ${m.fold}cm`)
  if (m.hip != null) p.push(`Kalça ${m.hip}cm`)
  if (m.chest != null) p.push(`Göğüs ${m.chest}cm`)
  if (m.arm != null) p.push(`Kol ${m.arm}cm`)
  if (m.leg != null) p.push(`Bacak ${m.leg}cm`)
  return p.join(' · ')
}

// Bir gunun gorsel raporunu PNG Blob olarak uretir
export async function buildDailyImage(dateStr: string, userName?: string): Promise<Blob> {
  const [entries, measurements, vitals] = await Promise.all([
    dietDb.entries.where('dateStr').equals(dateStr).toArray(),
    dietDb.measurements.where('dateStr').equals(dateStr).toArray(),
    dietDb.vitals.where('dateStr').equals(dateStr).toArray()
  ])
  entries.sort((a, b) => a.createdAt - b.createdAt)
  const photos = await Promise.all(entries.map((e) => (e.photo ? loadImage(e.photo) : Promise.resolve(null))))

  // Ogunleri ogun turune gore grupla (Kahvalti, Ogle, ... + Diger)
  const HEAD = 34
  const pairs = entries.map((e, i) => ({ e, img: photos[i] }))
  const mealGroups = [...MEAL_OPTIONS.map((o) => o.value), undefined as undefined]
    .map((mt) => ({ mt, list: pairs.filter((p) => (p.e.mealType ?? undefined) === mt) }))
    .filter((g) => g.list.length > 0)

  // Yukseklik hesabi (cizimle ayni adimlar)
  let h = PAD + 56 + 44 // baslik + tarih
  h += 24 + 110 // basari blogu
  h += 36 // "Ogunler" basligi
  if (entries.length === 0) h += 40
  else for (const g of mealGroups) h += HEAD + g.list.length * (MEAL_H + 12)
  if (measurements.length) h += 44 + measurements.length * 30
  if (vitals.length) h += 44 + vitals.length * 30
  h += 50 // alt bilgi

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = Math.max(h, 420)
  const ctx = canvas.getContext('2d')!
  ctx.textBaseline = 'alphabetic'

  // Arka plan
  ctx.fillStyle = '#f1f5f9'
  ctx.fillRect(0, 0, W, canvas.height)

  let y = PAD + 36

  // Baslik
  ctx.fillStyle = '#0f172a'
  ctx.font = 'bold 38px sans-serif'
  ctx.fillText('🥗 Diyet Raporu', PAD, y)
  y += 40
  ctx.fillStyle = '#475569'
  ctx.font = '22px sans-serif'
  const dateNice = new Date(dateStr + 'T00:00:00').toLocaleDateString('tr-TR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
  ctx.fillText(dateNice + (userName ? ` · ${userName}` : ''), PAD, y)
  y += 28

  // Basari blogu
  const pct = dayAdherence(entries, dateStr)
  fillRound(ctx, PAD, y, W - 2 * PAD, 110, 16, '#ffffff')
  ctx.fillStyle = '#64748b'
  ctx.font = 'bold 20px sans-serif'
  ctx.fillText('GÜNLÜK DİYET BAŞARISI', PAD + 24, y + 36)
  if (pct != null) {
    ctx.fillStyle = scoreColor(pct)
    ctx.font = 'bold 40px sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(`%${pct}`, W - PAD - 24, y + 44)
    ctx.textAlign = 'left'
    const bx = PAD + 24
    const by = y + 64
    const bw = W - 2 * PAD - 48
    fillRound(ctx, bx, by, bw, 18, 9, '#e2e8f0')
    fillRound(ctx, bx, by, (bw * pct) / 100, 18, 9, scoreColor(pct))
  } else {
    ctx.fillStyle = '#94a3b8'
    ctx.font = '22px sans-serif'
    ctx.fillText('Bu güne ait karar verilmiş öğün yok.', PAD + 24, y + 70)
  }
  y += 110 + 24

  // Ogunler
  ctx.fillStyle = '#0f172a'
  ctx.font = 'bold 24px sans-serif'
  ctx.fillText('🍽️ Öğünler', PAD, y)
  y += 24

  if (entries.length === 0) {
    ctx.fillStyle = '#94a3b8'
    ctx.font = '20px sans-serif'
    ctx.fillText('Bugün öğün kaydı yok.', PAD, y + 8)
    y += 40
  } else {
    for (const g of mealGroups) {
      // Ogun basligi
      ctx.fillStyle = '#0f766e'
      ctx.font = 'bold 21px sans-serif'
      ctx.fillText('▸ ' + (g.mt ? mealLabel(g.mt) : 'Diğer'), PAD, y + 16)
      y += HEAD
      for (const { e, img } of g.list) {
        fillRound(ctx, PAD, y, W - 2 * PAD, MEAL_H, 14, '#ffffff')
        const isz = MEAL_H - 24
        const ix = PAD + 12
        const iy = y + 12
        if (img) {
          ctx.save()
          roundRectPath(ctx, ix, iy, isz, isz, 10)
          ctx.clip()
          drawCover(ctx, img, ix, iy, isz)
          ctx.restore()
        } else {
          fillRound(ctx, ix, iy, isz, isz, 10, '#e2e8f0')
        }
        const tx = ix + isz + 18
        ctx.fillStyle = '#0f172a'
        ctx.font = 'bold 24px sans-serif'
        ctx.fillText(truncate(ctx, e.foodName, W - PAD - tx - 16), tx, y + 36)
        ctx.fillStyle = '#64748b'
        ctx.font = '19px sans-serif'
        const t = new Date(e.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
        ctx.fillText(`${t} · ~${e.estimatedCalories} kcal · ${TR_DECISION[e.decision] ?? ''}`, tx, y + 64)
        const parts3: string[] = []
        if (e.compliancePercent >= 0) parts3.push(`Uyum %${e.compliancePercent}`)
        if (e.satiety) parts3.push(`Tokluk ${e.satiety}/10`)
        if (e.feeling) parts3.push(`Keyif ${e.feeling}/10`)
        if (parts3.length) {
          ctx.fillStyle = '#475569'
          ctx.font = '18px sans-serif'
          ctx.fillText(parts3.join(' · '), tx, y + 88)
        }
        y += MEAL_H + 12
      }
    }
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

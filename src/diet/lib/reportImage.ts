// Gunluk raporu GORSEL (PNG) olarak uretir: yemek fotograflari, basari
// yuzdesi/cubugu, olculer ve saglik verileri tek bir resimde. Diyetisyene
// resim olarak gonderilebilir. Token harcamaz; her sey cihazda cizilir.
import { dietDb } from '../db'
import { dayAdherence } from '../streak'
import { mealLabel, mealEmoji, MEAL_OPTIONS } from './meals'
import { groupHungerByMeal, hungerAvg } from './report'
import type { DietEntry } from '../types'

const W = 820
const PAD = 32
// Yuksek cozunurluk carpani: tuvali 2x piksel yogunlugunda cizeriz; yerlesim
// (koordinatlar/fontlar) ayni kalir ama gorsel daha buyuk ve NET olur — diyetisyen
// yakinlastirdiginda yazilar bulaniklasmaz. Tum rapor gorsellerine uygulanir.
const SCALE = 2

// Tuvali logic boyutta kur ama 2x piksel destekli yap; ctx'i olcekle dondur.
function hiDpiCanvas(logicalW: number, logicalH: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(logicalW * SCALE)
  canvas.height = Math.round(logicalH * SCALE)
  const ctx = canvas.getContext('2d')!
  ctx.scale(SCALE, SCALE)
  return { canvas, ctx }
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

// Goruntuyu kutuya "contain" sigdirir (KIRPMADAN, gercek en-boy orani korunur;
// bosluk kalirsa ortalanir). Diyetisyene giden yemek fotografi icin.
function drawContain(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, boxW: number, boxH: number) {
  const ratio = Math.min(boxW / img.width, boxH / img.height)
  const w = img.width * ratio
  const h = img.height * ratio
  ctx.drawImage(img, x + (boxW - w) / 2, y + (boxH - h) / 2, w, h)
}

// "YENMEDİ" damgasi: fotografin ORTASINDAN capraz, kirmizi bant + beyaz yazi.
// Vazgecilen (yenmeyen) ogun fotografina uygulanir; caller kirpma (clip) icinde cagirir.
function drawNotEatenStamp(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.save()
  ctx.translate(x + w / 2, y + h / 2)
  ctx.rotate(-Math.atan2(h, w)) // kutunun kosegeni boyunca
  const diag = Math.sqrt(w * w + h * h)
  const fontPx = Math.max(34, Math.min(w, h) * 0.16)
  const bandH = fontPx * 1.55
  ctx.fillStyle = 'rgba(220,38,38,0.82)' // kirmizi yari saydam bant
  ctx.fillRect(-diag / 2, -bandH / 2, diag, bandH)
  ctx.fillStyle = '#ffffff'
  ctx.font = `bold ${Math.round(fontPx)}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('YENMEDİ ✕', 0, 2)
  ctx.restore()
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

function measureLines(m: { weight?: number; navel?: number; fold?: number; hip?: number; chest?: number; arm?: number; leg?: number }): string {
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
  const [entries, measurements, vitals, exercises, waterRow, checkins] = await Promise.all([
    dietDb.entries.where('dateStr').equals(dateStr).toArray(),
    dietDb.measurements.where('dateStr').equals(dateStr).toArray(),
    dietDb.vitals.where('dateStr').equals(dateStr).toArray(),
    dietDb.exercises.where('dateStr').equals(dateStr).toArray(),
    dietDb.water.where('dateStr').equals(dateStr).first(),
    dietDb.checkins.where('dateStr').equals(dateStr).sortBy('createdAt')
  ])
  const waterMl = waterRow ? (waterRow.ml != null ? waterRow.ml : (waterRow.glasses || 0) * 200) : 0
  // Gun ici aclik kayitlari (moral GONDERILMEZ — sadece aclik)
  const hungerRecs = checkins.filter((c) => c.hunger != null)
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
    const hasParts3 = p.e.compliancePercent >= 0 || !!p.e.alsoMeal || !!p.e.alsoMeal2
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
  const hGroups = hungerRecs.length ? groupHungerByMeal(entries, checkins) : []
  if (hungerRecs.length) h += 48 + (hGroups.length + hungerRecs.length + 1) * 30 + 10
  if (waterMl > 0) h += 52 // "💧 Su" bloğu çizerken 52px kullanıyor (8+8+30+6)
  h += 50 // alt bilgi

  const logicalH = Math.max(h, 480)
  const { canvas, ctx } = hiDpiCanvas(W, logicalH)
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'

  // Arka plan
  ctx.fillStyle = '#f6f8fa'
  ctx.fillRect(0, 0, W, logicalH)

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
          if (e.decision === 'resisted') drawNotEatenStamp(ctx, ix, iy, PHOTO, PHOTO)
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
        // Uyum + (varsa) birleşik öğün etiketi
        if (hasParts3) {
          const parts3: string[] = []
          if (e.compliancePercent >= 0) parts3.push(`✓ Uyum %${e.compliancePercent}`)
          if (e.alsoMeal) parts3.push(`🔗 ${mealLabel(e.mealType)}${[e.alsoMeal, e.alsoMeal2].filter(Boolean).map((x) => '+' + mealLabel(x as never)).join('')} birleşik`)
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

  // Gun ici aclik — OGUNE gore gruplu (ust: ogun, alt: o ogunden sonraki aclik).
  if (hungerRecs.length) {
    y += 8
    ctx.fillStyle = '#0f172a'
    ctx.font = 'bold 24px sans-serif'
    ctx.fillText('🍽️ Gün içi açlık (1 tok–10 çok aç)', PAD, y)
    y += 8
    for (const g of hGroups) {
      y += 30
      ctx.fillStyle = '#0f766e'
      ctx.font = 'bold 20px sans-serif'
      ctx.fillText(`▸ ${g.label}${g.mtime ? ` (${g.mtime})` : ''}`, PAD + 6, y)
      ctx.fillStyle = '#334155'
      ctx.font = '20px sans-serif'
      for (const c of g.recs) {
        y += 30
        const t = new Date(c.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
        ctx.fillText(`   • ${t} — açlık ${c.hunger}/10`, PAD + 6, y)
      }
    }
    y += 30
    ctx.fillStyle = '#0f766e'
    ctx.font = 'bold 18px sans-serif'
    ctx.fillText(`Ortalama açlık: ${hungerAvg(checkins)}/10`, PAD + 6, y)
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
  ctx.fillText('Diyet Koçu uygulamasından gönderildi', PAD, logicalH - 22)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Görsel oluşturulamadı'))), 'image/png')
  })
}

// Tek uzun gorsel yerine, WhatsApp'a AYRI AYRI gonderilecek gorsel SETI uretir:
// her ogun turu icin bir gorsel (buyuk foto + buyuk yazi) + spor/saglik icin bir gorsel.
export async function buildDailyImageSet(dateStr: string, userName?: string): Promise<{ filename: string; blob: Blob }[]> {
  const [entries, measurements, vitals, exercises, waterRow, checkins] = await Promise.all([
    dietDb.entries.where('dateStr').equals(dateStr).toArray(),
    dietDb.measurements.where('dateStr').equals(dateStr).toArray(),
    dietDb.vitals.where('dateStr').equals(dateStr).toArray(),
    dietDb.exercises.where('dateStr').equals(dateStr).toArray(),
    dietDb.water.where('dateStr').equals(dateStr).first(),
    dietDb.checkins.where('dateStr').equals(dateStr).sortBy('createdAt')
  ])
  const waterMl = waterRow ? (waterRow.ml != null ? waterRow.ml : (waterRow.glasses || 0) * 200) : 0
  const hungerRecs = checkins.filter((c) => c.hunger != null) // moral GONDERILMEZ
  const hGroups = hungerRecs.length ? groupHungerByMeal(entries, checkins) : []
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

  // YENI DUZEN: fotograf ustte TAM GENISLIK + gercek en-boy orani (kirpmasiz),
  // aciklama altta. Diyetisyen fotografi net ve butun gorsun.
  const CARD_PAD = 20
  const PHOTO_BOX_W = W - 2 * PAD - 2 * CARD_PAD
  const MAX_PHOTO_H = 900 // cok uzun (portre) fotograflarda tavan
  const NO_PHOTO_H = 300 // fotografsiz ogun icin yer tutucu yukseklik
  const NAME_PX = 30
  const NAME_LH = 40
  const nameMaxW = PHOTO_BOX_W

  const toBlob = (canvas: HTMLCanvasElement) =>
    new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Görsel oluşturulamadı'))), 'image/png'))

  // Yesil baslikli bos bir tuval hazirlar; icerik alanini y ile dondurur
  function makeCanvas(title: string, contentH: number) {
    const BANNER = 88
    const logicalH = Math.max(PAD + BANNER + 22 + contentH + 46, 340)
    const { canvas, ctx } = hiDpiCanvas(W, logicalH)
    ctx.textBaseline = 'alphabetic'
    ctx.textAlign = 'left'
    ctx.fillStyle = '#f6f8fa'
    ctx.fillRect(0, 0, W, logicalH)
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
    return { ctx, canvas, y: PAD + BANNER + 22, h: logicalH }
  }

  // Ogun kartini cizer: fotograf ustte (tam genislik, gercek oran), aciklama altta
  function drawBigCard(ctx: CanvasRenderingContext2D, card: { e: DietEntry; img: HTMLImageElement | null; lines: string[]; hasParts3: boolean; photoH: number; cardH: number }, y: number) {
    fillRound(ctx, PAD, y, W - 2 * PAD, card.cardH, 20, '#ffffff')
    const px = PAD + CARD_PAD
    const py = y + CARD_PAD
    const boxW = PHOTO_BOX_W
    const boxH = card.photoH
    // Fotograf kutusu (kirpmasiz — arta kalan bosluk acik gri)
    ctx.save()
    roundRectPath(ctx, px, py, boxW, boxH, 16)
    ctx.clip()
    ctx.fillStyle = '#eef2f6'
    ctx.fillRect(px, py, boxW, boxH)
    if (card.img) {
      drawContain(ctx, card.img, px, py, boxW, boxH)
    } else {
      ctx.fillStyle = '#cbd5e1'
      ctx.font = '80px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('🍽️', px + boxW / 2, py + boxH / 2 + 28)
      ctx.textAlign = 'left'
    }
    if (card.e.decision === 'resisted') drawNotEatenStamp(ctx, px, py, boxW, boxH) // yenmedi damgasi
    ctx.restore()

    // Aciklama (fotografin altinda)
    const tx = px
    let ty = py + boxH + 18 + NAME_PX
    ctx.fillStyle = '#0f172a'
    ctx.font = `bold ${NAME_PX}px sans-serif`
    for (const ln of card.lines) {
      ctx.fillText(ln, tx, ty)
      ty += NAME_LH
    }
    ctx.fillStyle = '#64748b'
    ctx.font = '20px sans-serif'
    const t = new Date(card.e.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    const meta = `${t}  ·  ~${card.e.estimatedCalories} kcal`
    ctx.fillText(meta, tx, ty + 6)
    const d = DEC_STYLE[card.e.decision] ?? DEC_STYLE.none
    drawChip(ctx, tx + ctx.measureText(meta).width + 16, ty - 12, d.t, d.bg, d.fg)
    ty += 36
    if (card.hasParts3) {
      const p3: string[] = []
      if (card.e.compliancePercent >= 0) p3.push(`✓ Uyum %${card.e.compliancePercent}`)
      if (card.e.alsoMeal) p3.push(`🔗 ${mealLabel(card.e.mealType)}${[card.e.alsoMeal, card.e.alsoMeal2].filter(Boolean).map((x) => '+' + mealLabel(x as never)).join('')} birleşik`)
      ctx.fillStyle = '#475569'
      ctx.font = '19px sans-serif'
      ctx.fillText(p3.join('   ·   '), tx, ty + 4)
    }
  }

  // Ogun kartini olcup hazirla (fotograf yuksekligi + satirlar + kart yuksekligi)
  function prep(p: { e: DietEntry; img: HTMLImageElement | null }) {
    mctx.font = `bold ${NAME_PX}px sans-serif`
    let lines = wrapText(mctx, p.e.foodName, nameMaxW)
    if (lines.length > 3) lines = [lines[0], lines[1], truncate(mctx, lines.slice(2).join(' '), nameMaxW)]
    const hasParts3 = p.e.compliancePercent >= 0 || !!p.e.alsoMeal || !!p.e.alsoMeal2
    // Fotograf yuksekligi: tam genislikte gercek en-boy orani (tavan MAX_PHOTO_H)
    const aspect = p.img && p.img.width > 0 ? p.img.width / p.img.height : 0
    const photoH = p.img && aspect > 0 ? Math.min(Math.round(PHOTO_BOX_W / aspect), MAX_PHOTO_H) : NO_PHOTO_H
    const textH = lines.length * NAME_LH + 44 + (hasParts3 ? 32 : 0)
    const cardH = CARD_PAD + photoH + 18 + textH + CARD_PAD
    return { ...p, lines, hasParts3, photoH, cardH }
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
    const { ctx, canvas, y: y0, h: chH } = makeCanvas(title, contentH)
    let y = y0
    for (const card of g.list) {
      drawBigCard(ctx, card, y)
      y += card.cardH + 16
    }
    ctx.fillStyle = '#94a3b8'
    ctx.font = '16px sans-serif'
    ctx.fillText('Diyet Koçu uygulamasından gönderildi', PAD, chH - 20)
    out.push({ filename: `diyet-${dateStr}-${idx++}-ogun.png`, blob: await toBlob(canvas) })
  }

  // Spor & Saglik: tek bir gorsel — her bolum kendi beyaz kartinda, ferah ve
  // buyuk yazili; seker olcumlerinde aclik/tok net renkli rozetle.
  if (exercises.length || vitals.length || measurements.length || waterMl > 0 || hungerRecs.length) {
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
    const hunLines = hGroups.length + hungerRecs.length + 1 // basliklar + kayitlar + ortalama
    const hunH = hungerRecs.length ? TITLE_H + CPAD * 2 + hunLines * ROW + 22 : 0
    const contentH = exH + vitH + meaH + watH + hunH + 10

    const { ctx, canvas, y: y0, h: chH } = makeCanvas('🏃 Spor & 🩺 Sağlık', contentH)
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

    if (hungerRecs.length) {
      drawTitle('🍽️ Gün içi açlık (1 tok–10 çok aç)')
      const cardH = CPAD * 2 + hunLines * ROW
      fillRound(ctx, PAD, y, W - 2 * PAD, cardH, 18, '#ffffff')
      let ry = y + CPAD
      for (const g of hGroups) {
        // Ust: ogun basligi
        ctx.fillStyle = '#0f766e'
        ctx.font = 'bold 23px sans-serif'
        ctx.fillText(`▸ ${g.label}${g.mtime ? ` (${g.mtime})` : ''}`, PAD + CPAD, ry + 33)
        ry += ROW
        // Alt: o ogunden sonraki aclik saatleri
        for (const c of g.recs) {
          const t = new Date(c.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
          ctx.fillStyle = '#0f172a'
          ctx.font = '24px sans-serif'
          ctx.fillText(`    ${t}  ·  açlık ${c.hunger}/10`, PAD + CPAD, ry + 33)
          ry += ROW
        }
      }
      ctx.fillStyle = '#0f766e'
      ctx.font = 'bold 22px sans-serif'
      ctx.fillText(`Ortalama açlık: ${hungerAvg(checkins)}/10`, PAD + CPAD, ry + 33)
      y += cardH + 22
    }

    ctx.fillStyle = '#94a3b8'
    ctx.font = '16px sans-serif'
    ctx.fillText('Diyet Koçu uygulamasından gönderildi', PAD, chH - 20)
    out.push({ filename: `diyet-${dateStr}-${idx++}-spor-saglik.png`, blob: await toBlob(canvas) })
  }

  return out
}

// ---- GÜNLÜK SAĞLIK RAPORU (tek görsel): şeker/tansiyon + spor + ilaç/vitamin ----
// Diyetisyene bir günün SAĞLIK verilerini tek seferde göndermek için. Token harcamaz.
export async function buildDailyHealthImage(dateStr: string, userName?: string): Promise<Blob> {
  const [vitals, exercises, waterRow, meds, medLogs, actRow] = await Promise.all([
    dietDb.vitals.where('dateStr').equals(dateStr).toArray(),
    dietDb.exercises.where('dateStr').equals(dateStr).toArray(),
    dietDb.water.where('dateStr').equals(dateStr).first(),
    dietDb.meds.toArray(),
    dietDb.medlogs.where('dateStr').equals(dateStr).toArray(),
    dietDb.steps.where('dateStr').equals(dateStr).first()
  ])
  const actParts: string[] = []
  if (actRow?.count) actParts.push(`👟 ${actRow.count.toLocaleString('tr-TR')} adım`)
  if (actRow?.activeMin) actParts.push(`⏱️ ${actRow.activeMin} dk etkin`)
  if (actRow?.activeKcal) actParts.push(`🔥 ${actRow.activeKcal} kcal aktivite`)
  if (actRow?.burnedKcal) actParts.push(`🔋 ${actRow.burnedKcal} kcal toplam`)
  if (actRow?.distanceKm) actParts.push(`📍 ${actRow.distanceKm} km`)
  const waterMl = waterRow ? (waterRow.ml != null ? waterRow.ml : (waterRow.glasses || 0) * 200) : 0
  vitals.sort((a, b) => (a.time || '').localeCompare(b.time || ''))
  exercises.sort((a, b) => a.createdAt - b.createdAt)

  // İlaç/vitamin: o güne planlı dozları alındı/atlandı/alınmadı olarak eşle + fazladan kayıtlar
  const dow = new Date(dateStr + 'T00:00:00').getDay()
  const schedOn = (m: { active?: boolean; days?: number[]; startDate?: string; endDate?: string }) =>
    m.active !== false &&
    (!m.days || !m.days.length || m.days.includes(dow)) &&
    (!m.startDate || dateStr >= m.startDate) &&
    (!m.endDate || dateStr <= m.endDate)
  type MedRow = { time: string; name: string; dose?: string; status: 'taken' | 'skipped' | 'missing' }
  const used = new Set<number>()
  const medRows: MedRow[] = []
  for (const m of meds.filter(schedOn)) {
    const times = (m.times || []).filter((t) => /^\d{1,2}:\d{2}$/.test(t))
    const slotTimes = times.length ? [...times].sort() : ['—'] // saati olmayan ilaç da bir slot alsın
    for (const time of slotTimes) {
      // Bu slota kayıt bul: önce tam saat, yoksa saatsiz, yoksa bu ilaca ait BAŞKA bir
      // (kaymış saatli) kayıt — böylece 09:00'da alınan 08:00 dozu "alınmadı+alındı" diye
      // iki kez çıkmaz, tek slota yerleşir.
      let log = medLogs.find((l) => l.medId === m.id && l.time === time && !used.has(l.id!))
      if (!log) log = medLogs.find((l) => l.medId === m.id && !l.time && !used.has(l.id!))
      if (!log) log = medLogs.find((l) => l.medId === m.id && !used.has(l.id!))
      if (log) used.add(log.id!)
      medRows.push({ time, name: m.name, dose: m.dose, status: log ? log.status ?? 'taken' : 'missing' })
    }
  }
  for (const l of medLogs) {
    if (used.has(l.id!)) continue
    const t = l.time || new Date(l.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    medRows.push({ time: t, name: l.name, status: l.status ?? 'taken' })
  }
  medRows.sort((a, b) => a.time.localeCompare(b.time))

  const dateNice = new Date(dateStr + 'T00:00:00').toLocaleDateString('tr-TR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
  const subtitle = dateNice + (userName ? ` · ${userName}` : '')

  const BANNER = 96
  const TITLE_H = 48
  const ROW = 50
  const CPAD = 22
  const EXLINE = 34

  const mctx = document.createElement('canvas').getContext('2d')!
  mctx.font = '24px sans-serif'
  const exB = exercises.map((ex) => {
    const meta = [ex.minutes ? `${ex.minutes} dk` : '', ex.kcal ? `~${ex.kcal} kcal` : ''].filter(Boolean).join(' · ')
    return { lines: wrapText(mctx, ex.text, W - 2 * PAD - 2 * CPAD), meta }
  })
  const exCardH = exB.length ? CPAD * 2 + exB.reduce((s, b) => s + b.lines.length * EXLINE + (b.meta ? 34 : 0) + 16, 0) : 0

  const vitCardH = vitals.length ? CPAD * 2 + vitals.length * ROW : 0
  const medCardH = medRows.length ? CPAD * 2 + medRows.length * ROW : 0
  const actLines = actParts.length ? wrapText(mctx, actParts.join('   ·   '), W - 2 * PAD - 2 * CPAD) : []
  const actCardH = actLines.length ? CPAD * 2 + actLines.length * 38 : 0

  const hasAny = vitals.length || exB.length || medRows.length || waterMl > 0 || actParts.length
  let content = 0
  if (vitals.length) content += TITLE_H + vitCardH + 22
  if (actParts.length) content += TITLE_H + actCardH + 22
  if (exB.length) content += TITLE_H + exCardH + 22
  if (medRows.length) content += TITLE_H + medCardH + 22
  if (waterMl > 0) content += TITLE_H + 86 + 22
  if (!hasAny) content += 70

  const logicalH = PAD + BANNER + 22 + content + 46
  const { canvas, ctx } = hiDpiCanvas(W, logicalH)
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  ctx.fillStyle = '#f6f8fa'
  ctx.fillRect(0, 0, W, logicalH)

  // Banner
  const grad = ctx.createLinearGradient(PAD, 0, W - PAD, 0)
  grad.addColorStop(0, '#0369a1')
  grad.addColorStop(1, '#0ea5e9')
  roundRectPath(ctx, PAD, PAD, W - 2 * PAD, BANNER, 22)
  ctx.fillStyle = grad
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 32px sans-serif'
  ctx.fillText('🩺 Günlük Sağlık Raporu', PAD + 26, PAD + 44)
  ctx.font = '18px sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.fillText(subtitle, PAD + 26, PAD + 74)
  let y = PAD + BANNER + 22

  const drawTitle = (t: string) => {
    ctx.fillStyle = '#0f172a'
    ctx.font = 'bold 27px sans-serif'
    ctx.fillText(t, PAD, y + 28)
    y += TITLE_H
  }

  if (!hasAny) {
    ctx.fillStyle = '#94a3b8'
    ctx.font = '22px sans-serif'
    ctx.fillText('Bu güne ait şeker/tansiyon, spor veya ilaç kaydı yok.', PAD, y + 30)
    y += 70
  }

  // Şeker / Tansiyon
  if (vitals.length) {
    drawTitle('🩺 Şeker / Tansiyon')
    fillRound(ctx, PAD, y, W - 2 * PAD, vitCardH, 18, '#ffffff')
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
          drawChip(ctx, PAD + CPAD + ctx.measureText(txt).width + 16, baseY - 21, isTok ? '🍽️ Tok' : '🕐 Açlık', isTok ? '#e0f2fe' : '#fef3c7', isTok ? '#075985' : '#92400e')
        }
      } else {
        ctx.fillText(`${v.time}  ·  Tansiyon ${v.systolic}/${v.diastolic}${v.pulse ? `  · nabız ${v.pulse}` : ''}`, PAD + CPAD, baseY)
      }
      ry += ROW
    }
    y += vitCardH + 22
  }

  // Aktivite (akıllı saatten): adım / etkin süre / kalori / mesafe
  if (actParts.length) {
    drawTitle('🏃 Aktivite (saatten)')
    fillRound(ctx, PAD, y, W - 2 * PAD, actCardH, 18, '#ffffff')
    let ry = y + CPAD
    ctx.fillStyle = '#0f172a'
    ctx.font = 'bold 25px sans-serif'
    for (const ln of actLines) {
      ctx.fillText(ln, PAD + CPAD, ry + 30)
      ry += 38
    }
    y += actCardH + 22
  }

  // Spor
  if (exB.length) {
    drawTitle('🏃 Spor')
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

  // İlaç & Vitamin
  if (medRows.length) {
    drawTitle('💊 İlaç & Vitamin')
    fillRound(ctx, PAD, y, W - 2 * PAD, medCardH, 18, '#ffffff')
    let ry = y + CPAD
    for (const r of medRows) {
      const baseY = ry + 33
      ctx.fillStyle = '#0f172a'
      ctx.font = 'bold 24px sans-serif'
      const txt = `${r.time}  ·  ${r.name}${r.dose ? ` (${r.dose})` : ''}`
      ctx.fillText(truncate(ctx, txt, W - 2 * PAD - 2 * CPAD - 150), PAD + CPAD, baseY)
      const st =
        r.status === 'taken'
          ? { t: '✓ Alındı', bg: '#d1fae5', fg: '#065f46' }
          : r.status === 'skipped'
            ? { t: '✗ Atlandı', bg: '#f1f5f9', fg: '#64748b' }
            : { t: '— Alınmadı', bg: '#fef3c7', fg: '#92400e' }
      // Rozet genişliğini drawChip'in KENDİ fontuyla (bold 15px) ölç ki sağa tam yaslansın
      ctx.font = 'bold 15px sans-serif'
      const cw = ctx.measureText(st.t).width + 22
      drawChip(ctx, W - PAD - CPAD - cw, baseY - 21, st.t, st.bg, st.fg)
      ry += ROW
    }
    y += medCardH + 22
  }

  // Su
  if (waterMl > 0) {
    drawTitle('💧 Su')
    fillRound(ctx, PAD, y, W - 2 * PAD, 86, 18, '#ffffff')
    ctx.fillStyle = '#0284c7'
    ctx.font = 'bold 40px sans-serif'
    ctx.fillText(`${waterMl} ml`, PAD + CPAD, y + 56)
    y += 86 + 22
  }

  ctx.fillStyle = '#94a3b8'
  ctx.font = '18px sans-serif'
  ctx.fillText('Diyet Koçu uygulamasından gönderildi', PAD, logicalH - 22)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Görsel oluşturulamadı'))), 'image/png')
  })
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
  // Fotograf TAM GENISLIK + gercek en-boy orani (kirpmasiz). Tavan yuksekligi
  // cok uzun portre fotograflar icin sinir koyar.
  const aspect = img && img.width > 0 ? img.width / img.height : 0
  const PHOTO_H = img && aspect > 0 ? Math.min(Math.round(contentW / aspect), 1100) : 220
  const NAME_LH = 60

  // Bilgi kart yuksekligi: sadece ad satirlari + pad
  const infoH = 34 + nameLines.length * NAME_LH + 24

  const logicalH = PAD + BANNER + 20 + PHOTO_H + 18 + infoH + 46
  const { canvas, ctx } = hiDpiCanvas(W, logicalH)
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  ctx.fillStyle = '#f6f8fa'
  ctx.fillRect(0, 0, W, logicalH)

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
  const mealTitle = (e.mealType ? mealLabel(e.mealType) : 'Öğün') + [e.alsoMeal, e.alsoMeal2].filter(Boolean).map((x) => ' + ' + mealLabel(x as never)).join('')
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

  // Fotograf (tam genislik, gercek en-boy orani — KIRPMASIZ)
  ctx.save()
  roundRectPath(ctx, PAD, y, contentW, PHOTO_H, 20)
  ctx.clip()
  ctx.fillStyle = '#eef2f6'
  ctx.fillRect(PAD, y, contentW, PHOTO_H)
  if (img) {
    drawContain(ctx, img, PAD, y, contentW, PHOTO_H)
  } else {
    ctx.fillStyle = '#cbd5e1'
    ctx.font = '72px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('🍽️', W / 2, y + PHOTO_H / 2 + 24)
    ctx.textAlign = 'left'
  }
  if (e.decision === 'resisted') drawNotEatenStamp(ctx, PAD, y, contentW, PHOTO_H) // yenmedi damgasi
  ctx.restore()
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
  ctx.fillText('Diyet Koçu uygulamasından gönderildi', PAD, logicalH - 24)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Görsel oluşturulamadı'))), 'image/png')
  })
}

// ---- AÇLIK TAKİBİ raporu: gün akışı (kronolojik) — sabahtan akşama saat sırasıyla ----
// Açlık kayıtları ve öğünler TEK zaman çizelgesinde, BÜYÜK ve okunaklı satırlarla.
// Diyetisyen "kahvaltıdan önce 8'di, sonra 3'e düştü, ara öğün şurada" akışını görür.
export async function buildHungerImage(dateStr: string, userName?: string): Promise<Blob> {
  const [entries, checkins] = await Promise.all([
    dietDb.entries.where('dateStr').equals(dateStr).toArray(),
    dietDb.checkins.where('dateStr').equals(dateStr).sortBy('createdAt')
  ])
  const hunger = checkins.filter((c) => c.hunger != null).sort((a, b) => a.createdAt - b.createdAt)
  const meals = entries.filter((e) => e.decision === 'ate').sort((a, b) => a.createdAt - b.createdAt)

  // Kronolojik akış: açlık kayıtları + öğünler tek listede, saat sırasıyla
  type Ev = { at: number; kind: 'hunger'; val: number } | { at: number; kind: 'meal'; e: DietEntry }
  const evs: Ev[] = [
    ...hunger.map((c) => ({ at: c.createdAt, kind: 'hunger' as const, val: c.hunger! })),
    ...meals.map((e) => ({ at: e.createdAt, kind: 'meal' as const, e }))
  ].sort((a, b) => a.at - b.at)

  const dateNice = new Date(dateStr + 'T00:00:00').toLocaleDateString('tr-TR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })

  const BANNER = 96
  const CPAD = 24
  const MEAL_ROW = 78 // ogun bandi (buyuk)
  const HUNGER_ROW = 62 // aclik satiri (buyuk)
  const AVG_H = 64
  const mctx = document.createElement('canvas').getContext('2d')!

  // Ogun adi tek satira sigmazsa kisalt (buyuk fontla)
  const nameMaxW = W - 2 * PAD - 2 * CPAD - 250
  const mealName = (e: DietEntry) => {
    mctx.font = 'bold 26px sans-serif'
    let n = e.foodName || ''
    while (n.length > 3 && mctx.measureText(n).width > nameMaxW) n = n.slice(0, -1)
    return n === (e.foodName || '') ? n : n + '…'
  }

  const listH = evs.length
    ? evs.reduce((s2, ev) => s2 + (ev.kind === 'meal' ? MEAL_ROW : HUNGER_ROW), 0) + CPAD * 2 + (hunger.length ? AVG_H : 0)
    : 100
  const logicalH = PAD + BANNER + 22 + listH + 56
  const { canvas, ctx } = hiDpiCanvas(W, logicalH)
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  ctx.fillStyle = '#f6f8fa'
  ctx.fillRect(0, 0, W, logicalH)

  // Banner
  const grad = ctx.createLinearGradient(PAD, 0, W - PAD, 0)
  grad.addColorStop(0, '#7c3aed')
  grad.addColorStop(1, '#c084fc')
  roundRectPath(ctx, PAD, PAD, W - 2 * PAD, BANNER, 22)
  ctx.fillStyle = grad
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 32px sans-serif'
  ctx.fillText('🍽️ Açlık Takibi — Gün Akışı', PAD + 26, PAD + 46)
  ctx.font = '19px sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.fillText(dateNice + (userName ? ` · ${userName}` : '') + ' · 1 tok – 10 çok aç', PAD + 26, PAD + 76)
  let y = PAD + BANNER + 22

  // Akış kartı
  fillRound(ctx, PAD, y, W - 2 * PAD, listH, 20, '#ffffff')
  if (!evs.length) {
    ctx.fillStyle = '#94a3b8'
    ctx.font = '22px sans-serif'
    ctx.fillText('Bu güne ait açlık/öğün kaydı yok.', PAD + CPAD, y + 58)
  } else {
    let ry = y + CPAD
    for (const ev of evs) {
      const t = new Date(ev.at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
      if (ev.kind === 'meal') {
        // ÖĞÜN bandı: renkli arka plan + saat + öğün adı + yemek
        fillRound(ctx, PAD + 12, ry + 6, W - 2 * PAD - 24, MEAL_ROW - 12, 14, '#ecfdf5')
        ctx.fillStyle = '#065f46'
        ctx.font = 'bold 30px sans-serif'
        const label = `${mealEmoji(ev.e.mealType)} ${t}  ${(ev.e.mealType ? mealLabel(ev.e.mealType) : 'Öğün').toUpperCase()}${[ev.e.alsoMeal, ev.e.alsoMeal2].filter(Boolean).map((x) => ' + ' + mealLabel(x as never).toUpperCase()).join('')}`
        ctx.fillText(label, PAD + CPAD + 6, ry + 40)
        ctx.fillStyle = '#0f766e'
        ctx.font = 'bold 26px sans-serif'
        ctx.fillText(mealName(ev.e), PAD + CPAD + 6, ry + MEAL_ROW - 8 - 2)
        ry += MEAL_ROW
      } else {
        // AÇLIK satırı: saat + büyük değer (renkli)
        const col = ev.val >= 7 ? '#e11d48' : ev.val >= 5 ? '#d97706' : '#7c3aed'
        ctx.fillStyle = col
        ctx.beginPath()
        ctx.arc(PAD + CPAD + 12, ry + HUNGER_ROW / 2 - 4, 9, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#0f172a'
        ctx.font = 'bold 28px sans-serif'
        ctx.fillText(`${t}`, PAD + CPAD + 36, ry + HUNGER_ROW / 2 + 6)
        ctx.fillStyle = col
        ctx.fillText(`Açlık ${ev.val}/10${ev.val >= 7 ? '  🔴 çok aç' : ev.val <= 3 ? '  ✅ tok' : ''}`, PAD + CPAD + 150, ry + HUNGER_ROW / 2 + 6)
        ry += HUNGER_ROW
      }
    }
    if (hunger.length) {
      ctx.fillStyle = '#7c3aed'
      ctx.font = 'bold 26px sans-serif'
      ctx.fillText(`Günün ortalama açlığı: ${hungerAvg(checkins)}/10`, PAD + CPAD, ry + 40)
    }
  }
  y += listH + 22

  ctx.fillStyle = '#94a3b8'
  ctx.font = '18px sans-serif'
  ctx.fillText('Diyet Koçu uygulamasından gönderildi', PAD, logicalH - 22)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Görsel oluşturulamadı'))), 'image/png')
  })
}


// ---- TEK TİP SAĞLIK raporu: SADECE şeker ya da SADECE tansiyon (ayrı ayrı gönderim) ----
// Diyetisyene şekeri/tansiyonu tek başına, dönemli liste + ortalama olarak gönderir.
export async function buildVitalReportImage(kind: 'seker' | 'tansiyon', days: number, userName?: string): Promise<Blob> {
  const all = await dietDb.vitals.orderBy('createdAt').toArray()
  const rows = all
    .filter((v) => v.kind === kind && imgInLastDays(v.dateStr, days))
    .sort((a, b) => (a.dateStr + a.time).localeCompare(b.dateStr + b.time))

  const isSugar = kind === 'seker'
  const accent = isSugar ? '#e11d48' : '#0ea5e9'
  const title = isSugar ? '🩸 Şeker Raporu' : '🩺 Tansiyon Raporu'

  const BANNER = 96
  const ROW = 52
  const CPAD = 22
  const headH = 56 // ortalama satiri
  const cardTop = PAD + BANNER + 20
  const cardH = rows.length ? CPAD * 2 + headH + rows.length * ROW : 90
  const logicalH = cardTop + cardH + 56
  const { canvas, ctx } = hiDpiCanvas(W, logicalH)
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  ctx.fillStyle = '#f6f8fa'
  ctx.fillRect(0, 0, W, logicalH)

  // Banner
  const grad = ctx.createLinearGradient(PAD, 0, W - PAD, 0)
  grad.addColorStop(0, isSugar ? '#be123c' : '#0369a1')
  grad.addColorStop(1, accent)
  roundRectPath(ctx, PAD, PAD, W - 2 * PAD, BANNER, 22)
  ctx.fillStyle = grad
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 32px sans-serif'
  ctx.fillText(title, PAD + 26, PAD + 46)
  ctx.font = '19px sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.fillText(`${days ? `Son ${days} gün` : 'Tüm zamanlar'}${userName ? ` · ${userName}` : ''}`, PAD + 26, PAD + 76)

  fillRound(ctx, PAD, cardTop, W - 2 * PAD, cardH, 22, '#ffffff')

  if (!rows.length) {
    ctx.fillStyle = '#94a3b8'
    ctx.font = '20px sans-serif'
    ctx.fillText(isSugar ? 'Bu aralıkta şeker ölçümü yok.' : 'Bu aralıkta tansiyon ölçümü yok.', PAD + 26, cardTop + 52)
  } else {
    let y = cardTop + CPAD + 34
    // Ortalama
    ctx.fillStyle = accent
    ctx.font = 'bold 24px sans-serif'
    if (isSugar) {
      const avg = Math.round(rows.reduce((s, v) => s + (v.sugar || 0), 0) / rows.length)
      ctx.fillText(`Ortalama şeker: ${avg} mg/dL  (${rows.length} ölçüm)`, PAD + CPAD, y)
    } else {
      const as = Math.round(rows.reduce((s, v) => s + (v.systolic || 0), 0) / rows.length)
      const ad = Math.round(rows.reduce((s, v) => s + (v.diastolic || 0), 0) / rows.length)
      ctx.fillText(`Ortalama tansiyon: ${as}/${ad}  (${rows.length} ölçüm)`, PAD + CPAD, y)
    }
    y += headH - 12
    // Satirlar
    for (const v of rows) {
      const dt = new Date(v.dateStr + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
      const baseY = y + 30
      ctx.fillStyle = '#0f172a'
      ctx.font = 'bold 24px sans-serif'
      if (isSugar) {
        const txt = `${dt} ${v.time || ''}  ·  ${v.sugar} mg/dL`
        ctx.fillText(txt.trim(), PAD + CPAD, baseY)
        if (v.sugarContext) {
          const isTok = v.sugarContext.toLowerCase().startsWith('tok')
          ctx.font = 'bold 15px sans-serif'
          const cw = ctx.measureText(isTok ? '🍽️ Tok' : '🕐 Açlık').width + 22
          drawChip(ctx, W - PAD - CPAD - cw, baseY - 21, isTok ? '🍽️ Tok' : '🕐 Açlık', isTok ? '#e0f2fe' : '#fef3c7', isTok ? '#075985' : '#92400e')
        }
      } else {
        ctx.fillText(`${dt} ${v.time || ''}  ·  ${v.systolic}/${v.diastolic}${v.pulse ? `  · nabız ${v.pulse}` : ''}`.trim(), PAD + CPAD, baseY)
      }
      y += ROW
    }
  }

  ctx.fillStyle = '#94a3b8'
  ctx.font = '18px sans-serif'
  ctx.fillText('Diyet Koçu uygulamasından gönderildi', PAD, logicalH - 22)

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

  const logicalH = Math.max(h, 420)
  const { canvas, ctx } = hiDpiCanvas(W, logicalH)
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  ctx.fillStyle = '#f1f5f9'
  ctx.fillRect(0, 0, W, logicalH)

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
  ctx.fillText('Diyet Koçu uygulamasından gönderildi', PAD, logicalH - 22)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Görsel oluşturulamadı'))), 'image/png')
  })
}

// SON ÖLÇÜLER — temiz, okunakli tek gorsel: kilo dahil her olcunun en guncel
// degeri, tarihi ve bir onceki degere gore degisimi (renkli rozet). Token yok.
export async function buildLatestMeasurementImage(userName?: string): Promise<Blob> {
  const measAll = await dietDb.measurements.orderBy('createdAt').toArray()

  // Her alan icin SADECE en guncel deger (yorum/degisim yok — sade ve buyuk)
  const rows = MEASURE_FIELDS_IMG.map((f) => {
    const withVal = measAll.filter((m) => typeof m[f.key] === 'number')
    if (!withVal.length) return null
    const latest = withVal[withVal.length - 1]
    return { f, val: latest[f.key] as number, dateStr: latest.dateStr }
  }).filter((r): r is NonNullable<typeof r> => !!r)

  const BANNER = 96
  const ROW_H = 92
  const ROW_GAP = 12
  const cardTop = PAD + BANNER + 20
  const cardH = rows.length ? 22 + rows.length * (ROW_H + ROW_GAP) + 10 : 90
  const logicalH = cardTop + cardH + 56
  const { canvas, ctx } = hiDpiCanvas(W, logicalH)
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  ctx.fillStyle = '#f6f8fa'
  ctx.fillRect(0, 0, W, logicalH)

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
    ctx.arc(rowX + 13, cy, 10, 0, Math.PI * 2)
    ctx.fill()
    // etiket + tarih (buyuk yazi)
    ctx.fillStyle = '#0f172a'
    ctx.font = 'bold 34px sans-serif'
    ctx.fillText(r.f.label, rowX + 42, cy - 2)
    ctx.fillStyle = '#94a3b8'
    ctx.font = '19px sans-serif'
    ctx.fillText(shortD(r.dateStr), rowX + 42, cy + 26)
    // deger (sagda, cok buyuk)
    ctx.textAlign = 'right'
    ctx.fillStyle = '#0f172a'
    ctx.font = 'bold 46px sans-serif'
    ctx.fillText(`${r.val}${r.f.unit}`, rowX + rowW, cy + 12)
    ctx.textAlign = 'left'
    y += ROW_H + ROW_GAP
  })

  ctx.fillStyle = '#94a3b8'
  ctx.font = '18px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('Diyet Koçu uygulamasından gönderildi', PAD, logicalH - 22)

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

import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import pdfmake from 'pdfmake'
import sharp from 'sharp'
import { iskontoCoz } from '../../../ortak/teklif-hesap'
import { config } from '../config'
import { gorselYolu } from '../gorsel/servis'
import { firmaOku, type Teklif } from './db'

const para = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' })
const adet = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 })
const tarih = (iso: string) => iso.split('-').reverse().join('.')
const iskontoYaz = (metin: string) => {
  const oranlar = (iskontoCoz(metin) ?? []).filter((o) => o > 0)
  return oranlar.length ? '%' + oranlar.map((o) => adet.format(o)).join('+') : ''
}

function sonGecerlilik(t: Teklif): string {
  const d = new Date(`${t.tarih}T12:00:00`)
  d.setDate(d.getDate() + t.gecerlilikGun)
  return tarih(d.toLocaleDateString('sv-SE'))
}

export const logoYolu = () => join(config.gorselKlasor, 'logo.png')

export async function logoKaydet(dosya: Buffer): Promise<void> {
  await sharp(dosya).rotate().resize({ width: 600, height: 300, fit: 'inside', withoutEnlargement: true }).png().toFile(logoYolu())
}

/** WhatsApp'tan gönderilecek sade metin özeti (*kalın* WhatsApp biçimidir). */
export function teklifMetni(t: Teklif): string {
  const firma = firmaOku()
  const h = t.hesap
  const satirlar = [
    `*${firma.ad || 'Fiyat Teklifi'}*`,
    `Teklif No: ${t.no} · ${tarih(t.tarih)}`,
    '',
    `Sayın ${t.musteriAd},`,
    '',
    ...t.kalemler.flatMap((k, i) => {
      const isk = iskontoYaz(k.iskonto)
      return [`${i + 1}) ${k.ad}`, `    ${adet.format(k.miktar)} × ${para.format(k.birimFiyat)}${isk ? ` (isk. ${isk})` : ''} = ${para.format(h.kalemler[i]!.net)}`]
    }),
    '',
    ...(h.iskontoToplam > 0 ? [`Ara toplam: ${para.format(h.araToplam)}`, `İskonto: -${para.format(h.iskontoToplam)}`] : []),
    `Toplam (KDV hariç): ${para.format(h.matrah)}`,
    ...h.kdvler.map((k) => `KDV %${adet.format(k.oran)}: ${para.format(k.tutar)}`),
    `*GENEL TOPLAM: ${para.format(h.genelToplam)}*`,
    '',
    `Teklif ${sonGecerlilik(t)} tarihine kadar geçerlidir.`,
    ...(t.notu ? ['', t.notu] : []),
    ...(firma.telefon ? ['', `${firma.ad} · ${firma.telefon}`] : []),
  ]
  return satirlar.join('\n')
}

const fontlar = join(dirname(createRequire(import.meta.url).resolve('pdfmake/package.json')), 'fonts/Roboto')
pdfmake.setFonts({
  Roboto: {
    normal: join(fontlar, 'Roboto-Regular.ttf'),
    bold: join(fontlar, 'Roboto-Medium.ttf'),
    italics: join(fontlar, 'Roboto-Italic.ttf'),
    bolditalics: join(fontlar, 'Roboto-MediumItalic.ttf'),
  },
})

/** PDF yalnızca JPEG/PNG gömebilir; WebP ürün görselini küçük bir JPEG'e çevirir. */
async function urunGorseli(urunId: number | null): Promise<string | null> {
  if (urunId === null || !existsSync(gorselYolu(urunId, 'kart'))) return null
  const jpeg = await sharp(gorselYolu(urunId, 'kart')).resize(160, 160, { fit: 'cover' }).flatten({ background: '#fff' }).jpeg({ quality: 80 }).toBuffer()
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`
}

const GRI = '#64748b'
const CIZGI = '#e2e8f0'

/** Şirket logolu, ürün resimli kurumsal teklif PDF'i. */
export async function teklifPdf(t: Teklif): Promise<Buffer> {
  const firma = firmaOku()
  const h = t.hesap
  const gorseller = await Promise.all(t.kalemler.map((k) => urunGorseli(k.urunId)))
  const iskontoVar = t.kalemler.some((k) => iskontoYaz(k.iskonto))
  const sag = (text: string, ek: object = {}) => ({ text, alignment: 'right', ...ek })

  const basliklar = ['', 'Ürün', sag('Miktar'), sag('Birim Fiyat'), ...(iskontoVar ? [sag('İskonto')] : []), sag('Tutar')].map((b) =>
    typeof b === 'string' ? { text: b, style: 'baslik' } : { ...b, style: 'baslik' },
  )
  const satirlar = t.kalemler.map((k, i) => [
    gorseller[i] ? { image: gorseller[i], fit: [42, 42] } : { text: '' },
    { stack: [{ text: k.ad, bold: true }, ...(k.kod ? [{ text: k.kod, color: GRI, fontSize: 8 }] : [])], margin: [0, 6, 0, 0] },
    sag(adet.format(k.miktar), { margin: [0, 12, 0, 0] }),
    sag(para.format(k.birimFiyat), { margin: [0, 12, 0, 0] }),
    ...(iskontoVar ? [sag(iskontoYaz(k.iskonto), { margin: [0, 12, 0, 0] })] : []),
    sag(para.format(h.kalemler[i]!.net), { bold: true, margin: [0, 12, 0, 0] }),
  ])

  const toplamlar: [string, string, object?][] = [
    ...(h.iskontoToplam > 0
      ? ([['Ara toplam', para.format(h.araToplam)], [`İskonto${iskontoYaz(t.genelIskonto) ? ` (genel ${iskontoYaz(t.genelIskonto)} dahil)` : ''}`, `-${para.format(h.iskontoToplam)}`]] as [string, string][])
      : []),
    ['Toplam (KDV hariç)', para.format(h.matrah)],
    ...h.kdvler.map((k): [string, string] => [`KDV %${adet.format(k.oran)}`, para.format(k.tutar)]),
    ['GENEL TOPLAM', para.format(h.genelToplam), { bold: true, fontSize: 12 }],
  ]

  return pdfmake
    .createPdf({
      pageSize: 'A4',
      pageMargins: [36, 36, 36, 48],
      info: { title: `Teklif ${t.no}`, author: firma.ad },
      defaultStyle: { font: 'Roboto', fontSize: 9.5, color: '#0f172a' },
      styles: { baslik: { bold: true, fontSize: 8.5, color: GRI } },
      footer: (sayfa: number, toplam: number) => ({
        text: `${[firma.ad, firma.telefon, firma.eposta].filter(Boolean).join(' · ')}     Sayfa ${sayfa} / ${toplam}`,
        alignment: 'center', fontSize: 8, color: GRI, margin: [36, 16, 36, 0],
      }),
      content: [
        {
          columns: [
            existsSync(logoYolu()) ? { image: logoYolu(), fit: [150, 64], width: 160 } : { text: firma.ad, fontSize: 18, bold: true, width: '*' },
            {
              width: '*', alignment: 'right',
              stack: [
                { text: 'FİYAT TEKLİFİ', fontSize: 16, bold: true },
                { text: `No: ${t.no}`, margin: [0, 4, 0, 0] },
                { text: `Tarih: ${tarih(t.tarih)}` },
                { text: `Geçerlilik: ${sonGecerlilik(t)}` },
              ],
            },
          ],
        },
        {
          margin: [0, 18, 0, 14],
          columns: [
            {
              width: '*',
              stack: [{ text: 'SAYIN', style: 'baslik' }, { text: t.musteriAd, bold: true, fontSize: 11, margin: [0, 2, 0, 0] }, ...[t.musteriAdres, t.musteriTelefon].filter(Boolean).map((s) => ({ text: s, color: GRI }))],
            },
            {
              width: '*', alignment: 'right',
              stack: [
                ...(existsSync(logoYolu()) && firma.ad ? [{ text: firma.ad, bold: true }] : []),
                ...[firma.adres, firma.telefon, firma.eposta, firma.vergi && `Vergi: ${firma.vergi}`].filter(Boolean).map((s) => ({ text: s, color: GRI })),
              ],
            },
          ],
        },
        {
          table: { headerRows: 1, dontBreakRows: true, widths: [44, '*', 'auto', 'auto', ...(iskontoVar ? ['auto'] : []), 'auto'], body: [basliklar, ...satirlar] },
          layout: {
            hLineWidth: (i: number) => (i === 0 ? 0 : 0.7),
            vLineWidth: () => 0,
            hLineColor: () => CIZGI,
            paddingTop: () => 4, paddingBottom: () => 4,
          },
        },
        {
          margin: [0, 12, 0, 0], unbreakable: true,
          columns: [
            { width: '*', stack: [{ text: t.kdvDahil ? 'Birim fiyatlara KDV dahildir.' : 'Birim fiyatlara KDV dahil değildir.', color: GRI }, ...(t.notu ? [{ text: t.notu, margin: [0, 8, 12, 0] }] : [])] },
            {
              width: 220,
              table: { widths: ['*', 'auto'], body: toplamlar.map(([ad, tutar, stil]) => [{ text: ad, ...stil }, sag(tutar, stil)]) },
              layout: { hLineWidth: (i: number, dugum: { table: { body: unknown[] } }) => (i === dugum.table.body.length - 1 ? 1 : 0), vLineWidth: () => 0, hLineColor: () => '#0f172a', paddingTop: () => 3, paddingBottom: () => 3 },
            },
          ],
        },
      ],
    })
    .getBuffer()
}

// Ekran goruntusunden konum: Google Haritalar ekran goruntusundeki YAZILI
// koordinati yapay zeka (Claude) ile okuyup enlem/boylama cevirir.
import type { GpsPoint } from '../types'
import { parseLocationText } from './location'

// Varsayilan model: kucuk/hizli/ucuz (goruntudeki sayiyi okumak icin yeterli)
export const AI_LOCATION_MODEL = 'claude-haiku-4-5-20251001'

function parseDataUrl(dataUrl: string): { mediaType: string; base64: string } | null {
  const HEAD = 'data:'
  if (!dataUrl.startsWith(HEAD)) return null
  const i = dataUrl.indexOf(';base64,')
  if (i < 0) return null
  const mediaType = dataUrl.slice(HEAD.length, i)
  const base64 = dataUrl.slice(i + ';base64,'.length)
  if (!mediaType || !base64) return null
  return { mediaType, base64 }
}

// Goruntudeki koordinati dondurur; bulunamazsa null.
export async function extractCoordsFromImage(
  dataUrl: string,
  apiKey: string,
  model: string = AI_LOCATION_MODEL
): Promise<GpsPoint | null> {
  if (!apiKey) throw new Error('Önce Ayarlar bölümünden yapay zeka API anahtarınızı girin.')
  const img = parseDataUrl(dataUrl)
  if (!img || !img.mediaType.startsWith('image/')) throw new Error('Geçersiz görüntü.')

  const mod = await import('@anthropic-ai/sdk')
  const Anthropic = mod.default
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })

  const prompt =
    'Bu bir Google Haritalar ekran görüntüsü. Görüntüde AÇIKÇA YAZILI olan GPS ' +
    'koordinatını (enlem, boylam) bul. SADECE "enlem,boylam" biçiminde yanıt ver ' +
    '(örnek: 40.786533,30.373290). Kesinlikle tahmin etme; ekranda yazılı bir ' +
    'koordinat yoksa yalnızca "YOK" yaz.'

  const response = await client.messages.create({
    model,
    max_tokens: 60,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: img.mediaType as 'image/jpeg', data: img.base64 }
          },
          { type: 'text', text: prompt }
        ]
      }
    ]
  })

  const text = response.content
    .map((b) => (b.type === 'text' ? b.text : ''))
    .join(' ')
    .trim()

  return parseLocationText(text)
}

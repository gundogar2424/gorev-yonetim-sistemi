// Büyük katalog PDF'lerini işlemek için: PDF'in METNİNİ sayfa sayfa çıkarır.
// Metin göndermek, sayfa görüntüsü göndermekten çok daha az token harcar; böylece
// kalın kataloglar da (parça parça) okunabilir. Metin çıkmazsa (taranmış/resim
// tabanlı PDF) çağıran taraf fotoğraf yöntemine yönlendirir.
import * as pdfjs from 'pdfjs-dist'
// Vite: worker'ı ayrı dosya olarak paketle ve URL'ini ver
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export interface PdfText {
  pages: number
  text: string // tüm sayfaların metni (sayfa ayraçlı)
}

function dataUrlToUint8(dataUrl: string): Uint8Array {
  const b64 = dataUrl.replace(/^data:[^;]+;base64,/, '')
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return arr
}

export async function extractPdfText(dataUrl: string): Promise<PdfText> {
  const data = dataUrlToUint8(dataUrl)
  const doc = await pdfjs.getDocument({ data }).promise
  const parts: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const line = content.items
      .map((it) => ('str' in it ? (it as { str: string }).str : ''))
      .join(' ')
      .replace(/[ \t]+/g, ' ')
      .trim()
    if (line) parts.push(line)
  }
  await doc.destroy()
  return { pages: doc.numPages, text: parts.join('\n') }
}

// Uzun metni, satır bütünlüğünü koruyarak ~maxChars büyüklüğünde parçalara böler.
export function chunkText(text: string, maxChars = 6000): string[] {
  const lines = text.split('\n')
  const chunks: string[] = []
  let cur = ''
  for (const line of lines) {
    if (cur.length + line.length + 1 > maxChars && cur) {
      chunks.push(cur)
      cur = ''
    }
    // Tek satır çok uzunsa (nadiren) parçala
    if (line.length > maxChars) {
      for (let i = 0; i < line.length; i += maxChars) chunks.push(line.slice(i, i + maxChars))
    } else {
      cur += (cur ? '\n' : '') + line
    }
  }
  if (cur) chunks.push(cur)
  return chunks
}

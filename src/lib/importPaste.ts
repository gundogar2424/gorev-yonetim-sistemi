// Toplu veri ekleme: Excel/CSV'den kopyalanan tabloyu akilli algilama.
// Tab veya noktali virgul/virgul ile ayrilmis satirlari isler, basliklari
// taniyarak alanlari (firma, isim, telefon, il, ilce...) eslestirir.
import type { Customer } from '../types'

export interface ParsedRow {
  raw: string[]
  customer: Partial<Customer>
}

// Sutun basligi -> musteri alani eslestirme sozlugu (kucuk harf, TR uyumlu)
const HEADER_MAP: Record<string, keyof Customer> = {
  firma: 'companyTitle',
  'firma unvani': 'companyTitle',
  'firma adi': 'companyTitle',
  unvan: 'companyTitle',
  sirket: 'companyTitle',
  'yetkili': 'contactName',
  'yetkili adi': 'contactName',
  'ad soyad': 'contactName',
  'adi soyadi': 'contactName',
  isim: 'contactName',
  'isim soyisim': 'contactName',
  gorev: 'role',
  gorevi: 'role',
  unvani: 'role',
  telefon: 'phone',
  tel: 'phone',
  gsm: 'phone',
  'cep': 'phone',
  'telefon no': 'phone',
  il: 'city',
  sehir: 'city',
  ilce: 'district',
  sektor: 'sector',
  notlar: 'notes',
  not: 'notes',
  'dogum tarihi': 'birthDate'
}

function normalize(s: string): string {
  return s
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
}

function detectDelimiter(line: string): string {
  if (line.includes('\t')) return '\t'
  if (line.includes(';')) return ';'
  if (line.includes(',')) return ','
  return '\t'
}

// Bir hucrenin telefon numarasi olup olmadigini anla
function looksLikePhone(v: string): boolean {
  const digits = v.replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 13
}

export interface ParseResult {
  rows: ParsedRow[]
  headerDetected: boolean
  columns: (keyof Customer | null)[]
}

export function parsePaste(text: string): ParseResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0)

  if (lines.length === 0) return { rows: [], headerDetected: false, columns: [] }

  const delim = detectDelimiter(lines[0])
  const matrix = lines.map((l) => l.split(delim).map((c) => c.trim()))

  // Ilk satir baslik mi? Hucrelerin cogu HEADER_MAP'te varsa evet.
  const first = matrix[0]
  const known = first.filter((c) => HEADER_MAP[normalize(c)]).length
  const headerDetected = known >= 2 || (known >= 1 && first.length <= 3)

  let columns: (keyof Customer | null)[]
  let dataRows: string[][]

  if (headerDetected) {
    columns = first.map((c) => HEADER_MAP[normalize(c)] ?? null)
    dataRows = matrix.slice(1)
  } else {
    // Baslik yoksa: konuma gore akilli tahmin
    columns = guessColumns(matrix)
    dataRows = matrix
  }

  const rows: ParsedRow[] = dataRows.map((cells) => {
    const customer: Partial<Customer> = {}
    cells.forEach((value, i) => {
      const field = columns[i]
      if (!field || !value) return
      assignField(customer, field, value)
    })
    return { raw: cells, customer }
  })

  return { rows, headerDetected, columns }
}

// Basliksiz veride sutunlari icerikten tahmin et
function guessColumns(matrix: string[][]): (keyof Customer | null)[] {
  const colCount = Math.max(...matrix.map((r) => r.length))
  const cols: (keyof Customer | null)[] = new Array(colCount).fill(null)
  let phoneAssigned = false

  for (let c = 0; c < colCount; c++) {
    const sample = matrix.slice(0, 5).map((r) => r[c] ?? '')
    if (!phoneAssigned && sample.some(looksLikePhone)) {
      cols[c] = 'phone'
      phoneAssigned = true
    }
  }
  // Telefon disindaki ilk metin sutunu firma, ikincisi yetkili adi say
  const textCols = cols
    .map((v, i) => ({ v, i }))
    .filter((x) => x.v === null)
    .map((x) => x.i)
  if (textCols[0] !== undefined) cols[textCols[0]] = 'companyTitle'
  if (textCols[1] !== undefined) cols[textCols[1]] = 'contactName'
  if (textCols[2] !== undefined) cols[textCols[2]] = 'city'
  if (textCols[3] !== undefined) cols[textCols[3]] = 'district'
  return cols
}

function assignField(customer: Partial<Customer>, field: keyof Customer, value: string) {
  switch (field) {
    case 'phone':
      customer.phone = cleanPhone(value)
      break
    default:
      // metin alanlari
      ;(customer as Record<string, unknown>)[field] = value
  }
}

export function cleanPhone(v: string): string {
  let digits = v.replace(/[^\d+]/g, '')
  // 0 ile basliyorsa Turkiye icin +90 formatina cevir
  if (digits.startsWith('0')) digits = '+9' + digits
  else if (digits.startsWith('90')) digits = '+' + digits
  else if (digits.startsWith('5') && digits.length === 10) digits = '+90' + digits
  return digits
}

// Eksiksiz bir Customer nesnesine cevir (varsayilanlarla)
export function toCustomer(partial: Partial<Customer>, now: number): Customer {
  return {
    photo: partial.photo,
    companyTitle: partial.companyTitle?.trim() || '(Isimsiz firma)',
    contactName: partial.contactName?.trim() || '',
    role: partial.role?.trim() || '',
    phone: partial.phone?.trim() || '',
    city: partial.city?.trim() || '',
    district: partial.district?.trim() || '',
    gps: partial.gps,
    sector: partial.sector?.trim() || '',
    areaM2: partial.areaM2,
    employeeCount: partial.employeeCount,
    riskScore: partial.riskScore,
    ownership: partial.ownership ?? 'bilinmiyor',
    paymentType: partial.paymentType ?? 'diger',
    term: partial.term,
    notes: partial.notes,
    machinePark: partial.machinePark,
    birthDate: partial.birthDate,
    createdAt: now,
    updatedAt: now
  }
}

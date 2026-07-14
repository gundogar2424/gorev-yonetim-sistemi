// Stok Takip için AYRI bir Dexie (IndexedDB) veritabanı.
// CRM ve Diyet Koçu veritabanlarına hiç dokunmaz; şeması bağımsızdır.
import Dexie, { type Table } from 'dexie'
import type { Product, StockMove, StokSettings } from './types'

export class StokDB extends Dexie {
  products!: Table<Product, number>
  moves!: Table<StockMove, number>
  settings!: Table<StokSettings, number>

  constructor() {
    super('stok-takip')
    this.version(1).stores({
      // Ada/firmaya/kategoriye göre sorgulanabilir alanlar indexlenir
      products: '++id, name, company, category, code, updatedAt',
      moves: '++id, productId, createdAt',
      settings: '++id'
    })
  }
}

export const stokDb = new StokDB()

// ---- Ürünler (SALT OKUNUR sorgular; yazma ayrı fonksiyonlarda) ----
export function listProducts(): Promise<Product[]> {
  return stokDb.products.orderBy('updatedAt').reverse().toArray()
}

export function getProduct(id: number): Promise<Product | undefined> {
  return stokDb.products.get(id)
}

export async function addProduct(p: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
  const now = Date.now()
  // Elle eklenen ürün varsayılan olarak AKTİF (benim sattığım ürün)
  const id = (await stokDb.products.add({
    active: p.active ?? true,
    source: p.source ?? 'manual',
    ...p,
    createdAt: now,
    updatedAt: now
  })) as number
  // İlk stok girişini hareket olarak da kaydet (0 değilse)
  if (p.qty) {
    await stokDb.moves.add({ productId: id, delta: p.qty, reason: 'giris', note: 'İlk kayıt', createdAt: now })
  }
  return id
}

// Birden çok ürünü tek seferde ekler (içe aktarma). Aynı ada+firmaya sahip
// mevcut ürünler ATLANIR (tekrar eklenmesin diye); kaç tanesinin eklendiğini döner.
export async function addProductsMany(
  items: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>[]
): Promise<{ added: number; skipped: number }> {
  const existing = await stokDb.products.toArray()
  const key = (name?: string, company?: string) => `${(name || '').trim().toLowerCase()}|${(company || '').trim().toLowerCase()}`
  const seen = new Set(existing.map((e) => key(e.name, e.company)))
  let added = 0
  let skipped = 0
  const now = Date.now()
  for (const it of items) {
    const k = key(it.name, it.company)
    if (!it.name?.trim() || seen.has(k)) {
      skipped++
      continue
    }
    seen.add(k)
    const id = (await stokDb.products.add({
      active: it.active ?? false,
      source: it.source ?? 'catalog',
      ...it,
      createdAt: now,
      updatedAt: now
    })) as number
    if (it.qty) {
      await stokDb.moves.add({ productId: id, delta: it.qty, reason: 'giris', note: 'İçe aktarma', createdAt: now })
    }
    added++
  }
  return { added, skipped }
}

// Basit metin normalize (Türkçe uyumlu; eşleştirme için)
function norm(s?: string): string {
  return (s || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// Kullanıcının "aktif sattığım ürünler" listesini (her satır bir ürün adı ya da
// kodu) katalogla eşleştirir ve eşleşenleri AKTİF yapar. Eşleşme: kod birebir,
// ya da ad birebir/içeriyor. Kaç ürünün aktifleştiğini ve eşleşmeyen satırları döner.
export async function setActiveByList(text: string): Promise<{ matched: number; unmatched: string[] }> {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length === 0) return { matched: 0, unmatched: [] }

  const products = await stokDb.products.toArray()
  const matchedIds = new Set<number>()
  const unmatched: string[] = []

  for (const line of lines) {
    const nLine = norm(line)
    const codeRaw = line.trim().toLocaleLowerCase('tr-TR')
    // 1) Kod birebir eşleşme
    let hit = products.find((p) => p.code && p.code.trim().toLocaleLowerCase('tr-TR') === codeRaw)
    // 2) Ad birebir
    if (!hit) hit = products.find((p) => norm(p.name) === nLine)
    // 3) Ad içeriyor (iki yönlü)
    if (!hit && nLine.length >= 3) {
      hit = products.find((p) => {
        const nName = norm(p.name)
        return nName.includes(nLine) || nLine.includes(nName)
      })
    }
    if (hit?.id != null) matchedIds.add(hit.id)
    else unmatched.push(line)
  }

  const now = Date.now()
  for (const id of matchedIds) {
    await stokDb.products.update(id, { active: true, updatedAt: now })
  }
  return { matched: matchedIds.size, unmatched }
}

export async function updateProduct(id: number, patch: Partial<Product>) {
  await stokDb.products.update(id, { ...patch, updatedAt: Date.now() })
}

export async function deleteProduct(id: number) {
  await stokDb.products.delete(id)
  const rows = await stokDb.moves.where('productId').equals(id).toArray()
  await stokDb.moves.bulkDelete(rows.map((r) => r.id!))
}

// Stok giriş/çıkış: adedi delta kadar değiştirir ve hareketi kaydeder.
// Adet 0'ın altına inmez.
export async function changeStock(id: number, delta: number, reason: StockMove['reason'], note?: string) {
  const p = await stokDb.products.get(id)
  if (!p) return
  const next = Math.max(0, (p.qty || 0) + delta)
  const applied = next - (p.qty || 0) // gerçekte uygulanan fark (0 tabanına takıldıysa farklı olabilir)
  await stokDb.products.update(id, { qty: next, updatedAt: Date.now() })
  if (applied !== 0) {
    await stokDb.moves.add({ productId: id, delta: applied, reason, note, createdAt: Date.now() })
  }
}

// Bir ürünün stok hareketleri (yeniden eskiye)
export function listMoves(productId: number): Promise<StockMove[]> {
  return stokDb.moves.where('productId').equals(productId).reverse().sortBy('createdAt')
}

// ---- Ayarlar ----
// SALT OKUNUR — useLiveQuery içinde güvenli (DB'ye yazmaz).
export async function readStokSettings(): Promise<StokSettings> {
  const s = await stokDb.settings.toCollection().first()
  return s ?? { model: 'claude-opus-4-8', currency: '₺' }
}

export async function saveStokSettings(patch: Partial<StokSettings>) {
  const s = await stokDb.settings.toCollection().first()
  if (s?.id != null) {
    await stokDb.settings.update(s.id, patch)
  } else {
    await stokDb.settings.add({ model: 'claude-opus-4-8', currency: '₺', ...patch })
  }
}

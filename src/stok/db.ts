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
  const id = (await stokDb.products.add({ ...p, createdAt: now, updatedAt: now })) as number
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
    const id = (await stokDb.products.add({ ...it, createdAt: now, updatedAt: now })) as number
    if (it.qty) {
      await stokDb.moves.add({ productId: id, delta: it.qty, reason: 'giris', note: 'İçe aktarma', createdAt: now })
    }
    added++
  }
  return { added, skipped }
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

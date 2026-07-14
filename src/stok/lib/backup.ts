// Tüm stok verisini (fotoğraflar dahil) tek JSON dosyasına yedekler ve geri yükler.
import { stokDb } from '../db'

interface BackupData {
  app: 'stok-takip'
  version: number
  exportedAt: number
  products: unknown[]
  moves: unknown[]
  settings: unknown[]
}

export async function exportBackup(): Promise<void> {
  const [products, moves, settings] = await Promise.all([
    stokDb.products.toArray(),
    stokDb.moves.toArray(),
    stokDb.settings.toArray()
  ])
  const data: BackupData = {
    app: 'stok-takip',
    version: 1,
    exportedAt: Date.now(),
    products,
    moves,
    settings
  }
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const d = new Date()
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  a.href = url
  a.download = `stok-yedek-${stamp}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Yedeği geri yükler. replace=true ise mevcut veriyi TAMAMEN değiştirir.
export async function importBackup(file: File, replace: boolean): Promise<{ products: number }> {
  const text = await file.text()
  const data = JSON.parse(text) as Partial<BackupData>
  if (data.app !== 'stok-takip' || !Array.isArray(data.products)) {
    throw new Error('Bu dosya bir Stok Takip yedeği değil.')
  }
  await stokDb.transaction('rw', stokDb.products, stokDb.moves, stokDb.settings, async () => {
    if (replace) {
      await Promise.all([stokDb.products.clear(), stokDb.moves.clear(), stokDb.settings.clear()])
    }
    // id'leri koruyarak yaz (bulkPut = varsa üzerine yazar)
    await stokDb.products.bulkPut(data.products as never[])
    if (Array.isArray(data.moves)) await stokDb.moves.bulkPut(data.moves as never[])
    if (Array.isArray(data.settings)) await stokDb.settings.bulkPut(data.settings as never[])
  })
  return { products: (data.products as unknown[]).length }
}

// Yedekleme ve geri yukleme.
// Fotograflar dahil tum veriyi tek bir JSON dosyasina aktarir/geri yukler.
import { db, getSettings } from '../db'
import type { BackupFile } from '../types'

export async function exportBackup(): Promise<BackupFile> {
  const [customers, settings, cities] = await Promise.all([
    db.customers.toArray(),
    getSettings(),
    db.cities.toArray()
  ])
  return {
    version: 1,
    exportedAt: Date.now(),
    customers,
    settings,
    cities
  }
}

export function downloadBackup(backup: BackupFile) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const d = new Date(backup.exportedAt)
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`
  a.href = url
  a.download = `saha-crm-yedek_${stamp}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export interface RestoreResult {
  customers: number
  cities: number
}

// mode: 'replace' tum veriyi siler ve yedekle degistirir
//       'merge' mevcut veriye ekler (yeni id ile)
export async function restoreBackup(
  backup: BackupFile,
  mode: 'replace' | 'merge'
): Promise<RestoreResult> {
  if (!backup || backup.version !== 1 || !Array.isArray(backup.customers)) {
    throw new Error('Gecersiz yedek dosyasi.')
  }

  return db.transaction('rw', db.customers, db.settings, db.cities, async () => {
    if (mode === 'replace') {
      await Promise.all([db.customers.clear(), db.settings.clear(), db.cities.clear()])
    }

    const customers = backup.customers.map((c) => {
      const { id: _omit, ...rest } = c
      void _omit
      return rest
    })
    await db.customers.bulkAdd(customers as never)

    if (backup.cities?.length) {
      for (const city of backup.cities) {
        const { id: _cid, ...rest } = city
        void _cid
        const existing = await db.cities.where('name').equals(rest.name).first()
        if (existing) {
          await db.cities.update(existing.id!, { districts: rest.districts })
        } else {
          await db.cities.add(rest as never)
        }
      }
    }

    if (backup.settings) {
      const { id: _sid, ...rest } = backup.settings
      void _sid
      const cur = await db.settings.toCollection().first()
      if (cur) await db.settings.update(cur.id!, rest)
      else await db.settings.add(rest as never)
    }

    return { customers: customers.length, cities: backup.cities?.length ?? 0 }
  })
}

export function parseBackupFile(text: string): BackupFile {
  const data = JSON.parse(text)
  if (typeof data !== 'object' || data === null || data.version !== 1) {
    throw new Error('Bu dosya gecerli bir Saha CRM yedegi degil.')
  }
  return data as BackupFile
}

// OTOMATIK YEDEK.
//
// Elle yedek almak unutuluyor; telefon degisince ya da uygulama silinince
// defter gidiyor. Bu yuzden uygulama her acilista guncel defteri telefona
// DOSYA olarak yaziyor. Veri degismediyse yazmaz (bosuna dosya/asinma yok).
//
// Nereye yazilir: once Belgeler (Documents) denenir, olmazsa dis depolama,
// o da olmazsa uygulamanin kendi klasoru. Yazilan yol Ayarlar'da gosterilir
// ki dosyayi bulabilesin.
import { buildBackup } from './backup'
import { readTmSettings, saveTmSettings, tmDb } from '../db'

const KLASOR = 'Termomiks'
const DOSYA = 'termomiks-yedek.json'
const SAKLANAN_GUNLUK = 5 // Tarihli kopyalardan en fazla bu kadari tutulur

async function native(): Promise<boolean> {
  try {
    const { Capacitor } = await import('@capacitor/core')
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

// Defterin "parmak izi": tarif sayisi + en son guncelleme zamani.
// Ayni kaldiysa yeniden yedeklemeye gerek yok.
async function imza(): Promise<string> {
  const hepsi = await tmDb.recipes.toArray()
  const enSon = hepsi.reduce((m, r) => Math.max(m, r.updatedAt ?? 0), 0)
  return `${hepsi.length}:${enSon}`
}

export interface YedekSonucu {
  yol: string
  zaman: number
  atlandi?: boolean
}

export async function otomatikYedekle(zorla = false): Promise<YedekSonucu | null> {
  if (!(await native())) return null

  const ayar = await readTmSettings()
  if (!zorla && ayar.autoBackup === false) return null

  const suanki = await imza()
  if (suanki.startsWith('0:')) return null // Bos defteri yedekleme
  if (!zorla && suanki === ayar.lastAutoBackupSig) {
    return { yol: ayar.lastAutoBackupPath, zaman: ayar.lastAutoBackupAt, atlandi: true }
  }

  const veri = JSON.stringify(await buildBackup())
  const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')

  // Once en erisilebilir yeri dene; olmazsa sirayla geri cekil.
  const hedefler = [Directory.Documents, Directory.External, Directory.Data]
  for (const dizin of hedefler) {
    try {
      await Filesystem.mkdir({ path: KLASOR, directory: dizin, recursive: true }).catch(() => {})
      await Filesystem.writeFile({
        path: `${KLASOR}/${DOSYA}`,
        data: veri,
        directory: dizin,
        encoding: Encoding.UTF8
      })
      // Tarihli kopya: yanlislikla silinen bir tarif icin geri donus noktasi
      const g = new Date()
      const damga = `${g.getFullYear()}-${String(g.getMonth() + 1).padStart(2, '0')}-${String(g.getDate()).padStart(2, '0')}`
      await Filesystem.writeFile({
        path: `${KLASOR}/termomiks-yedek-${damga}.json`,
        data: veri,
        directory: dizin,
        encoding: Encoding.UTF8
      }).catch(() => {})
      await eskileriSil(dizin)

      const uri = await Filesystem.getUri({ path: `${KLASOR}/${DOSYA}`, directory: dizin }).catch(() => null)
      const yol = uri?.uri ?? `${dizin}/${KLASOR}/${DOSYA}`
      const zaman = Date.now()
      await saveTmSettings({ lastAutoBackupAt: zaman, lastAutoBackupPath: yol, lastAutoBackupSig: suanki })
      return { yol, zaman }
    } catch {
      // Bu dizine yazilamadi — sonrakini dene
    }
  }
  return null
}

// Tarihli kopyalardan yalnizca son birkacini tut
async function eskileriSil(dizin: unknown): Promise<void> {
  try {
    const { Filesystem } = await import('@capacitor/filesystem')
    const liste = await Filesystem.readdir({ path: KLASOR, directory: dizin as never })
    const tarihliler = liste.files
      .map((f) => (typeof f === 'string' ? f : f.name))
      .filter((ad) => /^termomiks-yedek-\d{4}-\d{2}-\d{2}\.json$/.test(ad))
      .sort()
    for (const ad of tarihliler.slice(0, Math.max(0, tarihliler.length - SAKLANAN_GUNLUK))) {
      await Filesystem.deleteFile({ path: `${KLASOR}/${ad}`, directory: dizin as never }).catch(() => {})
    }
  } catch {
    /* listelenemedi — onemli degil */
  }
}

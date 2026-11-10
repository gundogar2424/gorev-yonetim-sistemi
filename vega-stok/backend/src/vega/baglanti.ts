import sql from 'mssql'
import { config } from '../config'

/**
 * Vega MS SQL bağlantısı — SALT OKUNUR.
 *
 * Vega'yı yormamak / kilitlememek için üç katmanlı koruma:
 *  1. SQL tarafı (asıl güvence): kullanıcı yalnızca db_datareader rolündedir.
 *  2. Oturum tarafı: READ UNCOMMITTED + LOCK_TIMEOUT + DEADLOCK_PRIORITY LOW;
 *     bir kilide takılırsak Vega değil BİZ vazgeçeriz.
 *  3. Kod tarafı: SELECT olmayan her metin daha gönderilmeden reddedilir.
 * Havuz en fazla 3 bağlantı açar; Vega'nın bağlantı kotasını tüketmez.
 */

let havuz: Promise<sql.ConnectionPool> | null = null

function havuzAl(): Promise<sql.ConnectionPool> {
  if (!havuz) {
    const v = config.vega
    if (!v.server || !v.database) {
      return Promise.reject(new Error('Vega bağlantı ayarları eksik (.env dosyasını doldurun)'))
    }
    const p = new sql.ConnectionPool({
      server: v.server,
      // Adlandırılmış instance verilmişse port kullanılmaz (SQL Browser çözer)
      ...(v.instance ? {} : { port: v.port }),
      database: v.database,
      user: v.user,
      password: v.password,
      connectionTimeout: 8000,
      requestTimeout: 20000,
      pool: { max: 3, min: 0, idleTimeoutMillis: 60000 },
      options: {
        ...(v.instance ? { instanceName: v.instance } : {}),
        encrypt: false, // yerel ağ; eski SQL Server sürümleriyle uyum
        trustServerCertificate: true,
        readOnlyIntent: true,
        appName: 'vega-stok-okuyucu', // Vega sunucusunda Activity Monitor'de bu adla görünür
      },
    })
    havuz = p.connect().catch((hata) => {
      havuz = null // sonraki denemede yeniden bağlan
      throw hata
    })
    p.on('error', () => {
      havuz = null
    })
  }
  return havuz
}

const YASAK =
  /\b(INSERT|UPDATE|DELETE|MERGE|DROP|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE|INTO|GRANT|REVOKE|DENY|BACKUP|RESTORE|SHUTDOWN)\b/i

/** Metin tek bir SELECT (veya WITH ... SELECT) değilse hata fırlatır. */
export function saltOkunurDogrula(metin: string): void {
  const yalin = metin
    .replace(/--.*$/gm, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/'(?:[^']|'')*'/g, "''") // metin sabitlerinin içi denetlenmez
    .trim()
  if (!/^(SELECT|WITH)\b/i.test(yalin)) throw new Error('Vega: yalnızca SELECT sorgusu çalıştırılabilir')
  if (yalin.includes(';')) throw new Error('Vega: birden fazla ifade çalıştırılamaz')
  const yasak = YASAK.exec(yalin)
  if (yasak) throw new Error(`Vega: yasaklı ifade "${yasak[0].toUpperCase()}"`)
}

type Parametre = string | number | Date | null

export async function vegaSorgu<T>(metin: string, parametreler: Record<string, Parametre> = {}): Promise<T[]> {
  saltOkunurDogrula(metin)
  const istek = (await havuzAl()).request()
  for (const [ad, deger] of Object.entries(parametreler)) istek.input(ad, deger)
  const sonuc = await istek.query<T>(
    `SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED; SET LOCK_TIMEOUT 3000; SET DEADLOCK_PRIORITY LOW;\n${metin}`,
  )
  return sonuc.recordset
}

export async function vegaKapat(): Promise<void> {
  const p = havuz
  havuz = null
  if (p) await p.then((h) => h.close()).catch(() => {})
}

// .env dosyasını yükler (Node 22 yerleşik) ve ayarları tek yerden verir.
try {
  process.loadEnvFile()
} catch {
  // .env yoksa ortam değişkenleriyle devam edilir
}

const e = process.env
const sayi = (v: string | undefined, varsayilan: number) => {
  const n = Number(v)
  return v && Number.isFinite(n) ? n : varsayilan
}

export const config = {
  port: sayi(e.PORT, 4000),
  yerelDb: e.YEREL_DB || './veri/stok.sqlite',
  hizliTurSn: sayi(e.ESITLEME_HIZLI_SN, 30),
  tamTurDk: sayi(e.ESITLEME_TAM_DK, 15),
  vega: {
    server: e.VEGA_SQL_SERVER || '',
    instance: e.VEGA_SQL_INSTANCE || '',
    port: sayi(e.VEGA_SQL_PORT, 1433),
    database: e.VEGA_SQL_DATABASE || '',
    user: e.VEGA_SQL_USER || '',
    password: e.VEGA_SQL_PASSWORD || '',
    firma: e.VEGA_FIRMA || '0101',
    donem: e.VEGA_DONEM || '0001',
  },
}

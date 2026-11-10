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

// Demo modu ayrı veritabanı/klasör kullanır; gerçek önbelleğe örnek veri karışmaz
const demo = e.DEMO === '1' || process.argv.includes('--demo')

export const config = {
  port: sayi(e.PORT, 4000),
  yerelDb: demo ? './veri/demo/stok.sqlite' : e.YEREL_DB || './veri/stok.sqlite',
  gorselKlasor: demo ? './veri/demo/gorseller' : e.GORSEL_KLASOR || './veri/gorseller',
  /** `npm run demo`: Vega'ya bağlanmadan örnek ürünlerle çalışır */
  demo,
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

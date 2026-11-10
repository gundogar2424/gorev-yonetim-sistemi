/**
 * npm run vega:kesif
 * Vega veritabanındaki gerçek tablo/kolonları listeler ve sema.ts eşlemesini doğrular.
 * Yalnızca sistem kataloğunu okur; Vega verisine dokunmaz.
 */
import { vegaKapat, vegaSorgu } from './baglanti'
import { sema } from './sema'

async function kolonlar(tablo: string): Promise<string[]> {
  const satirlar = await vegaSorgu<{ ad: string }>(
    `SELECT COLUMN_NAME AS ad FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @tablo ORDER BY ORDINAL_POSITION`,
    { tablo },
  )
  return satirlar.map((s) => s.ad)
}

async function calistir() {
  const tablolar = await vegaSorgu<{ ad: string }>(
    `SELECT TABLE_NAME AS ad FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_TYPE = 'BASE TABLE'
       AND (TABLE_NAME LIKE '%STOK%' OR TABLE_NAME LIKE '%CARI%' OR TABLE_NAME LIKE '%SIPARIS%'
            OR TABLE_NAME LIKE '%BARKOD%' OR TABLE_NAME LIKE '%BIRIM%' OR TABLE_NAME LIKE '%FIYAT%')
     ORDER BY TABLE_NAME`,
  )
  console.log(`\nİlgili tablolar (${tablolar.length}):`)
  for (const t of tablolar) console.log('  ' + t.ad)

  let hata = 0
  for (const [bolum, tanim] of Object.entries(sema)) {
    const { tablo, ...alanlar } = tanim as Record<string, string | null> & { tablo: string }
    const mevcut = await kolonlar(tablo)
    console.log(`\n[${bolum}] ${tablo}`)
    if (mevcut.length === 0) {
      console.log('  ✗ TABLO BULUNAMADI — VEGA_FIRMA / VEGA_DONEM değerlerini ve yukarıdaki listeyi kontrol edin')
      hata++
      continue
    }
    console.log('  Kolonlar: ' + mevcut.join(', '))
    const buyuk = new Set(mevcut.map((k) => k.toUpperCase()))
    for (const [alan, kolonAdi] of Object.entries(alanlar)) {
      if (alan === 'girisKosulu') continue // serbest SQL koşulu; elle doğrulanır
      if (kolonAdi === null) console.log(`  – ${alan}: eşlenmemiş (NULL dönecek)`)
      else if (buyuk.has(kolonAdi.toUpperCase())) console.log(`  ✓ ${alan} → ${kolonAdi}`)
      else {
        console.log(`  ✗ ${alan} → ${kolonAdi} YOK`)
        hata++
      }
    }
  }
  console.log(
    hata
      ? `\n${hata} eşleme hatası var: src/vega/sema.ts dosyasını yukarıdaki gerçek isimlere göre düzeltin.`
      : '\nEşleme tamam. (hareket.girisKosulu koşulunu bir ürünün bakiyesini Vega ile karşılaştırarak doğrulayın.)',
  )
  process.exitCode = hata ? 1 : 0
}

calistir()
  .catch((e) => {
    console.error('Keşif başarısız:', e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(vegaKapat)

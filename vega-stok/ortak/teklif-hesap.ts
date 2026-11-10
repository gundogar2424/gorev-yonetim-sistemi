/**
 * Teklif hesabı — hem arayüz (anlık toplamlar) hem sunucu (PDF, WhatsApp metni)
 * AYNI dosyayı kullanır; ekranda görülen ile PDF'te yazan tutar asla ayrışmaz.
 */

export interface Kalem {
  miktar: number
  birimFiyat: number
  /** Kademeli iskonto: "10+5" → önce %10, kalan tutardan %5 */
  iskonto: string
  /** KDV oranı, yüzde */
  kdv: number
}

export interface KalemSonucu {
  /** İskonto öncesi tutar (miktar × birim fiyat) */
  brut: number
  /** Satır iskontosu sonrası tutar (genel iskonto hariç) */
  net: number
}

export interface TeklifSonucu {
  kalemler: KalemSonucu[]
  /** İskonto öncesi toplam */
  araToplam: number
  /** Satır + genel iskontoların toplamı */
  iskontoToplam: number
  /** KDV matrahı (KDV hariç net toplam) */
  matrah: number
  /** Orana göre KDV dökümü, oran artan sırada */
  kdvler: { oran: number; tutar: number }[]
  kdvToplam: number
  genelToplam: number
}

const kurus = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/** "10+5", "10 + 7,5", "%10" → [10, 5]. Geçersiz ya da 0–100 dışı ise null. */
export function iskontoCoz(metin: string): number[] | null {
  const yalin = metin.replace(/[%\s]/g, '')
  if (yalin === '') return []
  const oranlar = yalin.split('+').map((p) => (/^\d+([.,]\d+)?$/.test(p) ? Number(p.replace(',', '.')) : NaN))
  return oranlar.every((o) => o >= 0 && o <= 100) ? oranlar : null
}

/** Kademeli iskontoların çarpanı: [10, 5] → 0,855 */
const carpan = (metin: string) => (iskontoCoz(metin) ?? []).reduce((c, o) => c * (1 - o / 100), 1)

/**
 * @param kdvDahil Birim fiyatlar KDV dahil mi? Dahilse matrah fiyattan ayrıştırılır.
 */
export function teklifHesapla(kalemler: Kalem[], genelIskonto: string, kdvDahil: boolean): TeklifSonucu {
  const genel = carpan(genelIskonto)
  const kdvHaric = (tutar: number, oran: number) => (kdvDahil ? tutar / (1 + oran / 100) : tutar)
  const matrahlar = new Map<number, number>()
  let araToplam = 0

  const satirlar = kalemler.map((k) => {
    const brut = kurus(k.miktar * k.birimFiyat)
    const net = kurus(brut * carpan(k.iskonto))
    araToplam += kdvHaric(brut, k.kdv)
    matrahlar.set(k.kdv, (matrahlar.get(k.kdv) ?? 0) + kdvHaric(net * genel, k.kdv))
    return { brut, net }
  })

  // Kuruş yuvarlaması oran grubu başına bir kez yapılır (faturadaki gibi)
  const kdvler = [...matrahlar].sort((a, b) => a[0] - b[0]).map(([oran, m]) => ({ oran, matrah: kurus(m), tutar: kurus((kurus(m) * oran) / 100) }))
  const matrah = kurus(kdvler.reduce((t, k) => t + k.matrah, 0))
  const kdvToplam = kurus(kdvler.reduce((t, k) => t + k.tutar, 0))
  return {
    kalemler: satirlar,
    araToplam: kurus(araToplam),
    iskontoToplam: kurus(kurus(araToplam) - matrah),
    matrah,
    kdvler: kdvler.map(({ oran, tutar }) => ({ oran, tutar })),
    kdvToplam,
    genelToplam: kurus(matrah + kdvToplam),
  }
}

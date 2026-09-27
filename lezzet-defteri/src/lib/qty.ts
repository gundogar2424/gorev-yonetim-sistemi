// Malzeme satirindaki miktari porsiyona gore olcekler.
// "2 su bardağı un" -> x1.5 -> "3 su bardağı un"
// "1/2 çay kaşığı tuz", "1,5 kg", "½ limon", "2-3 diş sarımsak" desteklenir.

const KESIR: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125 }

// Satirin basindaki miktar: tam sayi, ondalik (virgul/nokta), bileşik kesir, aralik.
const BAS = /^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?|[½¼¾⅓⅔⅛])(\s*[½¼¾⅓⅔⅛])?(?:\s*[-–]\s*(\d+(?:[.,]\d+)?))?/

function sayiOku(s: string): number {
  s = s.trim()
  if (KESIR[s] !== undefined) return KESIR[s]
  const bilesik = s.match(/^(\d+)\s+(\d+)\/(\d+)$/)
  if (bilesik) return Number(bilesik[1]) + Number(bilesik[2]) / Number(bilesik[3])
  const kesir = s.match(/^(\d+)\/(\d+)$/)
  if (kesir) return Number(kesir[1]) / Number(kesir[2])
  return Number(s.replace(',', '.'))
}

// Sonucu mutfakta okunur bicimde yaz: 0.5 -> "1/2", 1.5 -> "1,5", 2 -> "2"
export function sayiYaz(n: number): string {
  if (!isFinite(n) || n <= 0) return '0'
  const tam = Math.floor(n)
  const kusur = n - tam
  const yakin: [number, string][] = [
    [0.25, '1/4'],
    [1 / 3, '1/3'],
    [0.5, '1/2'],
    [2 / 3, '2/3'],
    [0.75, '3/4']
  ]
  if (kusur < 0.05) return String(tam)
  if (kusur > 0.95) return String(tam + 1)
  for (const [v, yazi] of yakin) {
    if (Math.abs(kusur - v) < 0.04) return tam ? `${tam} ${yazi}` : yazi
  }
  return (Math.round(n * 10) / 10).toLocaleString('tr-TR')
}

export function olcekle(satir: string, carpan: number): string {
  if (carpan === 1) return satir
  const m = satir.match(BAS)
  if (!m) return satir
  let ana = sayiOku(m[1])
  if (m[2]) ana += sayiOku(m[2])
  if (!isFinite(ana) || ana <= 0) return satir
  let yeni = sayiYaz(ana * carpan)
  if (m[3]) {
    const ust = sayiOku(m[3])
    if (isFinite(ust)) yeni += `-${sayiYaz(ust * carpan)}`
  }
  return yeni + satir.slice(m[0].length)
}

// --- Alisveris reyonlari --------------------------------------------------
// Anahtar kelimeyle kaba bir reyon tahmini: listeyi markette gezme sirasina
// gore gruplamak icin. Taninmayan satir "Diğer"e duser.
export const REYONLAR: { ad: string; emoji: string; kelimeler: string[] }[] = [
  {
    ad: 'Manav',
    emoji: '🥬',
    kelimeler: [
      'domates', 'biber', 'soğan', 'sarımsak', 'patates', 'havuç', 'kabak', 'patlıcan', 'salatalık', 'marul',
      'maydanoz', 'dereotu', 'nane', 'roka', 'ıspanak', 'limon', 'elma', 'muz', 'çilek', 'portakal', 'mantar',
      'brokoli', 'karnabahar', 'lahana', 'pırasa', 'kereviz', 'fasulye', 'bezelye', 'mısır', 'avokado',
      'zencefil', 'taze', 'semizotu', 'turp', 'pancar', 'enginar', 'bamya', 'üzüm', 'armut', 'şeftali',
      'kayısı', 'nar', 'kivi', 'ananas', 'karpuz', 'kavun', 'reyhan', 'fesleğen', 'kişniş', 'yeşillik'
    ]
  },
  {
    ad: 'Et, Tavuk, Balık',
    emoji: '🥩',
    kelimeler: [
      'kıyma', 'et', 'tavuk', 'but', 'göğüs', 'kanat', 'pirzola', 'kuşbaşı', 'bonfile', 'antrikot', 'dana',
      'kuzu', 'balık', 'somon', 'levrek', 'çipura', 'hamsi', 'karides', 'ton', 'sucuk', 'pastırma', 'sosis',
      'salam', 'hindi', 'jambon', 'ciğer', 'köfte'
    ]
  },
  {
    ad: 'Süt, Yumurta, Peynir',
    emoji: '🧀',
    kelimeler: [
      'süt', 'yoğurt', 'peynir', 'kaşar', 'lor', 'labne', 'krema', 'kaymak', 'tereyağ', 'yumurta', 'ayran',
      'mozzarella', 'parmesan', 'beyaz peynir', 'süzme', 'krem peynir', 'mascarpone', 'kefir'
    ]
  },
  {
    ad: 'Kuru Gıda, Bakliyat',
    emoji: '🌾',
    kelimeler: [
      'un', 'pirinç', 'bulgur', 'makarna', 'erişte', 'mercimek', 'nohut', 'kuru fasulye', 'şeker', 'nişasta',
      'irmik', 'yulaf', 'galeta', 'kabartma', 'maya', 'vanilin', 'kakao', 'çikolata', 'ceviz', 'fındık',
      'badem', 'fıstık', 'kuru üzüm', 'hurma', 'tahin', 'pekmez', 'bal', 'reçel', 'salça', 'konserve',
      'yufka', 'lavaş', 'ekmek', 'bisküvi', 'kraker', 'susam', 'çörek otu', 'kinoa', 'şehriye', 'mısır unu'
    ]
  },
  {
    ad: 'Yağ, Sos, Baharat',
    emoji: '🧂',
    kelimeler: [
      'yağ', 'zeytinyağ', 'sirke', 'sos', 'ketçap', 'mayonez', 'hardal', 'soya', 'tuz', 'karabiber',
      'pul biber', 'kimyon', 'kekik', 'toz biber', 'isot', 'tarçın', 'zerdeçal', 'köri', 'sumak', 'nar ekşisi',
      'defne', 'baharat', 'yenibahar', 'muskat', 'karanfil', 'paprika'
    ]
  },
  {
    ad: 'İçecek',
    emoji: '🥤',
    kelimeler: ['su', 'maden suyu', 'soda', 'meyve suyu', 'kola', 'çay', 'kahve']
  }
]

export function reyonBul(satir: string): string {
  const s = ' ' + satir.toLocaleLowerCase('tr').replace(/[^a-zçğıöşü ]/g, ' ') + ' '
  let enIyi = { ad: 'Diğer', uzunluk: 0 }
  for (const r of REYONLAR) {
    for (const k of r.kelimeler) {
      // Kelime basinda eslesme ("tavuk" -> "tavuğu" gibi ekler icin gövde karsilastirmasi)
      const kok = k.length > 4 ? k.slice(0, k.length - 1) : k
      if (s.includes(' ' + kok) && k.length > enIyi.uzunluk) enIyi = { ad: r.ad, uzunluk: k.length }
    }
  }
  return enIyi.ad
}

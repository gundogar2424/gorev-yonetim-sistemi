// Yemek adindan ICECEK mi tespiti. Icecekler icin "doydun mu / tokluk"
// sorusu anlamsiz oldugundan bu durumlarda o soruyu/hatirlatmayi atlariz.
// Basit anahtar-kelime sezgisi (Turkce); yeni analiz gerektirmez.

const DRINK_WORDS = new Set([
  'su', 'süt', 'çay', 'cay', 'kahve', 'kola', 'ayran', 'gazoz', 'soda', 'kefir',
  'boza', 'sahlep', 'şerbet', 'serbet', 'limonata', 'bira', 'şarap', 'sarap',
  'şalgam', 'salgam', 'kombucha', 'nescafe', 'latte', 'espresso', 'americano',
  'cappuccino', 'capuccino', 'mocha', 'smoothie', 'milkshake'
])

const DRINK_PHRASES = [
  'meyve suyu', 'maden suyu', 'sıcak çikolata', 'sicak cikolata', 'soğuk çikolata',
  'ice tea', 'ice coffee', 'buzlu çay', 'buzlu kahve', 'türk kahvesi', 'filtre kahve',
  'sade kahve', 'sütlü kahve', 'protein shake', 'enerji içeceği', 'enerji icecegi',
  'içecek', 'icecek', 'kokteyl', 'portakal suyu', 'elma suyu', 'yeşil çay', 'bitki çayı'
]

export function isBeverage(foodName?: string): boolean {
  const n = (foodName || '').toLocaleLowerCase('tr').trim()
  if (!n) return false
  if (DRINK_PHRASES.some((p) => n.includes(p))) return true
  // Kelime bazli (sutlac/susam/sucuk gibi yanlis eslesmeleri onler)
  const words = n.split(/[^a-zçğıöşü]+/i).filter(Boolean)
  return words.some((w) => DRINK_WORDS.has(w))
}

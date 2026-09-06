// Turkce kelime havuzlari. Gunluk hayattan, somut, tanidik sozcukler
// (yasli kullanicilar icin yabanci/teknik kelime yok).
// Karisik Harfler: uzunluga gore gruplanir.
export const ANAGRAM_WORDS: Record<number, string[]> = {
  3: ['ayı', 'bal', 'bağ', 'baş', 'cam', 'dal', 'dağ', 'diş', 'göl', 'göz', 'gül', 'kar', 'kaz', 'kol', 'kum', 'kuş', 'kök', 'köy', 'kış', 'saç', 'süt', 'taş', 'tel', 'top', 'tuz', 'yaz', 'yağ', 'yol', 'yün', 'çay'],
  4: ['anne', 'ayna', 'baba', 'cami', 'dede', 'ekin', 'elma', 'fare', 'gece', 'gemi', 'halı', 'kale', 'kapı', 'kase', 'kaya', 'kedi', 'kilo', 'kova', 'koza', 'kuzu', 'masa', 'nine', 'okul', 'para', 'saat', 'tava', 'tren', 'yaka'],
  5: ['bahar', 'bahçe', 'balık', 'biber', 'bulut', 'cadde', 'deniz', 'fırın', 'halat', 'havuç', 'kalem', 'kiraz', 'komşu', 'koyun', 'köpek', 'limon', 'orman', 'pazar', 'radyo', 'sabah', 'sokak', 'soğan', 'tarla', 'tavuk', 'yemek', 'yolcu', 'çanta', 'çeşme', 'çiçek', 'çorba'],
  6: ['avukat', 'bardak', 'bayram', 'berber', 'bülbül', 'cüzdan', 'fındık', 'gazete', 'gömlek', 'gözlük', 'kalkan', 'kanepe', 'kaplan', 'karpuz', 'kartal', 'kasaba', 'kayısı', 'koltuk', 'lahana', 'leylek', 'mektup', 'mendil', 'meydan', 'muhtar', 'peynir', 'peçete', 'salkım', 'sandal', 'sandık', 'sincap', 'tavşan', 'terlik', 'yaprak', 'yastık', 'yorgan', 'zeytin', 'çeyrek', 'çiftçi'],
  7: ['anahtar', 'baklava', 'balıkçı', 'domates', 'eldiven', 'fasulye', 'gökyüzü', 'hastane', 'hemşire', 'karınca', 'kelebek', 'kestane', 'kurbağa', 'misafir', 'oyuncak', 'papatya', 'patates', 'pencere', 'postacı', 'süpürge', 'telefon', 'tencere', 'tramvay', 'uçurtma', 'çekmece', 'örümcek', 'öğrenci', 'şeftali', 'şemsiye'],
  8: ['ayakkabı', 'bahçıvan', 'bisiklet', 'gelincik', 'güvercin', 'ilkbahar', 'kahvaltı', 'karanfil', 'kaydırak', 'kaymakam', 'kurabiye', 'marangoz', 'mercimek', 'merdiven', 'mühendis', 'pantolon', 'patlıcan', 'portakal', 'salıncak', 'sandalye', 'sarmaşık', 'sonbahar', 'öğretmen']
}

// Kelimeleri Hatirla oyunu icin genis, birbirinden ayrik havuz
export const RECALL_WORDS: string[] = [
  'elma', 'masa', 'kedi', 'deniz', 'kalem', 'çiçek', 'kapı', 'ekmek', 'saat', 'bahçe',
  'köpek', 'araba', 'kitap', 'yağmur', 'güneş', 'pencere', 'çorba', 'anahtar', 'sandalye', 'ayna',
  'orman', 'balık', 'kuş', 'süt', 'peynir', 'zeytin', 'çay', 'kahve', 'tuz', 'şeker',
  'gemi', 'tren', 'köprü', 'sokak', 'köy', 'şehir', 'dağ', 'göl', 'nehir', 'bulut',
  'yastık', 'yorgan', 'battaniye', 'terlik', 'şemsiye', 'çanta', 'cüzdan', 'gözlük', 'şapka', 'eldiven',
  'domates', 'biber', 'soğan', 'patates', 'havuç', 'limon', 'kiraz', 'karpuz', 'üzüm', 'incir',
  'radyo', 'telefon', 'lamba', 'halı', 'perde', 'tabak', 'bardak', 'kaşık', 'çatal', 'tencere',
  'doktor', 'öğretmen', 'terzi', 'bakkal', 'manav', 'fırın', 'eczane', 'okul', 'cami', 'pazar',
  'bayram', 'düğün', 'misafir', 'komşu', 'torun', 'dede', 'nine', 'kardeş', 'arkadaş', 'mektup',
  'altın', 'gümüş', 'bakır', 'demir', 'tahta', 'cam', 'taş', 'kum', 'toprak', 'çimen'
]

// Karisik Harfler'de kelime tek harf farkli baska bir kelimeyle karismasin diye
// harf sirasini gercekten degistirene kadar karistir.
export function scrambleWord(word: string, rnd: () => number = Math.random): string[] {
  const letters = Array.from(word)
  if (letters.length < 2) return letters
  for (let deneme = 0; deneme < 20; deneme++) {
    const a = letters.slice()
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    if (a.join('') !== word) return a
  }
  return letters.slice().reverse()
}

export function upperTr(s: string): string {
  return s.replace(/i/g, 'İ').replace(/ı/g, 'I').toUpperCase()
}

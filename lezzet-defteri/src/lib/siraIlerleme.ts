// Sira isinin yuzdesi ve tahmini kalan suresi: asamaya ve asamada gecen sureye gore tahmin.
// [desen, asama basi %, asama sonu %, asamanin tipik suresi sn]
const ASAMALAR: [RegExp, number, number, number][] = [
  [/Başlıyor|Sırada \(yeniden\)/, 2, 6, 3],
  [/Paylaşım okunuyor|açıklama okunuyor|Mekan paylaşımı okunuyor|Harita linki/i, 6, 18, 8],
  [/Instagram’dan video bilgisi|altyazısı okunuyor|Video alınıyor/i, 18, 25, 8],
  [/Video indiriliyor/i, 25, 60, 45],
  [/kareler|sesi hazırlanıyor|Video hazırlanıyor|Video büyük|Ses modeli|Konuşma yazıya/i, 60, 68, 20],
  [/Kaydırmalı gönderi|Fotoğraf alınıyor/i, 25, 60, 20],
  [/video izleniyor|videoyu izliyor|Google Haritalar’da aranıyor|haritadaki yeri/i, 68, 88, 40],
  [/tarifi hazırlıyor|tarifi düzenliyor|açıklamada tam yazıyor/i, 70, 92, 20],
  [/Kaydediliyor|kaydediliyor/i, 92, 98, 5]
]

export function siraIlerleme(mesaj: string, basladi?: number, asamaZamani?: number, simdi = Date.now()): { yuzde: number; kalanSn: number } | null {
  const a = ASAMALAR.find(([d]) => d.test(mesaj))
  if (!a) return null
  const [, bas, son, tipik] = a
  const gecen = asamaZamani ? (simdi - asamaZamani) / 1000 : 0
  // Asama icinde ilerleme yavaslayarak sona yaklasir (hic %100'e varmaz)
  const oran = 1 - Math.exp(-gecen / Math.max(1, tipik))
  const yuzde = Math.round(bas + (son - bas) * oran)
  const toplamGecen = basladi ? (simdi - basladi) / 1000 : 0
  // Kalan: bu asamanin kalani + sonraki asamalarin tipik toplami (kaba tahmin, en az 5 sn)
  const kalanBuAsama = Math.max(0, tipik - gecen)
  const sonrakiler = ASAMALAR.filter(([, b]) => b >= son && b < 99).reduce((t, x) => t + x[3] * 0.5, 0)
  const kalanSn = Math.max(5, Math.round(kalanBuAsama + sonrakiler * (1 - yuzde / 100)))
  void toplamGecen
  return { yuzde: Math.min(99, yuzde), kalanSn }
}

export function kalanYaz(sn: number): string {
  if (sn < 60) return `~${Math.max(5, Math.round(sn / 5) * 5)} sn kaldı`
  return `~${Math.round(sn / 60)} dk kaldı`
}

// Hata mesajini anlasilir hale getirir; bilinmeyen teknik hatalar yerine ne yapilacagini soyler
export function anlasilirHata(m: string): string {
  const t = m || ''
  if (/anahtar.*(geçersiz|hatalı)|API key not valid|invalid.*key|401|403.*key/i.test(t)) return 'Anahtar geçersiz. Ayarlar → Yapay zeka’dan anahtarı kontrol et.'
  if (/Bugünkü yapay zeka sınırı|günlük sınır|daily limit/i.test(t)) return 'Günlük sınır doldu, yarın kendiliğinden işlenir.'
  if (/harcama sınırı|spend cap|spending cap/i.test(t)) return 'Google’daki aylık harcama sınırı doldu. aistudio.google.com/spend’den sınırı yükselt.'
  if (/kredi|billing|prepaid|402/i.test(t)) return 'Yapay zeka kredisi bitti. Google ya da Anthropic hesabından kredi yükle.'
  if (/dakika(lık)? sınır|per minute|RESOURCE_EXHAUSTED|429/i.test(t)) return 'Yapay zeka şu an çok istek aldı. 1 dakika sonra “Tekrar dene”ye bas.'
  if (/yoğun|overloaded|503|500|529|UNAVAILABLE/i.test(t)) return 'Yapay zeka şu an yoğun. Biraz sonra “Tekrar dene”ye bas.'
  if (/Failed to fetch|NetworkError|network|bağlantı|ERR_|timeout|zaman aşımı/i.test(t) && !/dakikada bitmedi/.test(t))
    return 'İnternet bağlantısı yok ya da çok yavaş. Bağlantını kontrol edip “Tekrar dene”ye bas.'
  if (/Video .* inmedi|Video indirilemedi/i.test(t)) return t + ' Tarif açıklamadan çıkarılmaya çalışıldı.'
  if (/^(Error|TypeError|undefined|null|\[object)/i.test(t) || /bilinmeyen|unknown error/i.test(t))
    return 'İşlenemedi. Linki kontrol edip “Tekrar dene”ye bas; olmazsa paylaşımı yeniden gönder.'
  return t
}

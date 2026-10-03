// Lezzet Defteri veri tipleri.
import type { TmSurum } from './lib/tm7'
// Diger programlarla (CRM, Diyet Kocu, Termomiks...) HICBIR tip/tablo paylasmaz.

// Tarifin geldigi yer. Listede kucuk rozet olarak gosterilir.
export type LzPlatform = 'instagram' | 'tiktok' | 'youtube' | 'pinterest' | 'facebook' | 'web' | 'manual'

export interface LzRecipe {
  id?: number
  title: string
  photo: string // data URI (cihazda saklanir). Bos olabilir.
  sourceUrl: string // Tarifin alindigi paylasim/sayfa adresi. Bos olabilir.
  platform: LzPlatform
  author: string // Paylasan hesap / site adi (bos olabilir)
  servings: number // Kac kisilik (0 = belirtilmemis)
  minutes: number // Toplam sure, dakika (0 = belirtilmemis)
  ingredients: string[] // "2 su bardağı un" gibi serbest satirlar
  steps: string[]
  notes: string
  tags: string[] // Akşam Yemeği, Tatlı, Pratik...
  tableIds: number[] // Hangi sofralara ait (Kocam, Çocuklar...)
  tm?: TmSurum // Thermomix TM7 uyarlamasi (varsa)
  besin?: LzBesin // 1 porsiyonun tahmini besin degeri (yapay zeka, onbellek)
  kontrol?: string // Siradan otomatik eklendiyse: kullaniciya gosterilecek "kontrol et" notu
  favorite: 0 | 1 // Dexie boolean indeksleyemez
  cookCount: number
  lastCookedAt: number
  createdAt: number
  updatedAt: number
}

// "Sofra": tarifleri kisilere / ortamlara gore toplayan grup
// (orn. "Kocam", "Canım Kızım", "Misafir sofrası").
export interface LzTable {
  id?: number
  name: string
  emoji: string
  notes?: string // Sevmedikleri, alerjileri, beslenme bicimi (yapay zeka dikkate alir)
  createdAt: number
}

export type LzMeal = 'kahvalti' | 'ogle' | 'aksam'

// Haftalik plan satiri: bir gune bir ogun icin bir tarif.
export interface LzPlan {
  id?: number
  date: string // YYYY-MM-DD (yerel)
  meal: LzMeal
  recipeId: number
  createdAt: number
}

export interface LzShopItem {
  id?: number
  text: string
  done: 0 | 1
  recipeId: number // 0 = elle eklendi
  recipeTitle: string
  createdAt: number
}

// Linkten / metinden cikarilan, henuz kaydedilmemis tarif taslagi.
export interface LzDraft {
  title: string
  photo: string
  sourceUrl: string
  platform: LzPlatform
  author: string
  servings: number
  minutes: number
  ingredients: string[]
  steps: string[]
  notes: string
  tags: string[]
  besin?: LzBesin // 1 porsiyon tahmini (diyete gore uretilen tariflerde)
}

// Besin degeri (1 porsiyon ya da bir ogun hedefi). Yapay zeka tahminidir.
export interface LzBesin {
  kalori: number // kcal
  protein: number // g
  karb: number // g
  yag: number // g
  hesap?: number // Ne zaman hesaplandi
}

// Diyetisyenin verdigi plandaki bir ogun
export interface LzDiyetOgun {
  ad: string // Kahvaltı, Ara öğün 1, Öğle, Akşam...
  icerik: string // Diyetisyenin yazdigi hali ("1 yumurta, 2 dilim tam buğday ekmeği...")
  hedef: LzBesin // Ogun hedefi (plan yazmiyorsa tahmin)
  tahmini: boolean // Hedef plandan mi alindi, tahmin mi edildi
}

export interface LzDiyet {
  id?: number // Her zaman 1
  ogunler: LzDiyetOgun[]
  notlar: string // Genel kurallar (su, yasaklar...)
  gunlukKalori: number
  guncelleme: number
  // Her ogun icin defterdeki tariflerin uyum sonucu (ogun sirasi -> sonuc)
  eslesme?: Record<number, LzOgunEslesme>
}

export interface LzOgunEslesme {
  sonuc: import('./lib/ai').OgunUyum[]
  bakilan: number[] // degerlendirilmis tarif id'leri (yeni eklenenler sonradan taranir)
  zaman: number
}

// Arka arkaya paylasilan linklerin islenme sirasi
export interface LzSira {
  id?: number
  girdi: string // Paylasilan link ya da metin
  durum: 'bekliyor' | 'isleniyor' | 'bitti' | 'hata'
  mesaj: string // Ilerleme / hata / sonuc notu
  recipeId: number // Bittiyse eklenen tarif (0 = yok)
  baslik: string
  createdAt: number
  updatedAt: number
  zorla?: boolean // defterde olsa da yeniden cikar
  mekanId?: number // paylasim bir mekansa kaydedilen mekan
}

// Internette gorulen yeme-icme mekanlari (restoran, kafe, pastane…)
export interface LzMekan {
  id?: number
  ad: string
  tur: string // Restoran, Kafe, Pastane, Kebapçı…
  adres: string
  ilce: string
  sehir: string
  lat?: number
  lon?: number
  konumKaynak: 'harita' | 'arama' | 'adres' | 'elle' | ''
  oneriler: string[] // Ne yenir / denenecekler
  fiyat: string
  notlar: string
  etiketler: string[]
  foto: string
  sourceUrl: string
  platform: LzPlatform
  gidildi: boolean
  createdAt: number
}

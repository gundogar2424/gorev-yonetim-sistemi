// Diyet Koçu uygulamasinin veri tipleri.
// CRM'den tamamen bagimsizdir; kendi yerel veritabaninda saklanir.

// Kullanicinin bir yemek karsisinda verdigi karar
export type Decision = 'none' | 'resisted' | 'ate'

// Risk seviyesi (yapay zekanin yemege bictigi diyet riski)
export type RiskLevel = 'düşük' | 'orta' | 'yüksek'

// Yapay zekanin fotograftan urettigi inceleme
export interface FoodAnalysis {
  foodFound: boolean // Goruntude yemek bulundu mu?
  foodName: string // Taninan yemegin adi
  healthy: boolean // Diyet acisindan saglikli mi?
  riskLevel: RiskLevel // Diyeti bozma riski
  estimatedCalories: number // Tahmini kalori
  protein: number // Tahmini protein (gram); bilinmiyorsa 0
  carb: number // Tahmini karbonhidrat (gram); bilinmiyorsa 0
  fat: number // Tahmini yag (gram); bilinmiyorsa 0
  dietScore: number // Diyete uygunluk puani 1-10 (10 = mukemmel, 1 = cok kotu); bilinmiyorsa 0
  scoreReason: string // Puani neden tam vermedigi / nereden kirdigi (10 ise bos)
  harms: string[] // Yemegin zararlari / olumsuz yanlari
  motivations: string[] // Diyeti bozmamak icin motive edici sozler
  healthierAlternative: string // Daha saglikli alternatif oneri
  verdict: string // Tek cumlelik ozet karar
  // Diyet listesine uyum (liste yuklendiyse): 0-100, liste yoksa -1
  compliancePercent: number
  complianceNote: string // Neyin uydugu/uymadiginin kisa aciklamasi
  // Kontrollu kacamak: yemek saglıksızsa ve cok canı cektiyse, diyeti
  // tamamen bozmayacak makul bir miktar onerisi (saglikli yemekte bos "").
  cravingPortion: string // orn. "2 kare bitter çikolata (~20 g)"
  cravingNote: string // orada durmasi icin motive edici kisa not
}

// Ogun turu (hangi ogune ait)
export type MealType = 'kahvalti' | 'ara1' | 'ogle' | 'ikindi' | 'aksam' | 'gece' | 'serbest'

// Veritabaninda saklanan bir kayit (inceleme + karar + fotograf)
export interface DietEntry extends FoodAnalysis {
  id?: number
  photo: string // Kucultulmus base64 data URL
  decision: Decision // Kullanicinin karari
  mealType?: MealType // Hangi ogune ait (kahvalti/ogle/aksam/ara/gece/serbest)
  satiety?: number // Yedikten ~yarim saat sonra TOKLUK 1-10 (1 ac kaldim, 10 fazla tok)
  createdAt: number // Zaman damgasi (ms)
  dateStr: string // Yerel tarih (YYYY-MM-DD)
}

// Vucut olcusu kaydi (belli bir tarihte). Tum olculer cm, kilo kg; hepsi istege bagli.
export interface Measurement {
  id?: number
  dateStr: string // YYYY-MM-DD
  createdAt: number
  weight?: number // Kilo (kg)
  arm?: number // Kol (cm)
  chest?: number // Gogus (cm)
  waist?: number // Bel (cm)
  fold?: number // Bel kivrimi (cm)
  navel?: number // Gobek deligi hizasi (cm)
  hip?: number // Kalca (cm)
  leg?: number // Bacak (cm)
}

// Seker / tansiyon olcumu (saat bazli)
export interface Vital {
  id?: number
  kind: 'seker' | 'tansiyon'
  createdAt: number
  dateStr: string // YYYY-MM-DD
  time: string // SS:DD
  // Seker
  sugar?: number // mg/dL
  sugarContext?: string // ac / tok
  // Tansiyon
  systolic?: number // buyuk tansiyon
  diastolic?: number // kucuk tansiyon
  pulse?: number // nabiz
}

// Tahlil/lab sonucu: foto veya PDF'ten metne cevrilip hafizada tutulur
export interface Lab {
  id?: number
  createdAt: number
  dateStr: string // Tahlil tarihi (YYYY-MM-DD)
  title: string // Kisa baslik (orn. "Kan tahlili")
  text: string // Yapay zekanin cikardigi duz metin
  analysis?: string // Yapay zekanin yorumu/karsilastirmasi (istege bagli)
}

// Ogun hatirlaticisi (APK'da belli saatte bildirim gonderir)
export interface Reminder {
  id: string // 'kahvalti' vb.
  notifId: number // isletim sistemi icin sabit sayisal kimlik
  label: string
  time: string // Ogun saati (SS:DD)
  lead: number // Ogunden kac dakika ONCE bildirim (0 = tam saatinde)
  enabled: boolean
}

// Egzersiz kaydi (kullanici ne yaptigini yazar; +puan kazandirir)
export interface Exercise {
  id?: number
  createdAt: number
  dateStr: string // YYYY-MM-DD
  text: string // Ne yaptin? (orn. "30 dk yürüyüş")
  minutes?: number // Suresi (dk, istege bagli)
  kcal?: number // Yakilan kalori (yapay zeka tahmini); yoksa kabaca hesaplanir
}

// "Ne Yesem?" onerisi: eldeki urunlerden gramajli ogun + makrolar
export interface MealItem {
  name: string // Urun adi (orn. "yulaf")
  grams: number // Onerilen miktar (gram)
}
export interface MealSuggestion {
  title: string // Onerinin adi (orn. "Yuksek proteinli kahvalti")
  items: MealItem[] // Sundan su kadar gram listesi
  calories: number // Toplam tahmini kalori
  protein: number // Protein (gram)
  carb: number // Karbonhidrat (gram)
  fat: number // Yag (gram)
  reason: string // Neden bu / diyet listene uyumu
}
export interface MealAdvice {
  foodsFound: boolean // Goruntude tanınabilir urun var mi
  foodsDetected: string[] // Taninan urunler
  suggestions: MealSuggestion[] // 2-3 oneri
  tip: string // Genel kisa ipucu
}

// Elle girilip hafizaya alinan urun (barkod -> besin). Veritabaninda
// bulunamayan urunler bir kez girilince burada saklanir.
export interface SavedProduct {
  id?: number
  barcode: string
  name: string
  kcal: number // 100 g/ml icin
  protein: number
  carb: number
  fat: number
  createdAt: number
}

// Gunluk su tuketimi (bir tarih icin). Artik ml esas alinir; eski kayitlarda
// yalnizca bardak (glasses) olabilir (1 bardak ~ 200 ml).
export interface Water {
  id?: number
  dateStr: string // YYYY-MM-DD
  glasses: number // Eski alan (bardak); geriye donuk uyum icin tutulur
  ml?: number // Icilen su (mililitre) — esas deger
  createdAt: number
}

// Gunluk adim sayisi (elle girilir; orn. Samsung Health'ten)
export interface Steps {
  id?: number
  dateStr: string // YYYY-MM-DD
  count: number // Adim sayisi
  createdAt: number
}

// Gunluk uyku suresi (elle girilir, saat cinsinden; orn. 7.5)
export interface Sleep {
  id?: number
  dateStr: string // YYYY-MM-DD
  hours: number // Uyku suresi (saat)
  createdAt: number
}

// Ilerleme/onceki-sonraki fotografi (vucut takibi icin)
export interface ProgressPhoto {
  id?: number
  dateStr: string // YYYY-MM-DD
  photo: string // Kucultulmus base64 data URL
  note?: string // Kisa not (orn. kilo)
  createdAt: number
}

// Alisveris listesi ogesi
export interface ShoppingItem {
  id?: number
  createdAt: number
  text: string
  done: boolean
  category?: string // Urun tipi/kategorisi (orn. "Sebze & Meyve") — gruplamak icin
  meals?: string[] // Bu urun diyet listesinde hangi ogun(ler)de geciyor (orn. ["Kahvaltı","Akşam"])
}

// Diyet listesine gore uretilen, kategorilere ayrilmis alisveris onerisi
export interface ShoppingSuggestItem {
  name: string // Urun adi
  meals: string[] // Hangi ogun(ler)de geciyor (orn. ["Kahvaltı","Akşam"])
}
export interface ShoppingCategory {
  name: string // Kategori adi (orn. "Sebze & Meyve")
  items: ShoppingSuggestItem[] // O kategorideki urunler (ogun bilgisiyle)
}
export interface ShoppingSuggestion {
  categories: ShoppingCategory[]
  note: string // Kisa not (orn. kac gunluk / nasil uydugu)
}

// Uygulama ayarlari (API anahtari ve kullanici baglami)
export interface DietSettings {
  id?: number
  apiKey?: string // Anthropic API anahtari (yalnizca cihazda saklanir)
  model?: string // Kullanilacak model (varsayilan: claude-opus-4-8)
  userName?: string // Kullanici adi (kisisellestirme icin)
  heightCm?: number // Boy (cm) — kalori/BMI icin
  age?: number // Yas
  gender?: 'kadın' | 'erkek' // Cinsiyet (kalori ihtiyaci icin)
  goal?: string // Diyet hedefi (yapay zekaya baglam olarak verilir)
  dietPlan?: string // Kullanicinin diyet listesi (ogunler) — uyum karsilastirmasi icin
  reminders?: Reminder[] // Ogun hatirlaticilari (APK bildirimleri)
  // Gunluk/haftalik hedefler (istege bagli; bos birakilirsa varsayilan kullanilir)
  waterGoal?: number // Gunluk su hedefi (bardak)
  calorieGoal?: number // Gunluk kalori hedefi (kcal)
  targetWeight?: number // Hedef kilo (kg) — ana ekran ilerleme karti icin
  startWeight?: number // Baslangic kilosu (kg); bos ise ilk olcumden alinir
  weeklyExerciseGoal?: number // Haftalik egzersiz hedefi (adet)
  stepGoal?: number // Gunluk adim hedefi
  sleepGoal?: number // Gunluk uyku hedefi (saat)
  // Ek bildirimler (yalnizca APK)
  waterReminderEnabled?: boolean // Gun icinde su icme hatirlatmasi
  motivationReminderEnabled?: boolean // Gunluk motivasyon bildirimi
  motivationReminderTime?: string // Motivasyon bildirimi saati (SS:DD)
}

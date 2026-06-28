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
  harms: string[] // Yemegin zararlari / olumsuz yanlari
  motivations: string[] // Diyeti bozmamak icin motive edici sozler
  healthierAlternative: string // Daha saglikli alternatif oneri
  verdict: string // Tek cumlelik ozet karar
  // Diyet listesine uyum (liste yuklendiyse): 0-100, liste yoksa -1
  compliancePercent: number
  complianceNote: string // Neyin uydugu/uymadiginin kisa aciklamasi
}

// Veritabaninda saklanan bir kayit (inceleme + karar + fotograf)
export interface DietEntry extends FoodAnalysis {
  id?: number
  photo: string // Kucultulmus base64 data URL
  decision: Decision // Kullanicinin karari
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

// Gunluk su tuketimi (bir tarih icin bardak sayisi)
export interface Water {
  id?: number
  dateStr: string // YYYY-MM-DD
  glasses: number // Icilen bardak sayisi (1 bardak ~ 200 ml)
  createdAt: number
}

// Alisveris listesi ogesi
export interface ShoppingItem {
  id?: number
  createdAt: number
  text: string
  done: boolean
}

// Uygulama ayarlari (API anahtari ve kullanici baglami)
export interface DietSettings {
  id?: number
  apiKey?: string // Anthropic API anahtari (yalnizca cihazda saklanir)
  model?: string // Kullanilacak model (varsayilan: claude-opus-4-8)
  userName?: string // Kullanici adi (kisisellestirme icin)
  goal?: string // Diyet hedefi (yapay zekaya baglam olarak verilir)
  dietPlan?: string // Kullanicinin diyet listesi (ogunler) — uyum karsilastirmasi icin
  reminders?: Reminder[] // Ogun hatirlaticilari (APK bildirimleri)
  // Gunluk/haftalik hedefler (istege bagli; bos birakilirsa varsayilan kullanilir)
  waterGoal?: number // Gunluk su hedefi (bardak)
  calorieGoal?: number // Gunluk kalori hedefi (kcal)
  weeklyExerciseGoal?: number // Haftalik egzersiz hedefi (adet)
}

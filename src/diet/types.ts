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

// Uygulama ayarlari (API anahtari ve kullanici baglami)
export interface DietSettings {
  id?: number
  apiKey?: string // Anthropic API anahtari (yalnizca cihazda saklanir)
  model?: string // Kullanilacak model (varsayilan: claude-opus-4-8)
  userName?: string // Kullanici adi (kisisellestirme icin)
  goal?: string // Diyet hedefi (yapay zekaya baglam olarak verilir)
  dietPlan?: string // Kullanicinin diyet listesi (ogunler) — uyum karsilastirmasi icin
}

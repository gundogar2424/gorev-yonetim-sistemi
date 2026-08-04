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
  // Tabaktaki TOPLAM porsiyon agirligi (gram). Kalori ve makrolar bu agirlik
  // icindir; kart gorselinde "270 g · 540 kcal" seklinde gosterilir.
  // ESKI KAYITLARDA YOK — okurken yokluğu normal, gizlenir.
  portionGrams?: number
  protein: number // Tahmini protein (gram); bilinmiyorsa 0
  carb: number // Tahmini karbonhidrat (gram); bilinmiyorsa 0
  fat: number // Tahmini yag (gram); bilinmiyorsa 0
  // Ek besin degerleri (MyFitnessPal'daki "Kalp icin Saglikli" ve "Dusuk
  // Karbonhidrat" kartlari icin). Eski kayitlarda YOK — okurken 0 varsayilir.
  sugar?: number // Seker (gram)
  fiber?: number // Lif (gram)
  sodium?: number // Sodyum (mg)
  cholesterol?: number // Kolesterol (mg)
  caffeineMg?: number // Kafein (mg) — kahve/cay/enerji icecegi; yoksa 0
  dietScore: number // Diyete uygunluk puani 1-10 (10 = mukemmel, 1 = cok kotu); bilinmiyorsa 0
  scoreReason: string // Puani neden tam vermedigi / nereden kirdigi (10 ise bos)
  harms: string[] // Yemegin zararlari / olumsuz yanlari
  motivations: string[] // Diyeti bozmamak icin motive edici sozler
  healthierAlternative: string // Daha saglikli alternatif oneri
  verdict: string // Tek cumlelik ozet karar
  // Diyet listesine uyum (liste yuklendiyse): 0-100, liste yoksa -1
  compliancePercent: number
  complianceNote: string // Neyin uydugu/uymadiginin kisa aciklamasi
  // Makroyu listeye yaklastirmak icin SOMUT duzeltme onerisi (liste varsa ve
  // sapma varsa): "su kadar ekle / su kadar azalt / az ye". Uygun/ liste yoksa "".
  macroFix: string
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
  alsoMeal?: MealType // BIRLESIK ogun: bu kayit ayni zamanda su ogunu de kapsiyor (gec kalkinca kahvalti+ogle gibi)
  alsoMeal2?: MealType // BIRLESIK ogun (3.): kayit UCUNCU bir ogunu de kapsiyorsa (kahvalti+ogle+ikindi)
  createdAt: number // Zaman damgasi (ms)
  dateStr: string // Yerel tarih (YYYY-MM-DD)
  sharedAt?: number // Bu ogun diyetisyene tek tek gonderildiyse zaman damgasi
  pending?: boolean // Hizli kaydedildi, henuz yapay zekayla incelenmedi (sonra duzeltilecek)
  // TEK DOKUNUSLA eklenen sik tuketilen urun (cay, kahve, ayran...). Yapay zeka
  // HIC calistirilmaz: kalorisi/makrosu kullanicinin bir kez girdigi sabit
  // degerdir. Ogun sayilmaz, diyet puanina katilmaz; yalnizca gunun kalori
  // toplamina ve icecek/atistirma dokumune girer.
  quick?: boolean
  draftNote?: string // Hizli kaydederken yazilan aciklama; Gecmis'te AI ile hesaplamak icin saklanir
}

// Vucut olcusu kaydi (belli bir tarihte). Tum olculer cm, kilo kg; hepsi istege bagli.
export interface Measurement {
  id?: number
  dateStr: string // YYYY-MM-DD
  createdAt: number
  weight?: number // Kilo (kg)
  arm?: number // Kol (cm)
  chest?: number // Gogus (cm)
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
  kcal?: number // Yakilan kalori (elle girilir ya da yapay zeka tahmini)
  // Samsung Health / akilli saat verileri (elle girilir, istege bagli)
  steps?: number // Adim sayisi (orn. 7360)
  avgHr?: number // Ortalama nabiz (bpm)
  cadence?: number // Tempo (adim/dk)
  distanceKm?: number // Mesafe (km)
}

// "Ne Yesem?" onerisi: eldeki urunlerden gramajli ogun + makrolar
export interface MealItem {
  name: string // Urun adi (orn. "yulaf")
  grams: number // Onerilen miktar (gram)
  measure: string // Ev olcusu (orn. "3 corba kasigi", "1 su bardagi (~200 ml)", "2 dilim", "1 orta boy")
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
  activeMin?: number // Etkin (aktif) sure — dakika (Samsung Health vb.)
  activeKcal?: number // Aktivite kalorisi
  burnedKcal?: number // Yakilan TOPLAM kalori (bazal + aktivite)
  distanceKm?: number // Etkinken mesafe (km)
  createdAt: number
}

// Gunluk uyku suresi (saat cinsinden; orn. 7.5)
export interface Sleep {
  id?: number
  dateStr: string // YYYY-MM-DD
  hours: number // Uyku suresi (saat)
  // Kullanici bu geceyi ELLE girdi/duzeltti mi? true ise Health Connect
  // senkronu bu satirin uzerine YAZMAZ. Saatten gelen "yatakta gecen sure"
  // gercek uyku suresinden buyuk olabiliyor; kullanicinin duzeltmesi
  // otomatik veriden daha guvenilirdir.
  manual?: boolean
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

// Kriz ani kaydi ("canim cekiyor" butonu): saat + sonuc.
// Zamanla kriz saatleri ogrenilir ve diyetisyen raporuna girer.
export interface Craving {
  id?: number
  dateStr: string // YYYY-MM-DD
  createdAt: number
  outcome: 'resisted' | 'ate' // Direndi mi, yine de yedi mi
  note?: string // Ne cekti (orn. "tatli")
}

// Gune ozel not/plan (orn. "bugun gec kahvalti, kahvalti+ara ogunu birlestirdim").
// O gun boyunca TUM yapay zeka modulleri bu notu dikkate alir.
export interface DayNote {
  id?: number
  dateStr: string // YYYY-MM-DD
  text: string
  createdAt: number
}

// Gun ici "nasilsin?" check-in kaydi (gunluk; his/enerji/aclik + kisa not)
export interface CheckIn {
  id?: number
  dateStr: string // YYYY-MM-DD
  createdAt: number
  mood?: number // Genel moral/his 1-10 (1 kotu, 10 harika)
  energy?: number // Enerji 1-10 (istege bagli)
  hunger?: number // O anki ACLIK 1-10 (1 tok, 10 cok ac) — moralden AYRI boyut
  note?: string // Kisa not: bugun nasil hissediyorsun
}

// Ilac kullanim kaydi: hangi ilaci ne zaman aldigi (orn. yemekten sonra).
// Zamanla "ilaci duzenli aliyor mu, ogunle iliskisi" gorulur; AI bunu bilir.
export interface MedLog {
  id?: number
  dateStr: string // YYYY-MM-DD
  createdAt: number // zaman damgasi (saat bu alandan)
  name: string // ilac/vitamin adi
  relation?: 'ac' | 'tok' | 'genel' // ac karnina / yemekten sonra / farketmez
  medId?: number // hangi tanimli ilaca/vitamine ait (varsa)
  kind?: 'ilac' | 'vitamin'
  time?: string // hangi doz saatine ait (SS:DD) — belli bir doz slotunu isaretlemek icin
  status?: 'taken' | 'skipped' // alindi mi atlandi mi (varsayilan: taken)
}

// Tanimli ilac/vitamin: adi, turu, ogunle iliskisi, doz saatleri ve gunleri.
// Bunlardan hem hatirlatmalar, hem gunluk doz listesi, hem uyum raporlari uretilir.
export interface MedDef {
  id?: number
  name: string // orn. "Metformin 1000 mg", "D Vitamini"
  kind: 'ilac' | 'vitamin'
  relation?: 'ac' | 'tok' | 'genel' // ac karnina / tok (yemekten sonra) / farketmez
  times: string[] // gunluk doz saatleri (SS:DD listesi)
  days?: number[] // haftanin gunleri 0=Paz..6=Cmt; bos/undefined = HER gun
  reminder: boolean // bu ilac icin bildirim kurulsun mu
  active: boolean // aktif mi (birakildiysa false)
  brand?: string // marka/uretici (etken madde markaya gore degisebilir — analizde ozellikle dikkate alinir)
  dose?: string // doz miktari metni (orn. "1 Tablet", "5 ml", "2 damla")
  startDate?: string // program baslangici YYYY-MM-DD (kür/tedavi suresi icin)
  endDate?: string // program bitisi YYYY-MM-DD (bos = suresiz)
  ingredients?: string // AI etken madde analizi (etken maddeler, ne ise yarar, ilgili tahlil/belirti, dikkat) — ortak baglama girer
  ingredientsAt?: number // analiz ne zaman uretildi (ms)
  updatedAt?: number // son duzenleme zamani (senkronda yeni olan kazanir)
  note?: string
  createdAt: number
}

// SIK TUKETILEN URUN ("Sik tuketiklerim"): kullanicinin bir kez tanimladigi,
// sonra tek dokunusla gunune ekledigi sabit degerli oge. Bir bardak cay ya da
// kahve icin her seferinde yapay zeka calistirmak hem para hem de anlamsiz —
// koc bunlari bir "ogun" gibi degerlendirmemeli.
export interface Favorite {
  id?: number
  emoji?: string // kisa gorsel ipucu (orn. "☕")
  name: string // orn. "Çay (şekersiz)"
  kcal: number // bir porsiyonun kalorisi
  protein?: number
  carb?: number
  fat?: number
  sugar?: number
  // Porsiyondaki KAFEIN (mg). Cay ~47, Turk kahvesi ~65, filtre kahve ~95.
  // Gunun kafein toplami bundan cikar; sinir asilinca uyari verilir.
  // NOT: sivi (ml) BILEREK tutulmuyor — su takibi yalnizca gercekten
  // icilen suyu sayar, cay/kahve su yerine gecmez.
  caffeineMg?: number
  uses?: number // kac kez eklendi — cok kullanilan basa gelir
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
  model?: string // Kullanilacak model (varsayilan: claude-opus-5)
  updatedAt?: number // ayarlarin son degisme zamani (senkron icin: yeni olan kazanir)
  syncToken?: string // GitHub kisisel erisim anahtari (gist yetkisi) — cihazlar arasi senkron
  syncGistId?: string // senkron verisinin tutuldugu OZEL gist'in id'si
  lastSyncAt?: number // son basarili senkron zamani
  aiBudgetUsd?: number // kullanicinin yukledigi/ayirdigi kredi ($) — kalan bakiye TAHMINI icin
  aiBudgetSetCostUsd?: number // butce girildigi andaki toplam harcama ($) — kalan = butce - (guncel - bu)
  userName?: string // Kullanici adi (kisisellestirme icin)
  heightCm?: number // Boy (cm) — kalori/BMI icin
  age?: number // Yas
  gender?: 'kadın' | 'erkek' // Cinsiyet (kalori ihtiyaci icin)
  medications?: string // Kullanilan ilaclar (serbest metin) — saglik degerlendirmesine baglam
  conditions?: string // Kronik rahatsizliklar (serbest metin; istege bagli)
  goal?: string // Diyet hedefi (yapay zekaya baglam olarak verilir)
  preferences?: string // Kisisel aliskanliklar/tercihler (orn. "kahveyi/cayi sekersiz icerim, tam bugday ekmek yerim") — HER analizde dikkate alinir
  dietPlan?: string // Kullanicinin diyet listesi (ogunler) — uyum karsilastirmasi icin
  // Diyet listesinin ogunlere bolunmus hali (yapay zeka bir kez ayirir; ana ekranda
  // "Sıradaki öğün"de o ogunde ne yenecegi gosterilir). dietPlanMealsSrc, bu bolmenin
  // hangi diyet listesi metninden uretildigini tutar; liste degisince yeniden bolunur.
  dietPlanMeals?: Partial<Record<MealType, string>>
  // Hafta sonu (Cumartesi-Pazar) icin ayri menu. Diyet listeleri sik sik
  // "Hafta sonu ogle ve aksam menu: ..." diye ayriliyor; tek bir bolme bunu
  // kaybediyor, cumartesi gunu hafta ici menusu gosteriliyordu.
  dietPlanMealsWeekend?: Partial<Record<MealType, string>>
  // HAFTALIK PLAN: listenin 7 gune dagitilmis hali. Diyet listeleri "haftada
  // 3 gun yumurtali, 2 gun yulafli" gibi yazildigi icin hangi gun hangisinin
  // yenecegi ancak boyle belirli olur. Anahtar: '0'=Pazar ... '6'=Cumartesi
  // (JS getDay ile ayni). `etiket` o gunu ayirt eden kisa isim ("Yulaflı
  // kahvaltı günü"); sirdan gunlerde bostur.
  dietPlanWeek?: Record<string, { etiket?: string } & Partial<Record<MealType, string>>>
  dietPlanMealsSrc?: string
  reminders?: Reminder[] // Ogun hatirlaticilari (APK bildirimleri)
  // HANGI OGUNLERI YIYORSUN? Bu, bildirimden AYRI bir sorudur. Onceden bu
  // bilgi "hatirlaticisi acik mi" ya da "diyet listesinde satiri var mi"
  // uzerinden TAHMIN ediliyordu; ikisi de yaniltiyordu (bildirim istemedigin
  // ogun yok sayiliyor, listeyi bolen yapay zeka satiri uretemezse ogun
  // kayboluyordu). Artik kullanici acikca secer. Bos/tanimsizsa makul bir
  // varsayilan turetilir (ana ogunler + listede karsiligi olan ara ogunler).
  myMeals?: MealType[]
  // Gunluk/haftalik hedefler (istege bagli; bos birakilirsa varsayilan kullanilir)
  waterGoal?: number // Gunluk su hedefi (bardak)
  calorieGoal?: number // Gunluk kalori hedefi (kcal)
  targetWeight?: number // Hedef kilo (kg) — ana ekran ilerleme karti icin
  startWeight?: number // Baslangic kilosu (kg); bos ise ilk olcumden alinir
  weeklyExerciseGoal?: number // Haftalik egzersiz hedefi (adet)
  stepGoal?: number // Gunluk adim hedefi
  sleepGoal?: number // Gunluk uyku hedefi (saat)
  // Gunluk kafein siniri (mg). Bos ise 400 varsayilir (yetiskin icin yaygin
  // ust sinir). Asilinca ana ekranda uyari cikar ve koc buna gore konusur.
  caffeineLimitMg?: number
  // Ek bildirimler (yalnizca APK)
  waterReminderEnabled?: boolean // Gun icinde su icme hatirlatmasi
  motivationReminderEnabled?: boolean // Gunluk motivasyon bildirimi
  motivationReminderTime?: string // Motivasyon bildirimi saati (SS:DD)
  checkinReminderEnabled?: boolean // Gun ici "nasilsin?" bildirimi
  checkinReminderTime?: string // Check-in bildirimi saati (SS:DD)
  planReminderEnabled?: boolean // Aksam "yarini planla" bildirimi
  planReminderTime?: string // Yarin plani bildirimi saati (SS:DD)
  reportReminderEnabled?: boolean // Aksam "raporu gonder" hatirlatmasi
  reportReminderTime?: string // Rapor hatirlatma saati (SS:DD)
  sugarFastingReminderEnabled?: boolean // Sabah aclik sekeri olcum hatirlatmasi
  sugarFastingReminderTime?: string // Sabah aclik olcum saati (SS:DD, varsayilan 07:00)
  sugarPostMealReminderEnabled?: boolean // Ogunden 2 saat sonra tok seker olcum hatirlatmasi
  medReminderEnabled?: boolean // Ilac/seker hapi hatirlatmasi (yemekten sonra) — APK bildirimi
  medReminderTimes?: string[] // (ESKI) sadece saat listesi — geriye uyum icin korunur
  medSchedule?: { time: string; name: string }[] // Saat + o saatteki ilac adi (sabah/ogle/aksam farkli)
  dietitianNotes?: string // Diyetisyenin talimatlari — yapay zeka HER degerlendirmede dikkate alir
  // Profil derinlestirme (isabetli oneri icin; hepsi istege bagli)
  activityLevel?: string // Hareket duzeyi (orn. "masabasi/az hareketli", "ayakta calisirim")
  dailyRhythm?: string // Uyku/is duzeni (orn. "gece 01'de yatarim, vardiyali calisirim")
  dislikedFoods?: string // Sevmedigi/alerjik/kacindigi yiyecekler — onerilerde ONERILMEZ
  // "Beni Tani" kalici profil (AI tum veriden ozetler; tum modullere temel olur)
  personalProfile?: string // AI'nin cikardigi "seni taniyan" ozet
  personalProfileAt?: number // En son ne zaman uretildi (ms)
  // Haftalik icgoru raporu (AI proaktif kocluk)
  weeklyInsights?: string // Son uretilen haftalik icgoru metni
  weeklyInsightsAt?: number // En son ne zaman uretildi (ms)
  // Proaktif akilli aclik hatirlatmasi (verilerden ogrenilen saatte)
  smartHungerReminderEnabled?: boolean
  smartHungerReminderTime?: string // Ogrenilen aclik saati (SS:DD) — otomatik hesaplanir
}

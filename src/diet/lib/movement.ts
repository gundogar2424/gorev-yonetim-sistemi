// HAREKET KALORISI VE MESAFE — tek kaynak.
//
// Neden ayri bir dosya: bu iki sayi ana ekranda, diyetisyen raporunda, koca
// giden baglamda ve Egzersiz sayfasinda ayri ayri hesaplaniyordu. Rapor
// "4581 kcal toplam" gibi gercek disi bir deger gosterirken ana ekranda bambaska
// bir sayi vardi. Artik hepsi buradan gecer.

export interface ActivityRow {
  count?: number // adim
  activeKcal?: number // Health Connect 'active-calories'
  burnedKcal?: number // Health Connect 'total-calories' — GUVENILMEZ, asagiya bak
  distanceKm?: number
}

// TOPLAM YAKIM (burnedKcal) NEDEN KULLANILMIYOR
// ---------------------------------------------
// Eklentinin 'total-calories' toplamasi (aggregateTotalCalories) su sirayla
// calisiyor:
//     aktif + bazal   ... ikisi de yoksa -> TotalCaloriesBurnedRecord
// Bizim manifestimizde BASAL izni yok, dolayisiyla:
//   - aktif kalori verisi VARSA        -> deger = yalnizca aktif kalori
//   - aktif kalori verisi YOKSA        -> deger = ham "toplam yakim" (bazal dahil)
// Yani ayni alan bazi gunler "aktif", bazi gunler "bazal+aktif" anlamina geliyor.
// Ustune Health Connect ayni gunu birden fazla kaynak (saat + telefon) yazdiginda
// bunlari TOPLUYOR; tekillestirmiyor. Sonuc: 1 Agustos raporunda 9.328 adim
// karsiliginda "4581 kcal toplam" gibi imkansiz bir sayi.
//
// Diyet bakimindan anlamli olan zaten bazal DEGIL, harekete harcanan kaloridir.
// Bu yuzden tek bir sayi uretiyoruz ve burnedKcal'i hicbir yerde gostermiyoruz.

// Adim basina kabaca 0,04 kcal (~70 kg icin yaygin kabul). Aktif kalori
// olcumu geldiginde bu tahmin kullanilmaz.
const KCAL_PER_STEP = 0.04

// Aktif kalorinin makul ust siniri (kcal/gun). Uzerini olcum degil, mukerrer
// kayit sayiyoruz ve adimdan tahmine duseriz.
const MAX_PLAUSIBLE_ACTIVE = 2000

export function movementKcal(row?: ActivityRow): number {
  const steps = row?.count || 0
  const active = row?.activeKcal || 0
  if (active > 0 && active <= MAX_PLAUSIBLE_ACTIVE) return Math.round(active)
  return steps > 0 ? Math.round(steps * KCAL_PER_STEP) : 0
}

// MESAFE — Samsung yalnizca KAYITLI EGZERSIZ icin DistanceRecord yaziyor; gun
// icindeki serbest yurumeler adim sayisina giriyor ama mesafeye girmiyor.
// 1 Agustos raporunda 9.328 adim yanina "2.46 km" yazmasinin sebebi bu: 2,46 km
// yalnizca 53 dakikalik kayitli yuruyusun mesafesi. Diyetisyene yanlis bir
// gunluk mesafe gitmemesi icin, adimin isaret ettigi mesafenin yarisindan da
// kucuk kalan olcumleri "eksik" sayip gizliyoruz.
const METERS_PER_STEP = 0.7

export function plausibleDistanceKm(row?: ActivityRow): number | undefined {
  const d = row?.distanceKm
  if (!d || d <= 0) return undefined
  const steps = row?.count || 0
  if (!steps) return d
  const expected = (steps * METERS_PER_STEP) / 1000
  if (d < expected * 0.5) return undefined // kayit yalnizca egzersizi kapsiyor
  return d
}

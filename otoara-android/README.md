# Oto Ara 📞🔁 (native Android)

Meşgul çalan ya da açılmayan bir numarayı **otomatik olarak, belirlediğin
aralıklarla tekrar tekrar arayan** native Android uygulaması.

> Bu klasör, depodaki diğer uygulamalardan (Saha CRM, Diyet Koçu, Kart Takip)
> **tamamen ayrı, bağımsız bir programdır**. Hiçbir dosyalarını paylaşmaz,
> onlara dokunmaz. Saf **Kotlin + Jetpack Compose** ile yazılmıştır — WebView
> ya da Capacitor kullanmaz, çünkü tarayıcı tabanlı bir uygulama kendi başına
> arama başlatamaz.

## Ne yapar?

| Özellik | Açıklama |
|---|---|
| 🎯 **Hedef numara** | Elle yaz ya da rehberden seç. Son aranan numaralar listede kalır |
| ☎️ **Dahili numara** | Bağlantı kurulunca dahili numarayı otomatik tuşlar (santraller için) |
| ⏱️ **Aralık** | İki arama arasındaki bekleme (saniye) |
| 🔁 **Tekrar sayısı** | Toplam kaç kez aranacağı |
| ⏳ **Çağrı süresi** | Bir çağrının en fazla ne kadar çalacağı — dolunca kapatılıp yeniden aranır |
| ✅ **Cevaplanınca dur** | Karşı taraf açtığında döngü kendiliğinden biter ve bildirim gelir |
| 🔔 **Kalıcı bildirim** | Kaçıncı denemede olunduğu, kalan saniye ve **Durdur** düğmesi |
| 🌙 **Ekran kapalıyken** | Ön plan servisi + wake-lock sayesinde telefon cebindeyken de sürer |
| 📋 **Geçmiş** | Her denemenin zamanı, süresi ve sonucu kayıt altında |

## Döngü tam olarak nasıl işler?

Her deneme için sırayla:

1. Numara aranır.
2. Çağrı kurulunca **Çağrı süresi** kadar beklenir.
   - Karşı taraf kapatır / meşgulse çağrı zaten düşer.
   - Süre dolarsa uygulama çağrıyı kapatır (*Süre dolunca kapat* açıksa).
3. Çağrı bittikten sonra **arama kaydına** bakılır: Android'de giden bir
   çağrının konuşma süresi ancak karşı taraf **açtıysa** 0'dan büyüktür.
   Süre > 0 ise çağrı cevaplanmış demektir ve *Cevaplanınca dur* açıksa döngü
   biter, telefona bildirim düşer.
4. Aksi halde **Aralık** kadar beklenip yeniden aranır; **Tekrar sayısı**
   dolana kadar.

> **Not:** "Arama kayıtları" izni verilmezse cevaplanma ancak tahmin edilebilir
> (çağrı kendi kendine kapandıysa ve 20 saniyeden uzun sürdüyse cevaplanmış
> sayılır). Bu izin yalnızca son giden çağrının süresini okumak için kullanılır;
> hiçbir veri telefondan dışarı çıkmaz.

## İzinler

| İzin | Neden gerekli |
|---|---|
| **Telefon araması yapma** (`CALL_PHONE`) | Zorunlu — aramayı uygulama başlatır |
| **Telefon durumu** (`READ_PHONE_STATE`) | Zorunlu — çağrının kurulduğunu/bittiğini anlamak için |
| **Çağrıları yönetme** (`ANSWER_PHONE_CALLS`) | Süre dolunca çağrıyı kapatabilmek için (Android 9+) |
| **Arama kayıtları** (`READ_CALL_LOG`) | İsteğe bağlı — "cevaplanınca dur" özelliğinin güvenilir çalışması için |
| **Bildirimler** | Kalıcı durum bildirimi ve sonuç uyarısı |
| **Pil optimizasyonu muafiyeti** | Ekran kapalıyken döngünün durmaması için (önerilir) |

Rehberden numara seçmek için ayrıca izin **gerekmez**; sistemin kişi seçme
ekranı kullanılır ve yalnızca seçtiğin numara uygulamaya geçer.

Tüm veriler telefonda kalır (Room/SQLite). Sunucu yoktur, internet gerekmez.

## Sınırlar

- **Aralık** en az 5 saniye, **tekrar sayısı** en çok 500'dür.
- Android, uygulamalara "karşı taraf açtı mı?" bilgisini canlı olarak vermez;
  bu yüzden cevaplanma çağrı bittikten sonra arama kaydından anlaşılır.
- Android 8 (API 26) ve üstü gerekir. Çağrıyı programla kapatmak Android 9+
  ister; daha eski sürümlerde süre dolunca çağrıyı elle kapatmanız gerekir.

## Sorumlu kullanım

Bu uygulama, **meşgul çalan bir hattı yakalamak** için tasarlandı (çağrı
merkezleri, randevu/bilet hatları, ulaşamadığın bir yakının). Aynı numarayı
rahatsız edecek biçimde arka arkaya aramak birçok ülkede — Türkiye dahil —
suçtur. Kullanım sorumluluğu kullanıcıya aittir.

## Teknik

- **Kotlin + Jetpack Compose** (Material 3, koyu tema)
- **Foreground Service** (`specialUse`) + `PARTIAL_WAKE_LOCK`
- **TelecomManager** `placeCall` / `endCall`, **TelephonyManager** çağrı durumu
- **Room** (yerel veritabanı: denemeler + son aranan numaralar)
- **minSdk 26** (Android 8.0+), targetSdk 34

## APK nasıl üretilir?

Otomatik: `main` dalına `otoara-android/**` altında bir değişiklik gittiğinde
`.github/workflows/otoara-apk.yml` çalışır ve APK'yı **GitHub Releases →
`otoara-latest`** etiketiyle yayınlar. Elle tetiklemek için Actions
sekmesinden **"Oto Ara APK Derle (native)"** → **Run workflow**.

Yerelde (Android SDK kuruluysa):

```bash
cd otoara-android
gradle assembleDebug
# çıktı: app/build/outputs/apk/debug/app-debug.apk
```

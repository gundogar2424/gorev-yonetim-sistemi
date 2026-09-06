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
| 🔊 **Hoparlör** | Çağrı kurulunca ses otomatik hoparlöre verilir (isteğe bağlı) |
| 🔔 **Kalıcı bildirim** | Kaçıncı denemede olunduğu, kalan saniye ve **Durdur** düğmesi |
| 🌙 **Ekran kapalıyken** | Ön plan servisi + wake-lock sayesinde telefon cebindeyken de sürer |
| 📅 **Planlı arama** | Belirlediğin tarih/saatte telefon sorar: numara, kısa not ve "Ara / Ertele / Vazgeç". Günlük, haftalık, aylık tekrar edebilir |
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

## Planlı aramalar

Uygulama üç ayrı bölümden oluşur; alt taraftaki sekmelerden geçilir:
**Arama** (otomatik tekrar arama), **Planlar** (planlı aramalar) ve **Geçmiş**.

**Planlar** sekmesinden bir
numara, tarih/saat ve **niçin arayacağını anlatan kısa bir not** kaydedersin.
Zamanı gelince telefon bir bildirimle **sorar**:

> **Muhasebe aranacaktı**
> 05xx xxx xx xx • Şubat faturası sorulacak
> [ Ara ] [ 15 dk ertele ] [ Vazgeç ]

- **Uygulama kendiliğinden aramaz.** Arama ancak **Ara**'ya bastığında başlar
  ve o an ana ekrandaki aralık/tekrar/süre ayarlarıyla çalışır.
- Bildirime dokunursan uygulama açılır ve numara forma dolar; ayarları
  gözden geçirip elle başlatabilirsin.
- **Tekrar**: bir kez / her gün / her hafta / her ay. Tekrarlı planlar
  kendiliğinden bir sonraki zamana kayar.
- Alarmlar telefon yeniden başlatıldığında otomatik olarak yeniden kurulur.

## Karşı taraf açarsa görüşme kesilmesin

Bu tür uygulamaların bilinen sıkıntısı: karşı taraf açar, süre dolar, uygulama
görüşmeyi keser ve yeniden arar. Sebebi teknik: **Android, varsayılan telefon
uygulaması olmayan bir uygulamaya "karşı taraf açtı" bilgisini canlı vermez** —
yalnızca "hat meşgul / boş" der; çalıyor mu konuşuluyor mu ayırt edilemez.

Oto Ara'da bu duruma karşı iki koruma var:

1. **"GÖRÜŞMEDEYİM — KESME" düğmesi.** Çağrı sürerken ekranda ve bildirimde
   çıkar. Bastığınız anda çağrı kapatılmaz ve tekrar arama biter — rahatça
   konuşursunuz.
2. **Kes-ara döngüsüne düşmez.** Düğmeye basmayı unutup çağrı kesilse bile,
   çağrı bittikten sonra arama kaydındaki konuşma süresine bakılır. Süre 0'dan
   büyükse çağrı cevaplanmıştır ve (*Cevaplanınca dur* açıksa) döngü durur.
   Yani en kötü ihtimalle bir kez kesilir, tekrar tekrar aramaz.

Hiç kesilme riski istemiyorsanız **"Süre dolunca kapat"** seçeneğini kapatın:
o zaman uygulama hiçbir çağrıyı kapatmaz, çağrının kendiliğinden bitmesini
bekler.

## Kendi aramalarınıza karışmaz

Döngü çalışırken siz başka birini ararsanız (ya da size gelen bir çağrıyı
açarsanız):

- Uygulama **sizin görüşmenizi kapatmaz.** "Süre dolunca kapat" yalnızca
  uygulamanın kendi başlattığı ve o an hâlâ süren çağrı için işler; kapatmadan
  hemen önce çağrının gerçekten kendisine ait olduğu bir kez daha doğrulanır.
  Telefon durumu okunamıyorsa hiçbir çağrıya dokunulmaz.
- Uygulama **görüşmenizin üstüne arama yapmaz.** Döngü durmaz, **duraklar**:
  bildirimde "Telefonunuz meşgul — bekleniyor" yazar, geri sayım da durur.
- Görüşmeniz bitince birkaç saniye beklenip kaldığı yerden devam eder.
- Meşguliyet çok uzun sürerse (30 dakika) döngü kendiliğinden sonlanır.

## İzinler

| İzin | Neden gerekli |
|---|---|
| **Telefon araması yapma** (`CALL_PHONE`) | Zorunlu — aramayı uygulama başlatır |
| **Telefon durumu** (`READ_PHONE_STATE`) | Zorunlu — çağrının kurulduğunu/bittiğini anlamak için |
| **Çağrıları yönetme** (`ANSWER_PHONE_CALLS`) | Süre dolunca çağrıyı kapatabilmek için (Android 9+) |
| **Arama kayıtları** (`READ_CALL_LOG`) | İsteğe bağlı — "cevaplanınca dur" özelliğinin güvenilir çalışması için |
| **Kişiler** (`READ_CONTACTS`) | İsteğe bağlı — uygulama içi kişi listesi için. Verilmezse sistemin kendi seçme ekranı kullanılır |
| **Ses ayarları** (`MODIFY_AUDIO_SETTINGS`) | "Hoparlörü aç" seçeneği için (kurulumda otomatik verilir) |
| **Bildirimler** | Kalıcı durum bildirimi, sonuç uyarısı ve planlı arama hatırlatması |
| **Tam-zamanlı alarm** | Planlı aramanın dakikasında sorulması için |
| **Pil optimizasyonu muafiyeti** | Ekran kapalıyken döngünün durmaması için (önerilir) |

**Rehber hakkında:** Sistemin kişi seçme ekranı kişileri değil *numaraları*
listeler; bir kişi birden fazla hesapta kayıtlıysa (Google, SIM, WhatsApp…) ya
da birkaç numarası varsa aynı isim alt alta defalarca çıkar. Bu yüzden
uygulamanın kendi kişi ekranı vardır: her kişi **tek satır**, aynı numaranın
tekrarı elenmiş, arama kutulu; kişinin farklı numaraları varsa satıra
dokununca altında açılır. Bunun için "Kişiler" izni gerekir — izin
verilmezse sistemin kendi ekranına düşülür. Rehber verisi telefondan çıkmaz.

Tüm veriler telefonda kalır (Room/SQLite). Sunucu yoktur, internet gerekmez.

## Sınırlar

- **Aralık** en az 5 saniye, **tekrar sayısı** en çok 500'dür.
- Android, uygulamalara "karşı taraf açtı mı?" bilgisini canlı olarak vermez;
  bu yüzden cevaplanma çağrı bittikten sonra arama kaydından anlaşılır.
- **Hoparlör (Samsung ve benzerleri)**: bazı üreticilerde çağrının ses yolu
  tamamen varsayılan telefon uygulamasının kontrolündedir ve dışarıdan yapılan
  çağrılar yok sayılır. Bunun için isteğe bağlı bir **erişilebilirlik hizmeti**
  vardır: izin verilirse uygulama, arama ekranındaki hoparlör düğmesine sizin
  yerinize basar. Hizmet yalnızca telefon/arama uygulamalarından olay alacak
  şekilde sınırlandırılmıştır (`res/xml/speaker_service.xml` → `packageNames`),
  yalnızca kendi tekrar arama döngüsü çalışırken ve "Hoparlörü aç" işaretliyken
  iş yapar, her çağrı için en fazla bir kez basar ve hoparlör zaten açıksa
  dokunmaz. Hiçbir ekran içeriği kaydedilmez veya gönderilmez. İzin verilmezse
  uygulama hiçbir şey yapmaz.
- **Hoparlör (genel)**: gerçek bir telefon çağrısının ses yolunu değiştirmek aslında
  varsayılan telefon uygulamasının işidir. Uygulama iki yolu birden dener
  (Android 12+ için `setCommunicationDevice`, ayrıca eski `isSpeakerphoneOn`)
  ve çağrı bağlandığında telefonun kendi arama uygulaması ayarı geri
  çekebildiği için ilk 15 saniye boyunca ısrarla uygular. Yine de bazı
  marka/sürümlerde sistem izin vermez; bu durumda ekranda "Hoparlör
  açılamadı" yazar ve arama ekranındaki hoparlör düğmesini kullanmak gerekir.
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
- **Room** (yerel veritabanı: denemeler, son aranan numaralar, planlar)
- **AlarmManager** + `BroadcastReceiver` (planlı aramalar, boot sonrası yeniden kurulur)
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

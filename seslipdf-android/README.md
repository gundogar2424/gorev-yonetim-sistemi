# Sesli PDF 📄🔊 (native Android)

PDF dosyalarını **sesli okuyan** native Android uygulaması. Kitabı, raporu ya da
ders notunu telefona ekliyorsun; uygulama metnini çıkarıp Android'in kendi
seslendirme motoruyla sana okuyor — ekran kapalıyken de.

> Bu klasör, depodaki diğer uygulamalardan (Saha CRM, Diyet Koçu, Kart Takip,
> Oto Ara) **tamamen ayrı, bağımsız bir programdır**. Hiçbir dosyalarını
> paylaşmaz. Saf **Kotlin + Jetpack Compose** ile yazılmıştır.

## Ne yapar?

| Özellik | Açıklama |
|---|---|
| 📥 **PDF ekleme** | Dosya seçiciden seç ya da başka bir uygulamada PDF'i "Sesli PDF ile aç / paylaş" |
| 🔡 **Metin çıkarma** | PDF'in kendi metin katmanı okunur (PDFBox), cihazda; internet gerekmez |
| 👁️ **OCR** | Taranmış/fotoğraflanmış sayfalarda metin yoksa sayfa görüntüden okunur (ML Kit, yine cihaz içinde) |
| 🔊 **Sesli okuma** | Cümle cümle okur; okunan cümle ekranda vurgulanır |
| 👆 **Cümleye dokun** | Herhangi bir cümleye dokununca okuma oradan devam eder |
| ⏩ **İleri / geri** | Cümle cümle atlama, "Sayfaya git" ile istediğin sayfaya |
| 🏃 **Hız ve ton** | 0.5× – 2.5× okuma hızı, ses tonu ayarı |
| 🗣️ **Ses seçimi** | Cihazda kurulu Türkçe (ve diğer) seslerden istediğini seç |
| 🔔 **Bildirim kumandası** | Oku/duraklat, ileri/geri, kapat — telefon kilitliyken de |
| 🌙 **Ekran kapalıyken** | Ön plan servisi + wake-lock sayesinde cepteyken de okumaya devam eder |
| 💾 **Kaldığın yer** | Her cümlede kaydedilir; uygulamayı kapatsan da aynı yerden devam |
| ⏰ **Uyku sayacı** | 5–90 dakika sonra okuma kendiliğinden duraklar |
| 🎧 **Ses odağı** | Telefon çaldığında ya da başka bir uygulama ses verdiğinde duraklar, sonra devam eder |

## Nasıl çalışır?

1. **PDF ekle** → sistem dosya seçici açılır, PDF'i seçersin. Dosya kopyalanmaz;
   yalnızca okuma izni alınır.
2. **Metin çıkarılır.** PDF aslında bir metin dosyası değildir: satırlar sayfadaki
   görsel satırlardır, kelimeler satır sonunda tire ile bölünür, her sayfanın
   başında kitap adı ve sayfa numarası tekrar eder. Uygulama bunları temizler:
   - satır sonundaki tireli bölünmeler birleştirilir (`keli-\nme` → `kelime`),
   - paragraf içindeki satır sonları boşluğa çevrilir,
   - her sayfada tekrarlanan üstbilgi/altbilgi ve tek başına duran sayfa
     numaraları atılır (Ayarlar'dan kapatılabilir).
3. **Cümlelere ayrılır.** "Dr.", "vb.", "12.03.2024", "1. Giriş" gibi yerlerde
   yanlışlıkla bölünmemesi için Türkçe kısaltma listesi ve sayı kuralları kullanılır.
   Çok uzun cümleler virgülden okunabilir parçalara bölünür.
4. **Okunur.** Her cümle seslendirme motoruna ayrı bir parça olarak verilir;
   sırası kimliği olur. Böylece hangi cümlenin okunduğu bilinir, ekranda
   vurgulanır ve kaldığın yer kaydedilir. Akıcılık bozulmasın diye motorun
   kuyruğunda bir sonraki cümle hazır bekletilir.

## Taranmış (resim) PDF'ler

Fotokopi ya da fotoğrafla üretilmiş PDF'lerde metin katmanı yoktur. Uygulama
böyle sayfaları görüntüye çevirip **cihaz içi OCR** ile okur (Google ML Kit,
Latin alfabesi). Bu daha yavaştır ve el yazısı/çok bozuk taramalarda hata
yapabilir. Ayarlar → **Metin çıkarma** bölümünden kapatılabilir.

## Türkçe ses

Okuma, telefonun kendi **metin okuma (TTS)** motoruyla yapılır. Çoğu Android
telefonda Google Konuşma Hizmetleri kuruludur ama **Türkçe ses paketi indirilmiş
olmayabilir**. Ses gelmiyorsa:

**Telefon Ayarları → Erişilebilirlik → Metin okuma çıkışı → Google TTS → Dil
yükle → Türkçe**

Uygulamada **Ayarlar → Telefonun metin okuma ayarları** düğmesi doğrudan bu
ekrana götürür. İndirilen sesler çevrimdışı çalışır.

## İzinler

| İzin | Neden gerekli |
|---|---|
| **Bildirimler** | Okuma kumandası bildirimi (oku/duraklat, ileri/geri) |
| **Ön plan servisi (medya)** | Ekran kapalıyken okumanın sürmesi |
| **Wake-lock** | Telefon uykuya dalınca okumanın kesilmemesi |

Depolama izni **istenmez**: dosya sistemin kendi seçicisiyle seçilir ve yalnızca
o dosyaya okuma izni alınır. İnternet izni de yoktur — uygulama hiçbir veriyi
dışarı göndermez, her şey telefonda kalır (Room/SQLite + uygulama klasörü).

## Sınırlar

- **Şifreli PDF'ler** parola sorularak açılır; parola hiçbir yere kaydedilmez.
  Kopyalama/çıkarma izni kapatılmış bazı PDF'ler açılamayabilir.
- **Tablolar, formüller, çok sütunlu düzenler** metin olarak sırayla okunur;
  sütun düzeni her zaman doğru tahmin edilemez.
- Çok büyük kitaplarda metin çıkarma birkaç dakika sürebilir; OCR gerekiyorsa
  daha uzun. İşlem uygulama açıkken sürer, sistem uygulamayı kapatırsa belge
  "Sırada" kalır ve kitaplıktan tek dokunuşla yeniden başlatılır.
- Okuma kalitesi tamamen cihazdaki TTS motoruna bağlıdır.
- Android 8.0 (API 26) ve üstü gerekir.

## Teknik

- **Kotlin + Jetpack Compose** (Material 3, koyu tema)
- **PDFBox-Android** (`com.tom-roush:pdfbox-android`) — metin katmanı çıkarma
- **ML Kit Text Recognition** — cihaz içi OCR
- **android.speech.tts.TextToSpeech** — cümle bazlı okuma, `UtteranceProgressListener`
- **Foreground Service** (`mediaPlayback`) + `PARTIAL_WAKE_LOCK` + `AudioFocus`
- **Room** (kitaplık, okuma konumu), metin dosyaları uygulama klasöründe
- **minSdk 26** (Android 8.0+), targetSdk 34

## APK nasıl üretilir?

Otomatik: `main` dalına `seslipdf-android/**` altında bir değişiklik gittiğinde
`.github/workflows/seslipdf-apk.yml` çalışır ve APK'yı **GitHub Releases →
`seslipdf-latest`** etiketiyle yayınlar. Elle tetiklemek için Actions
sekmesinden **"Sesli PDF APK Derle (native)"** → **Run workflow**.

Yerelde (Android SDK kuruluysa):

```bash
cd seslipdf-android
gradle assembleDebug
# çıktı: app/build/outputs/apk/debug/app-debug.apk
```

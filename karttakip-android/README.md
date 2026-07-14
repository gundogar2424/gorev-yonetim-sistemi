# Kart Takip 💳 (native Android)

Kredi kartlarının **hesap kesim** ve **son ödeme** tarihlerini takip eden,
**gerçek anlamda bildirim gönderen** native Android uygulaması.

> Bu klasör, depodaki web uygulamalarından (Saha CRM, Diyet Koçu) **tamamen
> ayrı, bağımsız bir sistemdir**. HTML/WebView/Capacitor kullanmaz — saf
> **Kotlin + Jetpack Compose** ile yazılmıştır. Bu sayede bildirimler,
> uygulama kapalıyken ve telefon uyku modundayken bile (tam-zamanlı alarm ile)
> zamanında çalar.

## Ne yapar?

| Özellik | Açıklama |
|---|---|
| 💳 **Kart yönetimi** | Kart adı, banka, kesim günü, son ödeme günü, limit, borç ve renk ile ekle/düzenle/sil |
| 🔔 **Gerçek bildirim** | Son ödemeden N gün önce, son ödeme günü ve ekstre kesim günü — AlarmManager tam-zamanlı alarm |
| 💡 **Bugün hangi kart?** | Yeni harcama için **en uzun faizsiz süreyi** sağlayan kartı önerir |
| ⚠️ **En yakın ödeme** | Borcu olan kartlar içinde son ödeme tarihi en yakın olanı öne çıkarır |
| 📴 **Offline & yerel** | Tüm veri telefonda (Room/SQLite). Sunucu yok, internet gerekmez |

### "Bugün hangi kartı kullanayım?" mantığı

Bugün yaptığın harcama, bir sonraki **kesim** ile kapanan ekstreye girer; o
ekstrenin son ödemesi ne kadar ileridyse paran o kadar uzun süre cepte kalır.
Uygulama her kart için bu **faizsiz gün** sayısını hesaplar ve en yükseğini önerir.

## Teknik

- **Kotlin + Jetpack Compose** (Material 3)
- **Room** (yerel veritabanı)
- **AlarmManager** + `BroadcastReceiver` (tam-zamanlı, boot sonrası yeniden kurulan alarmlar)
- **minSdk 26** (Android 8.0+), targetSdk 34

## APK nasıl üretilir?

Otomatik: `main` dalına `karttakip-android/**` altında bir değişiklik gittiğinde
`.github/workflows/karttakip-apk.yml` çalışır ve APK'yı **GitHub Releases →
`karttakip-latest`** etiketiyle yayınlar. Elle tetiklemek için Actions
sekmesinden **"Kart Takip APK Derle (native)"** → **Run workflow**.

Yerelde (Android SDK kuruluysa):

```bash
cd karttakip-android
gradle assembleDebug
# çıktı: app/build/outputs/apk/debug/app-debug.apk
```

## İzinler

İlk açılışta **bildirim izni** ister (Android 13+). Bildirimlerin dakikasında
gelmesi için tam-zamanlı alarm izinleri manifest'te tanımlıdır.

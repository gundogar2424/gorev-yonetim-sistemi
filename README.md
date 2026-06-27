# Saha CRM 📍

Saha satış personeli için tasarlanmış, **mobil öncelikli** bir CRM (Müşteri İlişkileri Yönetimi) uygulaması. İnternet olmadan da çalışır, verileriniz telefonunuzda saklanır, kaybolmaz.

## Bu nedir, nasıl çalışır?

Bu bir **PWA** (Progressive Web App — telefona uygulama gibi kurulabilen web uygulaması). Yani:

- **Uygulama mağazasına gerek yok.** Telefonun tarayıcısında açıp "Ana ekrana ekle" diyorsun, normal uygulama gibi simgesi çıkıyor.
- **İnternetsiz (offline) çalışır.** Sahada çekim olmasa bile müşteri ekler, bakar, düzenlersin.
- **Veri kaybı olmaz.** Tüm bilgiler telefonun kendi içindeki yerel veritabanında (IndexedDB) saklanır; sunucuya bağımlı değildir.

## Özellikler

| Özellik | Açıklama |
|---|---|
| 👥 **Müşteri Yönetimi** | Fotoğraf, kimlik, adres, ticari bilgiler, notlar ile ekle/düzenle/sil |
| 📍 **GPS Konumu** | Müşteri yanındayken tek tuşla anlık konumu kaydet |
| 🔍 **Arama & Filtre** | Firma, isim, telefona göre ara; il/ilçeye göre filtrele |
| 📞 **Hızlı Aksiyon** | Listeden tek tıkla ara veya WhatsApp mesajı başlat |
| 🎂 **Doğum Günü Uyarısı** | O gün doğum günü olan yetkilileri ana ekranda gösterir |
| 🗺️ **Akıllı Rota** | Seçili müşteriler için başlangıç noktandan en kısa güzergahı hesaplar, Google Haritalar'a aktarır |
| 📋 **Toplu İçe Aktarma** | Excel/tablodan kopyala-yapıştır ile toplu müşteri ekleme (sütunları akıllı algılar) |
| 💾 **Yedekleme** | Fotoğraflar dahil tüm veriyi tek dosyaya indir, istediğinde geri yükle |
| ⚙️ **İl/İlçe Yönetimi** | 81 il hazır gelir; istediğini ekle/çıkar |

## 🥗 Diyet Koçu (ayrı program)

Bu depoda, Saha CRM'den **tamamen ayrı, bağımsız ikinci bir program** bulunur: **Diyet Koçu**. Kendi giriş sayfası (`diyet.html`) vardır ve CRM'in hiçbir dosyasını paylaşmaz/değiştirmez.

- **Saha CRM** → `index.html` (örn. `https://<kullanıcı>.github.io/gorev-yonetim-sistemi/`)
- **Diyet Koçu** → `diyet.html` (örn. `https://<kullanıcı>.github.io/gorev-yonetim-sistemi/diyet.html`)

Her ikisi de aynı depodan derlenir ama ayrı sayfalardır; telefonda istediğini ayrı ayrı "Ana ekrana ekle" ile kurabilirsin.

**Ne yapar?** Diyet yapan kişi bir yemeği **yemeden önce fotoğrafını çeker**; yapay zeka (Claude) yemeği tanır ve:

- O yemeğin **zararlarını** ve tahmini kalorisini gösterir,
- Diyeti bozmamak için **motive edici, güçlendirici sözler** sunar,
- Daha sağlıklı bir **alternatif** önerir.

Kullanıcı sonra **"💪 Vazgeçtim"** veya **"😋 Yine de yedim"** kararını verir. Tüm kararlar kaydedilir.

| Özellik | Açıklama |
|---|---|
| 📸 **Foto + analiz** | Yemeğin fotoğrafını çek, yapay zeka tanısın; zararları ve motive edici sözleri gör |
| 📅 **Geçmiş** | Tüm fotoğraf ve kararların günlere göre kayıtlı listesi |
| 🔥 **Diyet serisi (streak)** | "Kaç gündür diyetini bozmadın" sayacı |
| 🏅 **Rozetler** | 1 / 3 / 7 / 14 / 30 / 60 / 100 / 365 günde açılan başarı rozetleri |

**Kurulum:** Fotoğraf analizi için bir **Anthropic (Claude) API anahtarı** gerekir. Diyet Koçu → **Ayarlar** bölümünden girilir; anahtar **yalnızca cihazda** saklanır, hiçbir sunucuya gönderilmez. Anahtar [console.anthropic.com](https://console.anthropic.com/settings/keys) üzerinden alınır. Analizler doğrudan tarayıcıdan Claude API'sine yapılır (varsayılan model `claude-opus-4-8`).

> Diyet Koçu kendi yerel veritabanını (`diet-coach`) kullanır; CRM verilerine dokunmaz.

## Teknik Altyapı

- **React + TypeScript** — modern, güvenli arayüz
- **Vite** — hızlı derleme aracı
- **Tailwind CSS** — mobil öncelikli tasarım
- **Dexie (IndexedDB)** — cihazda yerel, offline veritabanı
- **vite-plugin-pwa** — kurulabilir, çevrimdışı çalışan uygulama
- Sunucu (backend) yoktur — her şey telefonda çalışır.

## Geliştirme

```bash
npm install      # bağımlılıkları kur
npm run dev      # geliştirme sunucusu (http://localhost:5173)
npm run build    # üretim derlemesi (dist/ klasörüne)
npm run preview  # derlenmiş sürümü önizle
```

## Yayınlama (GitHub Pages)

`main` dalına her gönderimde GitHub Actions otomatik derleyip **GitHub Pages**'e yayınlar.

İlk kez kurulum:
1. GitHub'da bu deponun **Settings → Pages** bölümüne git.
2. **Source** olarak **GitHub Actions** seç.
3. `main` dalına bir değişiklik gönder; birkaç dakika içinde uygulaman `https://<kullanıcı-adın>.github.io/gorev-yonetim-sistemi/` adresinde yayında olur.

Telefonda o adresi aç → tarayıcı menüsünden **"Ana ekrana ekle"** → uygulama hazır.

## Veri Güvenliği

Verileriniz **yalnızca kullandığınız cihazda** saklanır; hiçbir sunucuya gönderilmez. Bu yüzden:
- Telefonu değiştirirken **Ayarlar → Yedeği İndir** ile yedek alın.
- Yeni cihazda **Yedekten Geri Yükle** ile taşıyın.

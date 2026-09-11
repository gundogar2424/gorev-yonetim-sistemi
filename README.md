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
| 📸 **Foto + inceleme** | Yemeğin fotoğrafını çek, yapay zeka tanısın; zararları ve motive edici sözleri gör |
| 📅 **Geçmiş** | Tüm fotoğraf ve kararların günlere göre kayıtlı listesi |
| 🔥 **Diyet serisi (streak)** | "Kaç gündür diyetini bozmadın" sayacı |
| 🏅 **Rozetler** | 1 / 3 / 7 / 14 / 30 / 60 / 100 / 365 günde açılan başarı rozetleri |

**Kurulum:** Fotoğraf incelemesi için bir **Anthropic (Claude) API anahtarı** gerekir. Diyet Koçu → **Ayarlar** bölümünden girilir; anahtar **yalnızca cihazda** saklanır, hiçbir sunucuya gönderilmez. Anahtar [console.anthropic.com](https://console.anthropic.com/settings/keys) üzerinden alınır. İncelemeler doğrudan tarayıcıdan Claude API'sine yapılır (varsayılan model `claude-opus-4-8`).

> Diyet Koçu kendi yerel veritabanını (`diet-coach`) kullanır; CRM verilerine dokunmaz.

## 🍲 Termomiks Defteri (ayrı program)

Bu depodaki **üçüncü bağımsız program**: **Termomiks Defteri**. Kendi giriş sayfası (`termomiks.html`) ve kendi veritabanı vardır; CRM'in ve Diyet Koçu'nun hiçbir dosyasını paylaşmaz/değiştirmez.

- **Termomiks Defteri** → `termomiks.html` (örn. `https://<kullanıcı>.github.io/gorev-yonetim-sistemi/termomiks.html`)

**Ne yapar?** İnternette bulduğun **normal (ocak/tencere usulü) bir tarifi** Thermomix TM7'ye uyarlanmış haliyle deftere alırsın: hangi adım kaç saniye, kaç devirde, kaç derecede, ne zaman ters yön, hangi özel mod (sote, hamur, Varoma, sous-vide…). Sonra mutfakta **adım adım pişirirsin**.

Uygulamanın içinde yapay zeka **yok**: API anahtarı, internet ya da abonelik gerekmez. Uyarlama başka bir yerde yapılır, sonuç bir **tarif kodu** (JSON) olarak verilir; sen kodu uygulamaya yapıştırırsın.

| Özellik | Açıklama |
|---|---|
| 📥 **Tarif kodu yapıştır** | Hazır TM7 kodunu yapıştır, tarif fotoğrafı ve uyarılarıyla deftere insin. Bir kodun içinde birden fazla tarif olabilir |
| 📖 **Tarif defteri** | Ara, kategoriye göre süz, favorile; her tarifin küçük fotoğrafı listede görünür |
| 📷 **Fotoğraf** | Tarif fotoğrafı kodun içinde gelebilir ya da telefonun galerisinden seçilir (cihazda saklanır) |
| ▶︎ **Pişirme modu** | Adımlar tek tek büyük yazıyla; her adımda geri sayım, süre bitince sesli uyarı + titreşim, sonraki adıma otomatik geçiş, ekran açık kalır |
| ✍️ **Elle tarif** | Kendi tarifini de adım adım (devir/sıcaklık/mod seçerek) yazabilirsin |
| ⚠️ **Uyarılar** | Kap doluluğu, sıcak sıvıyı yüksek devirde çekme gibi durumlarda uyarı satırı |
| 💾 **Yedekleme** | Tüm defteri (fotoğraflar dahil) tek dosyaya indir, telefon değişince geri yükle |

**Kurulum:** Sadece APK'yı kur, hesap/anahtar yok. Uygulama tamamen **çevrimdışı** çalışır; hiçbir veri sunucuya gitmez.

> Termomiks Defteri kendi yerel veritabanını (`termomiks-defter`) kullanır; CRM ve Diyet Koçu verilerine dokunmaz.

## 🧠 Zihin Jimnastiği (ayrı program)

Bu depodaki **dördüncü bağımsız program**: **Zihin Jimnastiği**. Kendi giriş sayfası (`zihin.html`), kendi rengi ve kendi kayıt alanı vardır; diğer üç programın hiçbir dosyasını paylaşmaz/değiştirmez.

- **Zihin Jimnastiği** → `zihin.html` (örn. `https://<kullanıcı>.github.io/gorev-yonetim-sistemi/zihin.html`)
- APK: `.github/workflows/zihin-apk.yml` iş akışı derler; `main`'e giren her değişiklikte **zihin-latest** sürümüne `zihin-jimnastigi.apk` yüklenir.

**Ne yapar?** Yaşlı kullanıcılar düşünülerek tasarlanmış (büyük yazı, büyük düğmeler, sade ekran) **8 zihin oyunu** sunar. Her gün 3 oyunluk kısa bir antrenman önerir; gün geçtikçe sıra bütün oyunlara gelir. Zorluk **kendiliğinden ayarlanır**: seviye geçilince zorlaşır, çok zorlanınca kolaylaşır.

| Oyun | Çalıştırdığı yeti | Nasıl oynanır |
|---|---|---|
| 🃏 **Hafıza Kartları** | Hafıza | Kapalı kartların eşini bul; seviye arttıkça kart sayısı artar |
| 🎨 **Sıra Takibi** | Hafıza (işleyen bellek) | Yanan renkleri aynı sırayla tekrarla; dizi her turda uzar |
| 📝 **Kelimeleri Hatırla** | Hafıza (sözel) | Listeyi ezberle, aradan sonra hangi kelimenin listede olduğunu tanı |
| 🚦 **Renk Tuzağı** | Dikkat (Stroop) | Yazılan renk adına değil, yazının mürekkep rengine göre cevap ver |
| 🔢 **Sayı Avı** | İşlem hızı | Karışık sayılara 1'den başlayıp sırayla dokun; üst seviyede sayılar yer değiştirir |
| 🔤 **Karışık Harfler** | Dil | Karışmış harflerden Türkçe kelimeyi kur; ipucu ilk harfi verir |
| 🧮 **Zihinden Hesap** | Hesap | Dört seçenekli hızlı işlem; üst seviyelerde çarpma/bölme ve iki adımlı işlemler |
| 🔍 **Farklı Olanı Bul** | Mantık / görsel dikkat | Gruba uymayan şekli bul; fark giderek incelir (ton, yön, boyut) |

Ek özellikler: günlük seri sayacı, gelişim ekranı (son 7 gün, oyun başına seviye ve son puanlar), günün beyin sağlığı ipucu, koyu tema, **büyük yazı** modu, ses/titreşim geri bildirimi, tek dosyaya yedekleme ve geri yükleme.

> **Önemli:** Bu oyunlar Alzheimer ya da demansı **önlemez, tedavi etmez**, tanı koymaz. Düzenli zihinsel uğraşın "bilişsel rezerv" oluşturduğuna dair araştırmalar vardır; ancak en güçlü koruyucu etkenler fiziksel hareket, tansiyon-şeker kontrolü, iyi uyku, işitmenin düzeltilmesi, sigarayı bırakmak ve sosyal bağlardır. Günlük yaşamı etkileyen unutkanlıkta bir nöroloji uzmanına başvurulmalıdır.

> Zihin Jimnastiği verisini yalnızca `zn-` önekli yerel anahtarlarda tutar; diğer programların verisine dokunmaz. İnternet, hesap ya da izin gerektirmez.

## 🤲 EFT Dokunma (ayrı program)

Bu depodaki **beşinci bağımsız program**: **EFT Dokunma**. Kendi giriş sayfası (`eft.html`), kendi rengi (deniz yeşili) ve kendi kayıt alanı vardır; diğer programların hiçbir dosyasını paylaşmaz/değiştirmez.

- **EFT Dokunma** → `eft.html` (örn. `https://<kullanıcı>.github.io/gorev-yonetim-sistemi/eft.html`)
- APK: `.github/workflows/eft-apk.yml` iş akışı derler; `main`'e giren her değişiklikte **eft-latest** sürümüne `eft-dokunma.apk` yüklenir.

**Ne yapar?** EFT (Emotional Freedom Techniques, Duygusal Özgürleşme Tekniği / "tapping"), rahatsız edici bir duyguya odaklanırken yüz ve üst gövdedeki belirli noktalara parmak uçlarıyla hafifçe vurmaya dayanan bir gevşeme tekniğidir. Uygulama klasik "kısa reçete" akışını adım adım yönetir:

| Adım | Ekranda ne olur |
|---|---|
| 1 · **Konu** | 10 hazır konu (kaygı, stres, öfke, üzüntü, korku, ağrı, uykusuzluk, özgüven, istek krizi, suçluluk) ya da kendi yazdığın konu; son yazdıkların hızlı seçim olarak saklanır |
| 2 · **Puan (0-10)** | Rahatsızlık yoğunluğunu büyük düğmelerle seç (SUDS ölçeği) |
| 3 · **Kurulum cümlesi** | El çizimi üzerinde karate noktası atar; "Her ne kadar … olsa da, kendimi derinden ve tamamen kabul ediyorum" cümlesi düzenlenebilir, 3 kez söylenir |
| 4 · **8 nokta** | Baş/gövde çizimi üzerinde aktif nokta ritimle "atar"; her vuruşta hafif tık sesi ve titreşim; nokta başına 5/7/9 vuruş, hız ayarlanabilir; noktalar kendiliğinden ilerler (istersen elle) ve her noktada söylenecek hatırlatma ifadesi büyük yazıyla gösterilir |
| 5 · **Nefes** | Genişleyip daralan nefes dairesi |
| 6 · **Yeniden puan** | Başlangıç → şimdi karşılaştırması; "bir tur daha" (kalan duyguyla, ifadeler değişir), yoğunluk 3'ün altına inince "olumlu tur", ya da bitir |
| 7 · **Kayıt** | Seans not ile kaydedilir |

**🍽️ Yemek isteği modu:** Ana sayfada ya da konu ekranında canını çeken yemeği yaz (örn. çikolata, cips, pizza, kola). Uygulama yemeğin türünü tanır (tatlı / tuzlu-çıtır / hamur işi / fast food / içecek) ve o türe özel **telkinleri** üretip gösterir: kurulum cümlesi, 8 noktaya dağılmış hatırlatma ifadeleri ve olumlu tur ifadeleri. Telkinleri sadece okuyabilir ya da "Vuruşlarla seansa başla" ile aynı akışta isteği söndürebilirsin. Son yazdığın yemekler hızlı seçim olarak saklanır.

**🔊 Sesli rehber:** Telefonu tutup okumadan uygulayabilmek için uygulama kurulum cümlesini, her noktanın adını ve o noktadaki ifadeyi **sesli okur** (telefonun kendi Türkçe metin okuma motoru, yerel eklenti; internet gerekmez). Kurulumda cümleyi okur, kısa ara verir, üç tekrarı kendisi sayar ve noktalara geçer; nefes ve yeniden puanlama yönergeleri de seslidir. Seans ekranındaki hoparlör düğmesiyle anında kapatılıp açılır; Ayarlar'da konuşma hızı seçilir, "Sesi dene" ile kontrol edilir; Türkçe ses yüklü değilse "Türkçe ses yükle" Android'in metin okuma verisi ekranını açar. Telkin ekranındaki "Telkinleri dinle" tüm ifadeleri baştan sona okur.

**Açlığı bastır:** Belirli bir yemek değil, genel yeme isteği için dört hazır telkin seti: **genel açlık** (öğün arası atıştırma isteği), **gece açlığı** (buzdolabına gitme isteği), **diyet / oruç açlığı** (pes etme isteği) ve **duygusal açlık** (can sıkıntısı, stres ya da üzüntüden yeme). Ana sayfadaki yemek kartından tek dokunuşla telkin ekranı açılır; puan soruları "istek ne kadar şiddetli" biçimindedir. Bu telkinler öğün aralarındaki ani isteği yönetmek içindir; uzun süreli açlıkta bedeni beslemek, tıbbi diyet ve oruçta hekim/diyetisyen takibi gerekir.

Diğer ekranlar: **Noktalar** (çizim üzerinde noktaya dokun → nerede/nasıl açıklaması, adım adım rehber), **Geçmiş** (seans sayısı, ortalama düşüş, dakika, son 7 gün, en çok çalışılan konular, seans listesi), **Ayarlar** (ritim hızı, vuruş sayısı, otomatik ilerleme, ses/titreşim, tema, büyük yazı, yedekleme/geri yükleme). Seans sırasında ekran uyumaz (destekleyen cihazlarda).

> **Önemli:** EFT bir kendine yardım ve gevşeme tekniğidir; tıbbi ya da psikolojik tedavinin **yerini tutmaz**. Depresyon, panik bozukluk, travma ya da kendine zarar verme düşüncelerinde bir ruh sağlığı uzmanına; şiddetli ya da açıklanamayan ağrıda hekime başvurulmalıdır.

> EFT Dokunma verisini yalnızca `eft-` önekli yerel anahtarlarda tutar; diğer programların verisine dokunmaz. İnternet, hesap ya da izin gerektirmez.

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

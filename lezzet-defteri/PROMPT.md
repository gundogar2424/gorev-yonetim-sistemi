# Lezzet Rotası — Uygulama Promptu

Aşağıdaki özelliklere sahip, Türkçe arayüzlü bir Android uygulaması yap: **Lezzet Rotası**. Sosyal medyada gördüğüm tarifleri ve mekanları tek dokunuşla kaydeden, düzenleyen, pişirmeme ve gezmeme yardım eden kişisel bir yemek defteri.

## Temel ilkeler
- **Hesap yok, sunucu yok.** Tüm veriler telefonda (IndexedDB) durur. API anahtarları yalnızca telefonda saklanır, yedeğe girmez.
- **Yapay zeka:** Google Gemini (varsayılan) ya da Claude; kullanıcı kendi anahtarını Ayarlar'a girer. Harcama tahmini, günlük istek sınırı ve tasarruf modu olsun. Kota/harcama sınırı hatalarında Google'ın kendi mesajını göster; işi yarım bırakma, sıraya geri koy.
- **Sıralama:** Her listede (tarifler, mekanlar, öneriler) en beğenilen / en yüksek puanlı her zaman en üstte, arama yaparken bile.
- **Arama:** Türkçe harf ve yazım hatası toleranslı (ç/c, ş/s, ı/i; 1–2 harf hatası), Google gibi.
- **Tasarım:** Mobil öncelikli, sade, açık/koyu tema, yatay taşma yok.
- **Teknik:** React + TypeScript + Vite + Tailwind, Dexie (IndexedDB), Capacitor ile Android APK; GitHub Actions ile APK derlenir ve sabit bir indirme linkine (zip) konur.

## 1. Paylaşımdan kaydetme
- Android **Paylaş** menüsünde iki seçenek: **"Lezzet Rotası: Tarif"** ve **"Lezzet Rotası: Mekan"**.
- Instagram, TikTok, YouTube, web sayfası ya da düz metin paylaşılabilir. Paylaşımlar **sıraya** girer, art arda gönderilebilir, aynı anda 2 iş işlenir; uygulama kapansa da sıra kaybolmaz (arka planda bildirimli servis).
- Önce açıklama okunur; yetmezse video indirilir ve yapay zekaya (Gemini videoyu ses+görüntüyle anlar) verilir. Video 75 sn'de inmezse açıklamadan devam edilir; tek iş en fazla 8 dk sürer, takılan iş hataya düşer, sıra kilitlenmez.
- Kaydırmalı gönderilerde görsellerdeki tarifler okunur; aynı gönderideki birden fazla tarif ayrı ayrı eklenir.
- Aynı link ya da aynı tarif ikinci kez eklenmez (farklı kişilerin aynı yemeği ayrı sayılır).
- Günlük sınır dolarsa iş yarım eklenmez, sırada bekler ve ertesi gün devam eder.

## 2. Tariflerim
- Tarif kartı: fotoğraf, başlık, paylaşan kişi, süre, porsiyon, etiketler, **beğeni puanı (1–10)** — paylaşımın beğeni/yorum/izlenme sayılarından yapay zekasız hesaplanır, arada güncellenir.
- Tarif sayfası: porsiyon ölçekleme, malzemeleri alışveriş listesine ekleme, haftalık plana ekleme, favori, besin değeri (yapay zeka), kaynağa gitme (video açılır, profil değil).
- **Pişirme modu:** adım adım büyük yazı; her adımda o adımın malzemeleri, tam malzeme listesi, sayaç (listenin üstünde), "Malzemeleri bölümlere ayır" (yapay zeka; ör. alt kat / orta kat).
- **Sofralar:** tarifleri kişilere göre grupla (Kocam, Çocuklar…); sevmedikleri/alerjiler not edilir.
- **Ne pişirsem?** eldeki malzemeye ve sofraya göre öneri. **Tarif değiştir:** sohbetle tarifi uyarlama (ör. "unsuz yap").
- **Hype tarifler:** en beğenilenler.
- Paylaş: tarifi **HTML sayfası** olarak gönder (karşı taraf uygulamasız açar, adım adım pişirebilir); ayrıca Thermomix sayfası.

## 3. Thermomix (TM7)
- Her tarifin Thermomix uyarlaması: gram cinsinden malzemeler, her adımda süre / sıcaklık / hız / ters yön / mod (sote, karamel, hamur, varoma…) / kelebek.
- Uyarlarken önce Google'da resmi Cookidoo tarifine bakılır, ayarlar ona göre verilir; referans gösterilir.
- **Kural denetimi** (yapay zeka hata yapsa da düzeltilir): 120 °C üstü → sote; hamurda sıcaklık/hız yok; sote/karamelde ters yön ve hız ≤ 2; kelebekte hız ≤ 4; sıcakta turbo yok; labne/mascarpone soğukta ters yön, hız ≤ 3, ≤ 40 sn; sütlü-nişastalı kremada süre süt miktarına göre (1 L → 14 dk, 90 °C, hız 4); 2 kg ısıtma kapasitesi uyarısı; kaşık → gram tablosu.
- Thermomix pişirme ekranı: adım kutuları (Süre/Sıcaklık/Hız/Yön/Aksesuar), sıradaki adım önizlemesi, ipuçları.
- **Cookidoo'ya ekle:** Cookidoo yalnızca elle girişe izin verdiği için başlık, malzemeler, adımlar, ipuçları ayrı ayrı kopyalanır (Cookidoo biçiminde "14 dk/90°C/hız 4").

## 4. Mekanlarım
- Paylaşılan videodaki yeme-içme mekanını bulur (Google Places ya da OpenStreetMap), adres, puan, konum. Google Haritalar kısa linkinden yapay zekasız mekan çıkarır.
- Aynı mekan ikinci kez eklenmez; farklı influencer'ların paylaşımları mekanın altında "Başka paylaşanlar" olarak, aynı kişinin başka platformdaki paylaşımı ek link olarak durur.
- **Şu an buradayım:** konumdan yakındaki mekanları listeler, seçince kaydeder ve ziyaret formu açar.
- Ziyaretler, harcamalar (**Harcamalarım**), **Gittiklerim**, **Gezi planı**.
- **Etiketler** bölümü (Mekanlarım'ın üstünde): etikete/yemeğe dokununca mekanlar yakından uzağa sıralanır.
- **Harita:** tüm mekanlar haritada nokta olarak (Leaflet + OpenStreetMap).
- **Kampanyalar:** yakından uzağa kontrol (en yakın 15'ten başlar), kart dokununca açılır.
- **Mekan öner / Hype / Gitmek istiyorum** işaretleri; **Sınırsız** (açık büfe dahil, serpme kahvaltı hariç).
- **Takip ettiğim influencer'lar:** influencer sayfası, şehir sekmeleri, "yeni yerler" (tıklayınca asıl video açılır), profil linki platform adıyla.
- Mekanı HTML sayfası olarak paylaş.

## 5. Planlama ve sağlık
- **Bu hafta:** günlere ve öğünlere tarif yerleştirme.
- **Alışveriş listesi:** gruplu, tariflerden otomatik.
- **Diyetim:** diyet listesi girilir ("Yeni liste"), yeni tarifler öğünlerle otomatik karşılaştırılır.

## 6. Tarif sitesi (herkese açık)
- GitHub Pages'te sitem: ana sayfa (arama, kategori sekmeleri, kartlar), her tarif ayrı sayfa, schema.org Recipe verisi (Google'ın anladığı biçim), sitemap.xml, robots.txt; liste her eklemede GitHub Actions ile kendiliğinden güncellenir.
- Uygulamada **Siteye koy** (tek tarif) ve **Thermomix tariflerini / Tüm tarifleri siteye koy** (toplu); kullanıcının GitHub anahtarı (yalnızca o depoya yazma izni) telefonda saklanır.

## 7. Yedekleme
- **Elle yedek:** paylaşım menüsüyle Drive/e-postaya; tarifler, mekanlar, ziyaretler, plan, alışveriş, diyet, influencer listeleri ve ayarlar (anahtarlar hariç). Geri yükleme mevcut veriyi silmez, aynı başlıklıları atlar.
- **Otomatik yedek:** her gün telefonun **Belgeler/LezzetRotasi** klasörüne (son 10 gün); uygulama silinse de kalır. Boş veri yedeklenmez.
- Telefonda hiç tarif yoksa açılışta sitedeki yedekten tarifler kendiliğinden geri yüklenir.

## Davranış kuralları
- Kısa, Türkçe mesajlar; hata olursa nedenini ve ne yapılacağını söyle.
- Kullanıcı verisini izinsiz hiçbir yere gönderme; site yalnızca kullanıcının "Siteye koy" dediği tarifleri içerir.

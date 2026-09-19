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
| 1 · **Konu** | 11 hazır konu (sabah enerjisi, kaygı, stres, öfke, üzüntü, korku, ağrı, uykusuzluk, özgüven, istek krizi, suçluluk) ya da kendi yazdığın konu; son yazdıkların hızlı seçim olarak saklanır |
| 2 · **Puan (0-10)** | Rahatsızlık yoğunluğunu büyük düğmelerle seç (SUDS ölçeği) |
| 3 · **Kurulum cümlesi** | El çizimi üzerinde karate noktası atar; "Her ne kadar … olsa da, kendimi derinden ve tamamen kabul ediyorum" cümlesi düzenlenebilir, 3 kez söylenir |
| 4 · **8 nokta** | Baş/gövde çizimi üzerinde aktif nokta ritimle "atar"; her vuruşta hafif tık sesi ve titreşim; nokta başına 5/7/9 vuruş, hız ayarlanabilir; noktalar kendiliğinden ilerler (istersen elle) ve her noktada söylenecek hatırlatma ifadesi büyük yazıyla gösterilir |
| 5 · **Nefes** | Genişleyip daralan nefes dairesi |
| 6 · **Yeniden puan** | Başlangıç → şimdi karşılaştırması; "bir tur daha" (kalan duyguyla, ifadeler değişir), yoğunluk 3'ün altına inince "olumlu tur", ya da bitir |
| 7 · **Kayıt** | Seans not ile kaydedilir |

**🍽️ Yemek isteği modu:** Ana sayfada ya da konu ekranında canını çeken yemeği yaz (örn. çikolata, cips, pizza, kola). Uygulama yemeğin türünü tanır (tatlı / tuzlu-çıtır / hamur işi / fast food / içecek) ve o türe özel **telkinleri** üretip gösterir: kurulum cümlesi, 8 noktaya dağılmış hatırlatma ifadeleri ve olumlu tur ifadeleri. Telkinleri sadece okuyabilir ya da "Vuruşlarla seansa başla" ile aynı akışta isteği söndürebilirsin. Son yazdığın yemekler hızlı seçim olarak saklanır.

**📜 Kayan yazı (teleprompter), ana kullanım biçimi:** Ana sayfada konuya dokun; önce 0-10 puan ver (yemek/açlıkta "istek ne kadar şiddetli"), 3 tur bitince akış durup yeniden puan ister, "Puanla" ile istediğin an puanlayıp "Bitir ve kaydet" ile seansı geçmişe yazarsın; üstte manken, banttaki noktayı ritimle atarak (tık sesiyle) gösterir, metin ekranda **kendiliğinden yukarı akar**: kurulum cümlesi (3 tekrar), sırayla 8 nokta ve ifadeleri, nefes, 2. tur (kalan duygu), 3. tur (olumlu), sonra başa döner ve durmadan akar. Hız 7 kademe (kaydırıcı ya da −/+), yazı boyutu 5 kademe, dokununca duraklar; **◀ Önceki / Sonraki ▶** düğmeleriyle satır satır elle ilerlenir (akış durur, tık ritmi o noktada sürer, "Devam" ile akış yeniden başlar), "Başa" ile başa döner; ayarlar hatırlanır, ekran uyumaz. Ana sayfadaki karttan, telkin ekranından ve vuruş ekranından açılır.

**🔔 Tık sesi:** Vuruş ve kayan yazı ekranlarında her atımda hafif bir tık sesi ve kısa titreşim verilir (Ayarlar › Geri bildirim'den kapatılabilir; "Tık sesini dene" ile kontrol edilir). Sesli okuma yoktur.

**Açlığı bastır:** Belirli bir yemek değil, genel yeme isteği için dört hazır telkin seti: **genel açlık** (öğün arası atıştırma isteği), **gece açlığı** (buzdolabına gitme isteği), **diyet / oruç açlığı** (pes etme isteği) ve **duygusal açlık** (can sıkıntısı, stres ya da üzüntüden yeme). Ana sayfadaki yemek kartından tek dokunuşla telkin ekranı açılır; puan soruları "istek ne kadar şiddetli" biçimindedir. Bu telkinler öğün aralarındaki ani isteği yönetmek içindir; uzun süreli açlıkta bedeni beslemek, tıbbi diyet ve oruçta hekim/diyetisyen takibi gerekir.

Diğer ekranlar: **Noktalar** (çizim üzerinde noktaya dokun → nerede/nasıl açıklaması, adım adım rehber), **Geçmiş** (seans sayısı, ortalama düşüş, dakika, son 7 gün, en çok çalışılan konular, seans listesi), **Ayarlar** (ritim hızı, vuruş sayısı, otomatik ilerleme, ses/titreşim, tema, büyük yazı, yedekleme/geri yükleme). Seans sırasında ekran uyumaz (destekleyen cihazlarda).

> **Önemli:** EFT bir kendine yardım ve gevşeme tekniğidir; tıbbi ya da psikolojik tedavinin **yerini tutmaz**. Depresyon, panik bozukluk, travma ya da kendine zarar verme düşüncelerinde bir ruh sağlığı uzmanına; şiddetli ya da açıklanamayan ağrıda hekime başvurulmalıdır.

> EFT Dokunma verisini yalnızca `eft-` önekli yerel anahtarlarda tutar; diğer programların verisine dokunmaz. İnternet, hesap ya da izin gerektirmez.

## 🎤 Ses Egzersizi (ayrı program)

Bu depodaki **altıncı bağımsız program**: **Ses Egzersizi**. Kendi giriş sayfası (`ses.html`), kendi rengi (turuncu) ve kendi kayıt alanı vardır; diğer programların hiçbir dosyasını paylaşmaz/değiştirmez.

- **Ses Egzersizi** → `ses.html` (örn. `https://<kullanıcı>.github.io/gorev-yonetim-sistemi/ses.html`)
- APK: `.github/workflows/ses-apk.yml` iş akışı derler; `main`'e giren her değişiklikte **ses-latest** sürümüne `ses-egzersizi.apk` yüklenir.

**Ne yapar?** Vokal kord (ses teli) **addüksiyon** egzersizlerini — ses tellerinin birbirine tam kapanmasını güçlendirmeye yönelik, ses terapisinde yaygın teknikleri — evde adım adım yaptırır. Hasta kendi başına kullanır; bir KBB hekimi / dil ve konuşma terapistinin önerisiyle başlanması ve uygun olmayan egzersizlerin Ayarlar'dan kapatılması beklenir.

| Bölüm | Ekranda ne olur |
|---|---|
| ▶ **Rehberli seans** | Ana sayfada günlük hedef kartı (günde 1-3 seans, varsayılan 2; son 7 günün durumu). Egzersizler sırayla: önce nasıl yapılacağı, sonra her tekrar için 3-2-1 geri sayım, tutma süresi (büyük rakam + söylenecek ses), dinlenme arası; sesli tık/işaret ve titreşim; tekrar noktaları; duraklat / ileri / atla; ekran uyumaz |
| 🎬 **Videolar** | Egzersiz girişinde en üstte video. Kendi ürettiğimiz kısa gösterim klipleri (`public/ses-video/<id>.mp4`) uygulamanın içindedir ve **internetsiz** oynar; bir egzersizin kendi klibi varsa YouTube o egzersizde gösterilmez. Kendi videosu henüz olmayan egzersizlerde geçici olarak YouTube gömülür. "Videolar" sayfası (ana sayfa ve Egzersizler'den) önce kendi videolarımızı, sonra kalan YouTube bağlantılarını listeler |
| 📋 **Egzersizler** | Isınma (karın nefesi, dudak titretme, mırıldanma) · Addüksiyon (sert başlangıçlı sesli harfler, öksürükten sese, yarım yutkunma "bum", başı çevirerek "iii", uzun "A" tutma, Vokal Fonksiyon Egzersizleri 1-4: yumuşak uzun "i", perde kaydırma "nol", beş basamak "ol", gür "A" ve gür ifadeler (PhoRTE), suda tüp fonasyonu (Lax Vox); itme/çekme ile "A!" varsayılan kapalı) · Soğutma (pipetle ses). Her biri için *neden yapılır*, *nasıl yapılır*, söylenecek ses ve varsa *dikkat* notu; tek başına yapma ve seanstan çıkarma |
| 🗣️ **Diksiyon** | Aynı uygulamada ayrı sekme: nefes (diyafram, uzun "s"), sesli harfler (ağız şekli tarifiyle 8 sesli, geçişler), ünsüz/hece dizileri (dudak, diş-dudak, dil ucu, "r", damak, ıslıklı), 10 klasik tekerleme, kalemle okuma, vurgu değiştirme, tonlama, hız kontrolü. Rehberli diksiyon seansı: her satır büyük yazıyla, tempoya (yavaş/orta/hızlı) göre süre çubuğu, ◀/⏸/▶▶/atla, isteğe bağlı ses düzeyi çubuğu; egzersizler tek tek aç/kapat |
| 🎙️ **Performans değerlendirmesi** | (1) **Konuşma tanıma ile doğruluk puanı**: diksiyonda her satırda söylenen, telefonun Türkçe konuşma tanımasıyla yazıya çevrilir, hedef metinle sözcük sözcük hizalanır; % doğruluk, sözcük/dk hızı, yutulan/yanlış sözcükler kırmızı işaretlenir, "yeniden dene". (2) **Öz değerlendirme 1-5**: diksiyonda her egzersiz sonunda, addüksiyon seansında seans sonunda. (3) **Yapay zeka geri bildirimi (Claude)**: seans sonunda sonuçlar (doğruluk, yutulan sözcükler, hız, öz değerlendirme, MPT, önceki 15 seansın eğilimi) gönderilir; yazılı geri bildirim + **sonraki seans planı** (tempo, yoğunluk, odak egzersizleri, hedef) alınır, "Öneriyi uygula" ile tek dokunuşta ayarlara işlenir (hiçbir egzersiz kapatılmaz, yalnızca açılır); API anahtarı Ayarlar'a girilir, yalnızca cihazda saklanır, yedeğe yazılmaz. Ses kaydı hiçbir yere gönderilmez; yapay zeka sesi duymaz |
| ⏱️ **Ses ölçümü (MPT + akustik)** | En uzun "A" tutma süresi: mikrofon açılınca ses başladığında kronometre kendiliğinden başlar, sessizlikte durur; ses düzeyi çubuğu; sonuç yorumu; kayıt. Aynı sinyalden **ses kalitesi** de ölçülür (cihazda sinyal işleme, yapay zeka yok): perde (F0, Hz), perde titremesi (jitter %), şiddet titremesi (shimmer %), harmonik/gürültü oranı (HNR dB, düşükse ses nefesli = hava kaçağı). Sade dille yorum, iyi/orta/zayıf rozetleri, geçmiş ve grafik; Claude'a da gönderilir. Telefon mikrofonu klinik değildir: sayılar kişinin kendi geçmişiyle karşılaştırma içindir, tanı koymaz. Mikrofon izni yoksa elle kronometre. Ses **kaydedilmez**, yalnızca anlık ölçülür |
| 🔔 **Günlük hatırlatma** | 3 ayrı saate kadar "egzersiz zamanı" bildirimi (yalnızca APK'da); bildirime dokununca seans açılır |
| 📈 **İlerleme** | Seri (üst üste gün), seans/dakika sayısı (ses ve diksiyon ayrı sayılır), son 7 gün çubukları, MPT çizgi grafiği (10 sn hedef çizgisi), ses kalitesi (HNR) grafiği, diksiyon doğruluğu grafiği (%85 hedef çizgisi), öz değerlendirme grafiği, seans ve ölçüm listeleri, silme |
| ⚙️ **Ayarlar** | Ad, yoğunluk (hafif/orta/yoğun = tekrar çarpanı), geri sayım, egzersiz aç/kapat, diksiyon temposu ve diksiyon egzersizleri, hatırlatma saatleri, ses/titreşim, tema, büyük yazı, yedek al/geri yükle, tümünü sil, uyarı metni |

İlk açılışta uyarı metni gösterilir ve onaylatılır: ağrı, yanma, ses kısıklığında artış ya da baş dönmesinde durulmalı; itme/çekme egzersizleri kan basıncını geçici yükselttiği için tansiyon/kalp/glokom/fıtık sorunu olanlar önce hekime sormalıdır.

**Program ön ayarları (kanıta dayalı):** İlk açılışta seçilir, Ayarlar'dan değiştirilir. *Ses teli felci / zayıf kapanma*: 2025 uzman uzlaşısı protokolü (karın nefesi, öksürükten sese, yarım yutkunma "bum", VFE) + sert başlangıç, baş çevirme, suda tüp fonasyonu (su direnci terapisi, 2024); gür ses egzersizleri başta kapalı. *Yaşa bağlı ses zayıflığı (presbifoni)*: PhoRTE + VFE + SOVT (2024 sistematik derleme ve kapsam derlemesi); zorlayıcı kapanma teknikleri kapalı. *Genel*: itme/çekme dışında tümü. Ana sayfada "2 dk pipet molası" (kısa-sık SOVT).

**Kaynaklar:** Egzersiz seçimi ve dozu literatüre göre düzenlendi (tam liste ve bağlantılar uygulamada Ayarlar › Kaynaklar ve `src/ses/lib/sources.ts`): tek taraflı ses teli felci için Delphi ile seçilmiş eklektik protokol (öksürük-fonasyon, yarım yutkunma "bum", Vokal Fonksiyon Egzersizleri, karın nefesi; J Voice 2025), erken dönem fonasyonsuz addüksiyon egzersizleri RCT'si (J Voice 2025), sert glottal başlangıçla erken terapi (J Voice 2016), VFE sistematik derlemesi ve doz çalışması (günde 2 kez, 6-8 hafta), PhoRTE RCT'si (gür ses egzersizleri, presbifoni), yarı kapalı ses yolu derlemesi (2025), MPT ağ meta-analizi (2023) ve normları (Iowa protokolleri; yaşlı normları), telefon kayıtlarında akustik ölçüm güvenilirliği meta-analizi (AJSLP 2025: perde ve jitter güvenilir, shimmer/HNR daha az), AAO-HNS ses kısıklığı kılavuzu (2018). İtme/çekme egzersizleri literatürdeki hiperfonksiyon uyarısı nedeniyle **varsayılan kapalıdır**; terapist önerdiyse açılır. Günlük hedef kartı (varsayılan günde 2 seans) VFE doz çalışmasına dayanır.

> **Önemli:** Ses Egzersizi bir egzersiz rehberidir; tıbbi cihaz değildir, tanı koymaz ve KBB hekimi / dil ve konuşma terapistinin değerlendirmesinin **yerini tutmaz**.

> Ses Egzersizi verisini yalnızca `ses-` önekli yerel anahtarlarda tutar; diğer programların verisine dokunmaz. İnternet ve hesap gerektirmez; yalnızca mikrofon (ölçüm ve konuşma tanıma için) ve bildirim (hatırlatma için) izni ister, ikisi de isteğe bağlıdır. Konuşma tanıma telefonun kendi servisini kullanır; çevrimdışı Türkçe paketi yüklüyse internetsiz de çalışır. Yapay zeka geri bildirimi isteğe bağlıdır ve internet + API anahtarı gerektirir.

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

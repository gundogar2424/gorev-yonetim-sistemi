# Vega Stok — Resimli Stok, Tedarik ve Hızlı Teklif Sistemi

Yerel ağda (intranet) çalışır. VegaWin'in MS SQL veritabanını **yalnızca okur**;
arayüz Vega'ya hiç dokunmaz, her şeyi yerel önbellekten sunar.

## Mimari

```
 VegaWin ──yazar──▶ MS SQL (Vega)
                       │  yalnızca SELECT ... WITH (NOLOCK), en çok 3 bağlantı
                       ▼
              ┌──────────────────┐   30 sn: sadece hareket gören kartların bakiyesi
              │ Eşitleme servisi │   15 dk: tüm kartlar + fiyatlar + bakiyeler
              └────────┬─────────┘
                       ▼
              ┌──────────────────┐   ürün önbelleği + tam metin arama (FTS5)
              │  Yerel SQLite    │   + KENDİ verimiz: görsel, termin, kritik eşik,
              └────────┬─────────┘     teklifler (Vega'ya asla yazılmaz)
                       ▼
              ┌──────────────────┐
              │  Fastify API     │──▶ React + Tailwind arayüz (PC)
              │  :4000           │──▶ /depo  el terminali sayfası (barkod)
              └──────────────────┘──▶ PDF teklif (HTML→PDF), WebP görseller (sharp)
```

Neden böyle:
- **Hız:** Arama Vega'ya gitmez; yerel FTS5 dizini her tuş vuruşunda ~1 ms'de yanıt verir.
- **Vega güvenliği:** Vega'ya giden yük, kullanıcı sayısından bağımsızdır (yalnızca eşitleme servisi bağlanır).
- **Dayanıklılık:** Vega sunucusu kapalıyken de katalog ve arama son bilinen veriyle çalışır.

## Klasör yapısı

```
vega-stok/
├─ backend/                     Node.js 22 + Fastify + TypeScript
│  ├─ .env.example              bağlantı ve eşitleme ayarları
│  └─ src/
│     ├─ config.ts              ayarlar
│     ├─ server.ts              API girişi
│     ├─ vega/
│     │  ├─ baglanti.ts         salt-okunur MS SQL havuzu + SELECT denetimi
│     │  ├─ sema.ts             Vega tablo/kolon eşlemesi (Vega'ya özgü her isim burada)
│     │  ├─ sorgular.ts         ürün, fiyat, stok sorguları (NOLOCK)
│     │  └─ kesif.ts            gerçek şemayı listeler, eşlemeyi doğrular
│     ├─ esitleme/servis.ts     hızlı tur / tam tur
│     └─ yerel/db.ts            SQLite önbellek + anlık arama
│     ├─ gorsel/servis.ts       yüklenen görseli iki WebP boyutuna çevirir
│     ├─ yerel/demo.ts          `npm run demo` örnek verisi
│     ├─ tedarik/               açık siparişler, termin, kritik eşik, kritik stok panosu
│     ├─ kimlik/                kullanıcılar, roller, oturumlar, yetki denetimi
│     ├─ teklif/                teklif kaydı, PDF (pdfmake), WhatsApp metni, firma ayarları
│     (sonraki aşamalar)
│     └─ cari/                  bakiye, son alınanlar, ekstre özeti
├─ ortak/teklif-hesap.ts        iskonto/KDV hesabı — arayüz ve sunucu AYNI dosyayı kullanır
└─ frontend/                    React + Vite + Tailwind
   └─ src/
      ├─ App.tsx                sayfa geçişleri + Vega eşitleme göstergesi
      ├─ Katalog.tsx            anlık arama, filtreler, ürün kartları
      ├─ UrunDetay.tsx          detay, tedarik siparişleri, kritik eşik, görsel yükleme
      ├─ KritikStok.tsx         "Sipariş Gerektirenler" panosu
      ├─ Tedarik.tsx            açık siparişler ve termin takibi
      ├─ Depo.tsx               el terminali (barkod) sayfası
      ├─ Teklif.tsx             teklif listesi ve hazırlama ekranı
      ├─ Ayarlar.tsx            firma bilgileri ve logo
      ├─ Giris.tsx              giriş ve ilk kurulum ekranı
      ├─ Kullanicilar.tsx       kullanıcı yönetimi (yönetici) ve şifre değiştirme
      └─ api.ts                 backend istemcisi
```

## Kurulum (sunucu bilgisayarı, Windows — PowerShell)

**1) Araçlar**
```powershell
winget install OpenJS.NodeJS.LTS
winget install Git.Git
```

**2) Vega SQL Server'da salt-okunur kullanıcı** (SSMS'te, yönetici olarak bir kez):
```sql
CREATE LOGIN stok_okuyucu WITH PASSWORD = 'GucluBirSifre!', CHECK_POLICY = OFF;
USE VEGADB;   -- kendi Vega veritabanı adınız
CREATE USER stok_okuyucu FOR LOGIN stok_okuyucu;
ALTER ROLE db_datareader ADD MEMBER stok_okuyucu;   -- yalnızca okuma
```
SQL Server Configuration Manager'da **TCP/IP** etkin olmalı ve "SQL Server and
Windows Authentication" (mixed mode) açık olmalıdır.

**3) Uygulama**
```powershell
git clone https://github.com/gundogar2424/gorev-yonetim-sistemi.git
cd gorev-yonetim-sistemi\vega-stok\backend
npm install
copy .env.example .env
notepad .env            # sunucu, veritabanı, kullanıcı, şifre, firma/dönem
npm run vega:kesif      # Vega şemasını doğrula (aşağıya bakın)

cd ..\frontend
npm install
npm run build           # arayüzü derle; backend bunu aynı porttan sunar

cd ..\backend
npm start               # http://SUNUCU-IP:4000  (ağdaki tüm cihazlardan)
```

**Vega olmadan denemek için:** `npm run demo` — örnek ürünlerle, ayrı bir demo
veritabanında (`veri/demo/`) çalışır; Vega'ya hiç bağlanmaz.

**Geliştirme:** bir pencerede `backend` içinde `npm run dev`, diğerinde
`frontend` içinde `npm run dev` (http://localhost:5173, anında yenileme).

## Tedarik siparişleri nerede tutulur?

Tedarikçi siparişleri, termin tarihleri ve kritik eşikler şimdilik **bu programda
elle girilir** ve yerel veritabanında durur. Siparişleri Vega'da da giriyorsanız
oradan otomatik okunabilir; bunun için Vega'daki sipariş tablolarının adları
(`npm run vega:kesif` çıktısı) gerekiyor. "Teslim alındı" yalnızca siparişi
"yolda" olmaktan çıkarır; stok artışı Vega'daki mal girişiyle gelir.

## Kullanıcılar ve roller

Programı ilk açan kişi yönetici hesabını oluşturur (kurulumdan hemen sonra bunu
siz yapın). Diğer herkesi yönetici **Kullanıcılar** sayfasından ekler.

| Rol | Erişim |
|---|---|
| Yönetici | Her şey; kullanıcılar ve firma ayarları dahil |
| Satış | Katalog, teklif, tedarik, kritik stok, depo |
| Depo | Katalog, tedarik, kritik stok, depo — teklifleri göremez |

Yetkiler sunucuda denetlenir (menüden gizlemekle yetinilmez). Şifreler
veritabanında yalnızca özet (scrypt) olarak durur. Beş hatalı denemede kullanıcı
adı 1 dakika kilitlenir. Rolü değişen, şifresi sıfırlanan ya da devre dışı
bırakılan kullanıcının açık oturumları anında kapanır. Oturum 30 gün
kullanılmazsa sona erer. Bağlantı yerel ağda şifresiz (http) olduğundan program
internete açılmamalıdır. Demo hesapları: `yonetici`, `satis`, `depo` — şifre `demo1234`.

## Teklif

İlk iş **Ayarlar** sayfasından firma bilgilerini ve logoyu girin; Vega'daki satış
fiyatlarınız KDV dahilse oradaki kutuyu işaretleyin. Teklif ekranında ürün
arayıp Enter ile sepete eklenir. İskonto kademelidir: `10+5` önce %10, kalan
tutardan %5 demektir. Teklifler ürün adını ve fiyatını kopyalar; Vega'da fiyat
sonradan değişse de eski teklif değişmez. Müşteriler şimdilik daha önce teklif
verilenlerden hatırlanır; Vega cari listesinden seçim, cari tablolarının adları
öğrenilince eklenecek. Teklifler Vega'ya yazılmaz.

## El terminali

Terminalin tarayıcısında `http://SUNUCU-IP:4000/#/depo` adresini açın. Okuyucu
"Keyboard Wedge" modunda ve sonuna Enter ekleyecek şekilde ayarlı olmalıdır.
Ekran klavyesi kapalı gelir; elle yazmak için "Klavye" düğmesine basın.

## Önemli: Vega şema eşlemesi

`src/vega/sema.ts` içindeki tablo/kolon adları VegaWin'in yaygın düzenine göre
yazılmış **varsayımlardır** ve gerçek bir Vega veritabanında henüz denenmedi.
`npm run vega:kesif` gerçek tablo ve kolonları listeler, tutmayan eşlemeleri ✗ ile
gösterir; düzeltme yalnızca `sema.ts` dosyasında yapılır. Bakiye formülündeki
`girisKosulu` (giriş/çıkış ayrımı) bir ürünün stoğu Vega ekranıyla karşılaştırılarak
doğrulanmalıdır.

## API

| Uç | Açıklama |
|---|---|
| `GET /api/saglik` | ürün sayısı, son eşitleme zamanı / hatası |
| `GET /api/urunler?q=&marka=&kategori=&olcu=&limit=` | anlık arama (Türkçe duyarsız, önek eşleşmeli) |
| `GET /api/filtreler` | marka / kategori / ölçü listeleri |
| `GET /api/urunler/barkod/:barkod` | el terminali için tek ürün |
| `GET /api/urunler/:id` | ürün + açık tedarik siparişleri |
| `PUT /api/urunler/:id/kritik-esik` | kritik eşiği ayarla (`{esik}`; boş = Vega'daki değer) |
| `GET /api/kritik-stok` | Depo + Yoldaki < Kritik Eşik olan ürünler |
| `GET/POST /api/siparisler`, `PUT/DELETE /api/siparisler/:id`, `POST .../teslim` | tedarik siparişleri |
| `GET/POST /api/teklifler`, `GET/PUT/DELETE /api/teklifler/:id` | teklifler |
| `GET /api/teklifler/:id/pdf` | logolu, ürün resimli PDF |
| `GET /api/teklifler/:id/metin` | WhatsApp için sade metin özeti |
| `GET/PUT /api/ayarlar`, `PUT /api/ayarlar/logo` | firma bilgileri ve logo |
| `PUT /api/urunler/:id/gorsel` | görsel yükle (gövde: dosyanın kendisi); WebP'ye çevrilir |
| `GET /gorseller/:id/kart.webp`, `/buyuk.webp` | 480 px katalog / 1600 px detay görseli |
| `GET/POST/DELETE /api/oturum`, `PUT /api/oturum/sifre`, `POST /api/kurulum` | giriş, çıkış, şifre değiştirme, ilk yönetici |
| `GET/POST /api/kullanicilar`, `PUT /api/kullanicilar/:id` | kullanıcı yönetimi (yalnızca yönetici) |

## Yol haritası

1. ✅ Mimari, Vega bağlantısı, eşitleme, arama API'si
2. ✅ Görsel katalog + anlık arama, görsel yükleme (WebP), demo modu
3. ✅ Tedarik & termin, kritik stok panosu, el terminali (depo) sayfası, eşitleme göstergesi
4. ✅ Teklif: sepet, kademeli iskonto/KDV, PDF, WhatsApp özeti
5. Cari hesap kartı
6. ✅ Kullanıcı girişi ve roller
7. Windows hizmeti olarak kurulum, yedekleme

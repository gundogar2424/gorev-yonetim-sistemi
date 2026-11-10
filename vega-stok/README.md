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
│     (sonraki aşamalar)
│     ├─ tedarik/               açık siparişler, termin, kritik stok panosu
│     ├─ teklif/                sepet, iskonto/KDV, PDF, WhatsApp metni
│     └─ cari/                  bakiye, son alınanlar, ekstre özeti
└─ frontend/                    React + Vite + Tailwind
   └─ src/
      ├─ Katalog.tsx            anlık arama, filtreler, ürün kartları, detay + görsel yükleme
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
| `PUT /api/urunler/:id/gorsel` | görsel yükle (gövde: dosyanın kendisi); WebP'ye çevrilir |
| `GET /gorseller/:id/kart.webp`, `/buyuk.webp` | 480 px katalog / 1600 px detay görseli |

Not: Henüz kullanıcı girişi yok; ağdaki herkes görsel yükleyebilir. Giriş ve
yetkilendirme teklif modülüyle birlikte eklenecek.

## Yol haritası

1. ✅ Mimari, Vega bağlantısı, eşitleme, arama API'si
2. ✅ Görsel katalog + anlık arama, görsel yükleme (WebP), demo modu
3. Tedarik & termin, kritik stok panosu
4. Teklif: sepet, iskonto/KDV, PDF, WhatsApp özeti
5. El terminali (depo modu) ve cari hesap kartı

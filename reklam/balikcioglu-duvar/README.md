# Balıkçıoğlu – Duvar Dekorasyonu Reklam Animasyonu 🎬

41 saniyelik, dikey (1080×1920, Reels/TikTok/Shorts), sesli tanıtım animasyonu.
Hazır video: **`balikcioglu-duvar.mp4`**

## Hikâye

1. Kadın boş duvara bakıyor, hayalindeki duvarı düşünüyor.
2. Ustadan fiyat alıyor: 18.500 ₺, "biraz fazla".
3. "Ben bunu kendim de yaparım!" deyip ailece **Balıkçıoğlu**'na gidiyorlar.
4. Mağazada PVC mermer panel, akustik keçe panel ve kaya paneli seçiyorlar.
5. Evde sırayla takıyor: kaya panel → akustik keçe panel → PVC mermer panel.
6. Aile seviniyor, maliyet tablosu çıkıyor (toplam 5.550 ₺).
7. Kapanış: "Evinize yeni bir nefes – BALIKÇIOĞLU – Sizi bekliyoruz!"

## Ürünler ve fiyatlar (videodaki)

| Ürün | Ölçü | Fiyat |
|---|---|---|
| Kaya Panel | 60 × 280 cm | 2.700 ₺ |
| Akustik Keçe Panel (çıtalı) | 60 × 275 cm | 800 ₺ (nakit) |
| PVC Mermer Panel | 122 × 244 cm | 1.250 ₺ |

> "Usta teklifi 18.500 ₺" ve duvar düzeni (1 kaya + 2 akustik keçe + 1 PVC mermer = 5.550 ₺) örnek olarak konmuştur.

## Dosyalar

| Dosya | Ne işe yarar |
|---|---|
| `animasyon.html` | Bütün çizim ve hareket (SVG + JavaScript). Tarayıcıda açınca döngüde oynar, tıklayınca baştan başlar. |
| `replikler.py` | Konuşmalar: hangi saniyede, hangi sesle, hangi hızda, ne söyleniyor. |
| `ses_motoru.py` | Doğal Türkçe ses (Supertonic 3, sherpa-onnx). Sesli PDF uygulamasındaki modelin aynısı. |
| `seslendir.py` | Replikleri seslendirir, çakışma varsa uyarır. |
| `muzik_ve_miks.py` | Müziği ve efektleri kodla üretir, konuşmayla karıştırır (konuşurken müzik kısılır). |
| `kareler.js` | Animasyonu kare kare PNG'ye çizer (paralel çalışabilir). |
| `olustur.sh` | Hepsini sırayla çalıştırıp `balikcioglu-duvar.mp4`'ü üretir. |

## Yeniden üretmek

```bash
cd reklam/balikcioglu-duvar
./olustur.sh          # ilk seferde ses modelini (~140 MB) indirir
```

Gerekenler: `python3` + `numpy`, `node` + `playwright` (Chromium), `ffmpeg`.
4 çekirdekte yaklaşık 10 dakika sürer (`ISCI=8 ./olustur.sh` ile işçi sayısı artırılabilir).

## Sık yapılacak değişiklikler

- **Fiyat değişti:** `animasyon.html` içinde fiyatları ara (`2.700 ₺`, `800 ₺`, `1.250 ₺`, `5.550 ₺`); konuşmadaki toplam için `replikler.py`.
- **Altyazılar:** `animasyon.html` içindeki `CAPS` listesi.
- **Ses değiştirmek:** `replikler.py` başındaki `W, K, A` (0–4 kadın, 5–9 erkek sesi).
- **Kapanışa telefon/adres:** `animasyon.html` içinde `id="end"` bölümü.
- Zamanlama değişirse `muzik_ve_miks.py` içindeki efekt saniyelerini de kaydır.

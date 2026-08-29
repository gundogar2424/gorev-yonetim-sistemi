// ── Koordinat Çözücü - Google Apps Script ──────────────────────────
// Kurulum:
//   1. https://script.google.com → Yeni proje → bu kodu yapıştır
//   2. Kaydet (Ctrl+S)
//   3. Sağ üst → "Deploy" → "New deployment"
//   4. Tür: "Web app"
//   5. "Execute as": Me (sizin hesabınız)
//   6. "Who has access": Anyone
//   7. "Deploy" → URL'yi kopyala → CRM Ayarlar sekmesine yapıştır
// ────────────────────────────────────────────────────────────────────

function doGet(e) {
  // CORS başlıkları
  var output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  var url = (e && e.parameter && e.parameter.url) ? e.parameter.url : '';
  if (!url) {
    output.setContent(JSON.stringify({error: 'url parametresi eksik'}));
    return output;
  }

  try {
    // Google sunucusu tüm redirect'leri takip eder
    var response = UrlFetchApp.fetch(url, {
      followRedirects: true,
      muteHttpExceptions: true,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    var finalUrl = response.getUrl() || '';
    var content  = response.getContentText() || '';

    // Koordinat arama sırası
    var patterns = [
      /@(-?\d{1,3}\.\d{4,}),(-?\d{1,3}\.\d{4,})/,
      /\/(-?\d{2,3}\.\d{4,}),(-?\d{2,3}\.\d{4,})/,
      /[?&]q=(-?\d{1,3}\.\d{4,}),(-?\d{1,3}\.\d{4,})/,
      /[?&]ll=(-?\d{1,3}\.\d{4,}),(-?\d{1,3}\.\d{4,})/,
      /"(-?\d{1,3}\.\d{5,}),(-?\d{1,3}\.\d{5,})"/
    ];

    // Önce final URL'den dene
    var lat, lng, m;
    for (var p = 0; p < patterns.length; p++) {
      m = finalUrl.match(patterns[p]);
      if (m) { lat = parseFloat(m[1]); lng = parseFloat(m[2]); break; }
    }

    // Bulamazsa sayfa içeriğinden dene
    if (!lat) {
      for (var p2 = 0; p2 < patterns.length; p2++) {
        m = content.match(patterns[p2]);
        if (m) { lat = parseFloat(m[1]); lng = parseFloat(m[2]); break; }
      }
    }

    if (lat && lng && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      output.setContent(JSON.stringify({
        lat: lat,
        lng: lng,
        finalUrl: finalUrl
      }));
    } else {
      output.setContent(JSON.stringify({
        error: 'Koordinat bulunamadi',
        finalUrl: finalUrl
      }));
    }

  } catch(err) {
    output.setContent(JSON.stringify({ error: err.message }));
  }

  return output;
}

const https = require('https');
const http = require('http');

const PATTERNS = [
  /@(-?\d{1,3}\.\d{4,}),(-?\d{1,3}\.\d{4,})/,
  /\/(-?\d{2,3}\.\d{4,}),(-?\d{2,3}\.\d{4,})/,
  /[?&]q=(-?\d{1,3}\.\d{4,}),(-?\d{1,3}\.\d{4,})/,
  /[?&]ll=(-?\d{1,3}\.\d{4,}),(-?\d{1,3}\.\d{4,})/,
  /maps\/place\/[^@]+@(-?\d{1,3}\.\d{4,}),(-?\d{1,3}\.\d{4,})/
];

function gecerli(lat, lng) {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function parseCoord(url) {
  for (var i = 0; i < PATTERNS.length; i++) {
    var m = url.match(PATTERNS[i]);
    if (m) {
      var lat = parseFloat(m[1]);
      var lng = parseFloat(m[2]);
      if (gecerli(lat, lng)) return { lat: lat, lng: lng };
    }
  }
  return null;
}

function followRedirects(startUrl) {
  return new Promise(function(resolve, reject) {
    var redirectCount = 0;
    function fetch(url) {
      if (redirectCount++ > 12) return reject(new Error('Çok fazla yönlendirme'));
      var lib = url.startsWith('https') ? https : http;
      try {
        var req = lib.get(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 Chrome/96.0' },
          timeout: 8000
        }, function(res) {
          var loc = res.headers.location;
          if (res.statusCode >= 300 && res.statusCode < 400 && loc) {
            var next = loc.startsWith('http') ? loc : new URL(loc, url).href;
            res.resume();
            fetch(next);
          } else {
            res.resume();
            resolve(url);
          }
        });
        req.on('error', reject);
        req.on('timeout', function() { req.destroy(); reject(new Error('Zaman aşımı')); });
      } catch(e) { reject(e); }
    }
    fetch(startUrl);
  });
}

var CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
};

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  var url = event.queryStringParameters && event.queryStringParameters.url;
  if (!url) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'url parametresi eksik' }) };
  }

  try {
    var finalUrl = await followRedirects(url);
    var coord = parseCoord(finalUrl);
    if (coord) {
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({ lat: coord.lat, lng: coord.lng, finalUrl: finalUrl })
      };
    }
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ error: 'Koordinat bulunamadi', finalUrl: finalUrl })
    };
  } catch(err) {
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ error: err.message })
    };
  }
};

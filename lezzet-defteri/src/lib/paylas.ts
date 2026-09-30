// TARIF PAYLASMA.
//  - Tarif sayfasi: tek dosyalik, fotografli HTML (karsi tarafta uygulama
//    gerekmez, tarayicida internetsiz acilir)
//  - Thermomix pisirme modu: adim adim, sayacli, etkilesimli HTML
// Her HTML dosyasinin icine tarifin verisi (JSON) gomulur; karsi tarafta
// Lezzet Defteri varsa "Tarif ekle → Dosyadan" ile deftere tek dokunusla alinir.
import type { LzRecipe } from '../types'
import { youtubeId } from './importer'
import { adimOzeti, hizAdi, modAdi, sicaklikAdi, sureAdi, type TmSurum } from './tm7'

const GOMULU_ID = 'lezzet-defteri-tarif'

function k(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Paylasilan dosya kucuk kalsin diye fotograf 640 piksele indirilir
async function kucukFoto(src: string): Promise<string> {
  if (!src || !src.startsWith('data:image/')) return ''
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = rej
      i.src = src
    })
    const oran = Math.min(1, 640 / Math.max(img.width, img.height))
    const c = document.createElement('canvas')
    c.width = Math.round(img.width * oran)
    c.height = Math.round(img.height * oran)
    c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height)
    return c.toDataURL('image/jpeg', 0.78)
  } catch {
    return ''
  }
}

// Karsi tarafin ice aktarabilmesi icin gomulen veri (fotograf dahil)
function gomuluVeri(r: LzRecipe, foto: string): string {
  const veri = {
    app: 'lezzet-defteri-tarif',
    version: 1,
    tarif: {
      title: r.title,
      photo: foto,
      sourceUrl: r.sourceUrl,
      platform: r.platform,
      author: r.author,
      servings: r.servings,
      minutes: r.minutes,
      ingredients: r.ingredients,
      steps: r.steps,
      notes: r.notes,
      tags: r.tags,
      tm: r.tm,
      besin: r.besin
    }
  }
  // </script> kapanisini bozmasin
  return JSON.stringify(veri).replace(/</g, '\\u003c')
}

const STIL = `
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;background:#fbf7f2;color:#2b211b;line-height:1.5}
.w{max-width:640px;margin:0 auto;padding:16px}h1{font-size:26px;line-height:1.2;margin:12px 0 6px}h2{font-size:18px;margin:0 0 10px}
.kart{background:#fff;border-radius:20px;padding:16px;margin:12px 0;box-shadow:0 1px 2px rgba(0,0,0,.05),0 10px 24px -18px rgba(0,0,0,.3)}
.foto{width:100%;max-height:340px;object-fit:cover;border-radius:22px;display:block}
.vid{position:relative;display:block;text-decoration:none}.foto.bos{height:200px;background:linear-gradient(135deg,#d93d20,#7a1e0e)}
.oynat{position:absolute;left:50%;top:50%;transform:translate(-50%,-60%);width:68px;height:68px;border-radius:50%;background:rgba(0,0,0,.6);color:#fff;font-size:30px;display:flex;align-items:center;justify-content:center;padding-left:5px}
.vyazi{position:absolute;left:12px;bottom:12px;background:rgba(0,0,0,.65);color:#fff;border-radius:999px;padding:6px 12px;font-size:14px;font-weight:600}.meta{color:#9a8b80;font-size:14px}
.pill{display:inline-block;background:#fff2ee;color:#b52f17;border-radius:999px;padding:3px 10px;font-size:13px;font-weight:600;margin:2px 4px 2px 0}
ul.m{list-style:none;padding:0;margin:0}ul.m li{padding:8px 0;border-bottom:1px solid #f3ebe2;display:flex;gap:10px;align-items:flex-start}
ul.m li:last-child{border:0}ul.m input{width:20px;height:20px;accent-color:#d93d20;margin-top:2px;flex-shrink:0}ul.m label{flex:1}
input:checked+label{text-decoration:line-through;opacity:.5}ol.a{padding:0;margin:0;list-style:none;counter-reset:a}
ol.a li{counter-increment:a;display:flex;gap:12px;margin:0 0 14px}ol.a li:before{content:counter(a);flex-shrink:0;width:28px;height:28px;border-radius:50%;background:#fff2ee;color:#d93d20;font-weight:700;display:flex;align-items:center;justify-content:center;font-size:14px}
.not{white-space:pre-line}.alt{text-align:center;color:#9a8b80;font-size:12.5px;margin:24px 0 8px}a{color:#d93d20}
.btn{display:block;width:100%;border:0;border-radius:999px;padding:15px;font-size:17px;font-weight:700;background:#d93d20;color:#fff;cursor:pointer}
.btn.y{background:#f3ebe2;color:#5a4a3f}.uyari{background:#fff8e6;color:#8a5a00;border-radius:16px;padding:12px 14px;font-size:14px;margin:12px 0}
@media (prefers-color-scheme:dark){body{background:#171412;color:#f2ebe5}.kart{background:#221d1a;box-shadow:none}ul.m li{border-color:#2f2824}
.pill{background:#3a1d16;color:#ff9f88}.btn.y{background:#2a2420;color:#d9cec5}.uyari{background:#2a2113;color:#f1c56b}ol.a li:before{background:#3a1d16}}
`

const PLATFORM_ADI: Record<string, string> = { youtube: 'YouTube', instagram: 'Instagram', tiktok: 'TikTok', pinterest: 'Pinterest', facebook: 'Facebook' }

// Kaynak video varsa kapak fotografi tiklanir: YouTube / Instagram / TikTok
// uygulamasinda (ya da tarayicida) video acilir.
function videoKapak(r: LzRecipe, foto: string): string {
  const url = r.sourceUrl || ''
  const yt = youtubeId(url)
  const ad = yt ? 'YouTube' : PLATFORM_ADI[r.platform] || ''
  if (!url || !/^https?:\/\//.test(url) || !ad) return foto ? `<img class="foto" src="${foto}" alt="">` : ''
  const resim = foto || (yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : '')
  const hedef = yt ? `https://www.youtube.com/watch?v=${yt}` : url
  return `<a class="vid" href="${k(hedef)}" target="_blank" rel="noopener">${
    resim ? `<img class="foto" src="${k(resim)}" alt="">` : '<div class="foto bos"></div>'
  }<span class="oynat">▶</span><span class="vyazi">${k(ad)}’da videoyu izle</span></a>`
}

function kapak(r: LzRecipe, foto: string, altBaslik: string): string {
  const meta = [r.servings ? `${r.servings} kişilik` : '', r.minutes ? `~${r.minutes} dk` : '', r.author].filter(Boolean).join(' · ')
  return `${videoKapak(r, foto)}
<h1>${k(r.title)}</h1><div class="meta">${k(altBaslik)}${meta ? ` · ${k(meta)}` : ''}</div>
${r.tags.length ? `<div style="margin-top:8px">${r.tags.map((t) => `<span class="pill">${k(t)}</span>`).join('')}</div>` : ''}`
}

function alt(r: LzRecipe): string {
  return `<div class="alt">${r.sourceUrl ? `Kaynak: <a href="${k(r.sourceUrl)}">${k(r.sourceUrl.replace(/^https?:\/\/(www\.)?/, '').slice(0, 50))}</a><br>` : ''}
🍲 Lezzet Defteri ile paylaşıldı${'' /* uygulama sahibi ise: Tarif ekle → Dosyadan ile deftere alinir */}</div>`
}

function sayfa(baslik: string, govde: string, gomulu: string, betik = ''): string {
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${k(baslik)}</title><style>${STIL}</style></head><body><div class="w">${govde}</div>
<script type="application/json" id="${GOMULU_ID}">${gomulu}</script>${betik ? `<script>${betik}</script>` : ''}</body></html>`
}

export async function tarifHtml(r: LzRecipe): Promise<string> {
  const foto = await kucukFoto(r.photo)
  const govde = `${kapak(r, foto, 'Tarif')}
<div class="kart"><h2>Malzemeler</h2><ul class="m">${r.ingredients
    .map((m, i) => `<li><input type="checkbox" id="m${i}"><label for="m${i}">${k(m)}</label></li>`)
    .join('')}</ul></div>
<div class="kart"><h2>Yapılışı</h2><ol class="a">${r.steps.map((s) => `<li><span>${k(s)}</span></li>`).join('')}</ol></div>
${r.notes ? `<div class="kart"><h2>Notlar</h2><div class="not">${k(r.notes)}</div></div>` : ''}${alt(r)}`
  return sayfa(r.title, govde, gomuluVeri(r, foto))
}

// Thermomix pisirme modu: genel bakis + tam ekran adim adim pisirme (sayacli)
export async function tmHtml(r: LzRecipe): Promise<string> {
  const tm = r.tm as TmSurum
  const foto = await kucukFoto(r.photo)
  const adimlar = tm.steps.map((a) => ({
    text: a.text,
    kaba: a.ingredients,
    sn: a.seconds,
    kutular: [
      ['Süre', sureAdi(a.seconds)],
      ['Sıcaklık', sicaklikAdi(a.temp)],
      ['Devir', a.speed === 'yumusak' ? 'Yumuşak' : a.speed ? hizAdi(a.speed).replace('Devir ', '') : ''],
      ['Yön', a.speed ? (a.reverse ? '⟲ Ters' : '⟳ Düz') : '']
    ].filter((x) => x[1]),
    mod: a.mode ? modAdi(a.mode) : '',
    ipucu: a.tip,
    ozet: adimOzeti(a)
  }))
  const govde = `<div id="genel">${kapak(r, foto, `Thermomix TM7 · ${tm.category}`)}
${tm.warnings.map((w) => `<div class="uyari">⚠️ ${k(w)}</div>`).join('')}
<div class="kart"><h2>Malzemeler (gram)</h2><ul class="m">${tm.ingredients
    .map((m, i) => `<li><input type="checkbox" id="m${i}"><label for="m${i}">${k(m)}</label></li>`)
    .join('')}</ul></div>
<div class="kart"><h2>TM7 adımları</h2><ol class="a">${tm.steps
    .map((a) => `<li><span>${k(a.text)}${a.ingredients ? `<br><small class="meta">Kaba: ${k(a.ingredients)}</small>` : ''}${adimOzeti(a) ? `<br><span class="pill">${k(adimOzeti(a))}</span>` : ''}</span></li>`)
    .join('')}</ol></div>
<button class="btn" onclick="basla()">▶ TM7’de adım adım pişir</button>${alt(r)}</div>
<div id="pisir" style="display:none">
<div style="display:flex;align-items:center;gap:10px"><button class="btn y" style="width:auto;padding:10px 16px" onclick="kapat()">✕</button>
<div><b>${k(r.title)}</b><div class="meta" id="sayi"></div></div></div>
<div style="height:6px;background:#f3ebe2;border-radius:9px;margin:12px 0;overflow:hidden"><div id="bar" style="height:100%;background:#d93d20;width:0"></div></div>
<div id="kaba" class="kart" style="display:none"><div class="meta">KABA EKLE</div><div id="kabaY" style="font-size:20px;font-weight:700"></div></div>
<p id="metin" style="font-size:24px;font-weight:600;line-height:1.4;margin:16px 0"></p><div id="mod"></div>
<div id="kutular" style="display:grid;gap:8px;margin:12px 0"></div><p id="ipucu" class="meta" style="font-size:15px"></p>
<div id="sayac" class="kart" style="display:none;align-items:center;gap:12px"><div id="kalan" style="font-size:34px;font-weight:800;flex:1;font-variant-numeric:tabular-nums"></div>
<button class="btn" style="width:auto;padding:12px 20px" id="sbtn" onclick="sayacBas()">⏱ Sayaç</button></div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:20px"><button class="btn y" onclick="git(-1)">‹ Geri</button><button class="btn" id="ileri" onclick="git(1)">Sonraki ›</button></div></div>`
  const betik = `var A=${JSON.stringify(adimlar).replace(/</g, '\\u003c')},i=0,kalan=0,t=null,kilit=null;
function $(x){return document.getElementById(x)}
function basla(){$('genel').style.display='none';$('pisir').style.display='block';i=0;goster();try{navigator.wakeLock&&navigator.wakeLock.request('screen').then(function(l){kilit=l}).catch(function(){})}catch(e){}window.scrollTo(0,0)}
function kapat(){dur();$('pisir').style.display='none';$('genel').style.display='block';try{kilit&&kilit.release()}catch(e){}}
function yaz(s){var d=Math.floor(s/60),x=s%60;return d+':'+(x<10?'0':'')+x}
function goster(){dur();var a=A[i];$('sayi').textContent='TM7 · Adım '+(i+1)+' / '+A.length;$('bar').style.width=((i+1)/A.length*100)+'%';
$('kaba').style.display=a.kaba?'block':'none';$('kabaY').textContent=a.kaba;$('metin').textContent=a.text;
$('mod').innerHTML=a.mod?'<span class="pill">'+a.mod+'</span>':'';$('ipucu').textContent=a.ipucu?'💡 '+a.ipucu:'';
var h='';a.kutular.forEach(function(b){h+='<div class="kart" style="margin:0;padding:10px;text-align:center"><div class="meta" style="font-size:12px">'+b[0]+'</div><div style="font-size:17px;font-weight:800">'+b[1]+'</div></div>'});
$('kutular').innerHTML=h;$('kutular').style.gridTemplateColumns='repeat('+Math.max(1,Math.min(4,a.kutular.length))+',1fr)';
kalan=a.sn;$('sayac').style.display=a.sn>0?'flex':'none';$('kalan').textContent=yaz(a.sn);$('sbtn').textContent='⏱ Sayaç';
$('ileri').textContent=i==A.length-1?'Afiyet olsun! ✓':'Sonraki ›';window.scrollTo(0,0)}
function git(n){if(i+n>=A.length){kapat();return}i=Math.max(0,i+n);goster()}
function dur(){if(t){clearInterval(t);t=null}}
function sayacBas(){if(t){dur();$('sbtn').textContent='⏱ Devam';return}$('sbtn').textContent='Durdur';t=setInterval(function(){kalan--;$('kalan').textContent=yaz(Math.max(0,kalan));if(kalan<=0){dur();$('sbtn').textContent='⏱ Tekrar';kalan=A[i].sn;uyar();setTimeout(function(){$('kalan').textContent=yaz(kalan)},1500)}},1000)}
function uyar(){try{navigator.vibrate&&navigator.vibrate([300,150,300,150,300])}catch(e){}try{var c=new(window.AudioContext||window.webkitAudioContext)();for(var n=0;n<3;n++){var o=c.createOscillator(),g=c.createGain();o.frequency.value=880;o.connect(g);g.connect(c.destination);var s=c.currentTime+n*.45;g.gain.setValueAtTime(.0001,s);g.gain.exponentialRampToValueAtTime(.4,s+.02);g.gain.exponentialRampToValueAtTime(.0001,s+.35);o.start(s);o.stop(s+.36)}}catch(e){}}`
  return sayfa(`${r.title} (Thermomix)`, govde, gomuluVeri(r, foto), betik)
}

function dosyaAdi(baslik: string, ek: string): string {
  const temiz = baslik
    .toLocaleLowerCase('tr')
    .replace(/[çğıöşü]/g, (c) => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' })[c] ?? c)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return `${temiz || 'tarif'}${ek}.html`
}

// Telefonun paylasim menusu: APK'da dosya olarak (WhatsApp, e-posta, Drive…);
// tarayicida Web Share ya da indirme.
export async function dosyaPaylas(baslik: string, html: string, ek = ''): Promise<void> {
  const ad = dosyaAdi(baslik, ek)
  const { Capacitor } = await import('@capacitor/core')
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
    const { Share } = await import('@capacitor/share')
    const yaz = await Filesystem.writeFile({ path: ad, data: html, directory: Directory.Cache, encoding: Encoding.UTF8 })
    await Share.share({ title: baslik, dialogTitle: 'Tarifi paylaş', files: [yaz.uri] })
    return
  }
  const dosya = new File([html], ad, { type: 'text/html' })
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean }
  if (nav.share && nav.canShare?.({ files: [dosya] })) {
    await nav.share({ title: baslik, files: [dosya] })
    return
  }
  const url = URL.createObjectURL(dosya)
  const a = document.createElement('a')
  a.href = url
  a.download = ad
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

// Paylasilan HTML (ya da JSON) dosyasindaki tarifi okur
export function paylasilanTarifOku(icerik: string): Partial<LzRecipe> {
  let ham = icerik
  const m = icerik.match(new RegExp(`<script[^>]*id="${GOMULU_ID}"[^>]*>([\\s\\S]*?)</script>`))
  if (m) ham = m[1]
  let v: { app?: string; tarif?: Partial<LzRecipe> }
  try {
    v = JSON.parse(ham)
  } catch {
    throw new Error('Bu dosyada Lezzet Defteri tarifi bulunamadı.')
  }
  if (v.app !== 'lezzet-defteri-tarif' || !v.tarif?.title) throw new Error('Bu dosyada Lezzet Defteri tarifi bulunamadı.')
  return v.tarif
}

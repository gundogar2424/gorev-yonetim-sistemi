// TARIF PAYLASMA.
//  - Tarif sayfasi: tek dosyalik, fotografli HTML (karsi tarafta uygulama
//    gerekmez, tarayicida internetsiz acilir)
//  - Thermomix pisirme modu: adim adim, sayacli, etkilesimli HTML
// Her HTML dosyasinin icine tarifin verisi (JSON) gomulur; karsi tarafta
// Lezzet Defteri varsa "Tarif ekle → Dosyadan" ile deftere tek dokunusla alinir.
import type { LzMekan, LzRecipe } from '../types'
import { kartResmi, type KartBilgi } from './kart'
import { haritadaAcLinki, yolTarifiLinki, yorumlarLinki } from './mekan'
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
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;background:#f7f7f5;color:#18181b;line-height:1.5}
.w{max-width:640px;margin:0 auto;padding:16px}h1{font-size:26px;line-height:1.2;margin:12px 0 6px}h2{font-size:18px;margin:0 0 10px}
.kart{background:#fff;border-radius:20px;padding:16px;margin:12px 0;box-shadow:0 1px 2px rgba(0,0,0,.05),0 10px 24px -18px rgba(0,0,0,.3)}
.foto{width:100%;max-height:340px;object-fit:cover;border-radius:22px;display:block}
.vid{position:relative;display:block;text-decoration:none}.foto.bos{height:200px;background:linear-gradient(135deg,#d93d20,#7a1e0e)}
.oynat{position:absolute;left:50%;top:50%;transform:translate(-50%,-60%);width:68px;height:68px;border-radius:50%;background:rgba(0,0,0,.6);color:#fff;font-size:30px;display:flex;align-items:center;justify-content:center;padding-left:5px}
.vyazi{position:absolute;left:12px;bottom:12px;background:rgba(0,0,0,.65);color:#fff;border-radius:999px;padding:6px 12px;font-size:14px;font-weight:600}.meta{color:#86868f;font-size:14px}
.pill{display:inline-block;background:#fff2ee;color:#b52f17;border-radius:999px;padding:3px 10px;font-size:13px;font-weight:600;margin:2px 4px 2px 0}
ul.m{list-style:none;padding:0;margin:0}ul.m li{padding:8px 0;border-bottom:1px solid #f1f1ef;display:flex;gap:10px;align-items:flex-start}
ul.m li:last-child{border:0}ul.m input{width:20px;height:20px;accent-color:#d93d20;margin-top:2px;flex-shrink:0}ul.m label{flex:1}
input:checked+label{text-decoration:line-through;opacity:.5}ol.a{padding:0;margin:0;list-style:none;counter-reset:a}
ol.a li{counter-increment:a;display:flex;gap:12px;margin:0 0 14px}ol.a li:before{content:counter(a);flex-shrink:0;width:28px;height:28px;border-radius:50%;background:#fff2ee;color:#d93d20;font-weight:700;display:flex;align-items:center;justify-content:center;font-size:14px}
.not{white-space:pre-line}.alt{text-align:center;color:#86868f;font-size:12.5px;margin:24px 0 8px}a{color:#d93d20}
.btn{display:block;width:100%;border:0;border-radius:999px;padding:15px;font-size:17px;font-weight:700;background:#d93d20;color:#fff;cursor:pointer}
.btn.y{background:#f1f1ef;color:#3f3f46}.uyari{background:#fff8e6;color:#8a5a00;border-radius:16px;padding:12px 14px;font-size:14px;margin:12px 0}
@media (prefers-color-scheme:dark){body{background:#111113;color:#f4f4f5}.kart{background:#1c1c1f;box-shadow:none}ul.m li{border-color:#2e2e33}
.pill{background:#3a1d16;color:#ff9f88}.btn.y{background:#26262a;color:#d4d4d8}.uyari{background:#2a2113;color:#f1c56b}ol.a li:before{background:#3a1d16}}
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
🍲 Lezzet Rotası ile paylaşıldı${'' /* uygulama sahibi ise: Tarif ekle → Dosyadan ile deftere alinir */}</div>`
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
  if (!r.steps.length) return sayfa(r.title, govde, gomuluVeri(r, foto))
  // Uygulamadaki pisirme modu: adim adim, buyuk yazi, sureli adimda sayac
  const adimlar = r.steps.map((t) => {
    const m = t.match(/(\d+)\s*(?:-\s*\d+\s*)?(dakika|dk|saat|sa\b|saniye|sn)/i)
    const sn = m ? Number(m[1]) * (/^s(an|n)/i.test(m[2]) ? 1 : /^sa/i.test(m[2]) ? 3600 : 60) : 0
    return { t, sn }
  })
  const pisir = `<div id="genel">${govde.replace(/(<h1>)/, '$1').replace(/(<div class="kart"><h2>Malzemeler)/, '<button class="btn" style="margin:14px 0 2px" onclick="basla()">Adım adım pişir</button>$1')}</div>
<div id="pisir" style="display:none"><div style="display:flex;align-items:center;gap:10px;margin:4px 0 10px"><button class="btn y" style="width:auto;padding:10px 16px" onclick="kapat()">✕</button><div style="flex:1;min-width:0"><b style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${k(r.title)}</b><span class="meta" id="sayi"></span></div></div>
<div style="height:6px;background:#f1f1ef;border-radius:9px;overflow:hidden"><div id="bar" style="height:100%;background:#d93d20;width:0"></div></div>
<p id="adim" style="font-size:24px;line-height:1.45;font-weight:500;margin:22px 0"></p>
<div id="sure" class="kart" style="display:none;align-items:center;gap:14px"><b id="kalan" style="font-size:34px;flex:1"></b><button class="btn" style="width:auto;padding:12px 18px" id="sbtn" onclick="sayacBas()">Sayacı başlat</button></div>
<div class="kart"><h2 style="font-size:14px;color:#86868f">Malzemeler</h2><ul class="m">${r.ingredients.map((m) => `<li><label>${k(m)}</label></li>`).join('')}</ul></div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:18px 0 30px"><button class="btn y" onclick="git(-1)">‹ Geri</button><button class="btn" id="ileri" onclick="git(1)">Sonraki ›</button></div></div>`
  const betik = `var A=${JSON.stringify(adimlar).replace(/</g, '\\u003c')},i=0,t=null,kalan=0,kilit=null;
function $(x){return document.getElementById(x)}
function basla(){$('genel').style.display='none';$('pisir').style.display='block';i=0;goster();try{navigator.wakeLock&&navigator.wakeLock.request('screen').then(function(l){kilit=l}).catch(function(){})}catch(e){}window.scrollTo(0,0)}
function kapat(){dur();$('pisir').style.display='none';$('genel').style.display='block';try{kilit&&kilit.release()}catch(e){}}
function yaz(s){var h=Math.floor(s/3600),d=Math.floor(s%3600/60),x=s%60;return(h?h+':'+(d<10?'0':''):'')+d+':'+(x<10?'0':'')+x}
function goster(){dur();var a=A[i];$('sayi').textContent='Adım '+(i+1)+' / '+A.length;$('bar').style.width=((i+1)/A.length*100)+'%';$('adim').textContent=a.t;kalan=a.sn;$('sure').style.display=a.sn?'flex':'none';$('kalan').textContent=yaz(kalan);$('sbtn').textContent='Sayacı başlat';$('ileri').textContent=i==A.length-1?'Afiyet olsun ✓':'Sonraki ›';window.scrollTo(0,0)}
function git(n){if(i+n>=A.length){kapat();return}i=Math.max(0,i+n);goster()}
function dur(){if(t){clearInterval(t);t=null}}
function sayacBas(){if(t){dur();$('sbtn').textContent='Devam';return}$('sbtn').textContent='Durdur';t=setInterval(function(){kalan--;$('kalan').textContent=yaz(Math.max(0,kalan));if(kalan<=0){dur();$('sbtn').textContent='Tekrar';kalan=A[i].sn;uyar();setTimeout(function(){$('kalan').textContent=yaz(kalan)},1500)}},1000)}
function uyar(){try{navigator.vibrate&&navigator.vibrate([300,150,300,150,300])}catch(e){}try{var c=new(window.AudioContext||window.webkitAudioContext)();for(var n=0;n<3;n++){var o=c.createOscillator(),g=c.createGain();o.frequency.value=880;o.connect(g);g.connect(c.destination);var s=c.currentTime+n*.45;g.gain.setValueAtTime(.0001,s);g.gain.exponentialRampToValueAtTime(.4,s+.02);g.gain.exponentialRampToValueAtTime(.0001,s+.35);o.start(s);o.stop(s+.36)}}catch(e){}}`
  return sayfa(r.title, pisir, gomuluVeri(r, foto), betik)
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
<div style="height:6px;background:#f1f1ef;border-radius:9px;margin:12px 0;overflow:hidden"><div id="bar" style="height:100%;background:#d93d20;width:0"></div></div>
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
export async function dosyaPaylas(baslik: string, html: string, ek = '', pencere = 'Tarifi paylaş'): Promise<void> {
  const ad = dosyaAdi(baslik, ek)
  const { Capacitor } = await import('@capacitor/core')
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
    const { Share } = await import('@capacitor/share')
    const yaz = await Filesystem.writeFile({ path: ad, data: html, directory: Directory.Cache, encoding: Encoding.UTF8 })
    await Share.share({ title: baslik, dialogTitle: pencere, files: [yaz.uri] })
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
    throw new Error('Bu dosyada Lezzet Rotası tarifi bulunamadı.')
  }
  if (v.app !== 'lezzet-defteri-tarif' || !v.tarif?.title) throw new Error('Bu dosyada Lezzet Rotası tarifi bulunamadı.')
  return v.tarif
}

// MEKAN SAYFASI: tek dosyalik, fotografli HTML; karsi tarafta uygulama gerekmez.
// Harita / yol tarifi / Google yorumlari / video linkleri tiklanir.
export async function mekanHtml(m: LzMekan): Promise<string> {
  const foto = await kucukFoto(m.foto)
  const z = [...(m.ziyaretler ?? [])].sort((a, b) => b.tarih.localeCompare(a.tarih))
  const puanlar = z.filter((x) => x.puan > 0)
  const benim = puanlar.length ? puanlar.reduce((t, x) => t + x.puan, 0) / puanlar.length : 0
  const yedim = z.map((x) => x.yedim).filter(Boolean)
  const tekrar = z.map((x) => x.tekrar).filter(Boolean)[0]
  const notum = z.map((x) => x.not).filter(Boolean)[0]
  const yt = youtubeId(m.sourceUrl || '')
  const pAd = yt ? 'YouTube' : PLATFORM_ADI[m.platform] || ''
  const resim = foto || (yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : '')
  const gorsel =
    m.sourceUrl && /^https?:\/\//.test(m.sourceUrl) && pAd
      ? `<a class="vid" href="${k(m.sourceUrl)}" target="_blank" rel="noopener">${resim ? `<img class="foto" src="${k(resim)}" alt="">` : '<div class="foto bos"></div>'}<span class="oynat">▶</span><span class="vyazi">${k(pAd)}’da videoyu izle</span></a>`
      : resim
        ? `<img class="foto" src="${k(resim)}" alt="">`
        : ''
  const py = m.paylasanYorumu
  const satir = (b: string, d: string) => (d ? `<li><label><b>${k(b)}:</b> ${k(d)}</label></li>` : '')
  const govde = `${gorsel}
<h1>${k(m.ad)}</h1><div class="meta">${k([m.tur, m.ilce, m.sehir].filter(Boolean).join(' · '))}${m.fiyat ? ` · ${k(m.fiyat)}` : ''}</div>
<div style="margin-top:8px">${m.puan ? `<span class="pill">Google ★ ${m.puan.toFixed(1).replace('.', ',')}${m.yorumSayisi ? ` (${m.yorumSayisi.toLocaleString('tr')})` : ''}</span>` : ''}${benim ? `<span class="pill">Benim puanım ${benim.toFixed(1).replace('.', ',')} / 5</span>` : ''}</div>
<div class="kart" style="display:grid;gap:8px"><a class="btn" href="${k(yolTarifiLinki(m))}" target="_blank" rel="noopener" style="text-align:center;text-decoration:none">Yol tarifi</a>
<a class="btn y" href="${k(haritadaAcLinki(m))}" target="_blank" rel="noopener" style="text-align:center;text-decoration:none">Haritada aç</a>
<a class="btn y" href="${k(yorumlarLinki(m))}" target="_blank" rel="noopener" style="text-align:center;text-decoration:none">Google yorumları</a>
${m.instagram ? `<a class="btn y" href="https://www.instagram.com/${k(m.instagram)}/" target="_blank" rel="noopener" style="text-align:center;text-decoration:none">Instagram</a>` : ''}</div>
${yedim.length || tekrar || notum ? `<div class="kart"><h2>Ben gittim</h2><ul class="m">${satir('Ne yedim', yedim.slice(0, 3).join(', '))}${satir('Bir dahakine', tekrar ?? '')}${satir('Notum', notum ?? '')}</ul></div>` : ''}
${m.oneriler.length ? `<div class="kart"><h2>Ne yenir</h2><ul class="m">${m.oneriler.slice(0, 8).map((o) => `<li><label>${k(o)}</label></li>`).join('')}</ul></div>` : ''}
${m.paylasan && py && (py.begendi || py.karar || py.yedi) ? `<div class="kart"><h2>${k(m.paylasan)} ne dedi</h2><ul class="m">${satir('Yedi', py.yedi)}${satir('Beğendi', py.begendi)}${satir('Beğenmedi', py.begenmedi)}${satir('Kararı', py.karar)}</ul></div>` : ''}
${m.adres ? `<div class="kart"><h2>Adres</h2><div class="not">${k(m.adres)}</div></div>` : ''}
<div class="alt">Lezzet Rotası ile paylaşıldı</div>`
  return sayfa(m.ad, govde, '{}')
}

// MEKAN PAYLASIMI: arkadasa duz yazi (WhatsApp vb.); uygulama gerekmez.
// Ad, tur/semt, Google puani, benim puanim ve ne yedigim, paylasanin videosu, harita linki.
export function mekanMetni(m: LzMekan): string {
  const z = [...(m.ziyaretler ?? [])].sort((a, b) => b.tarih.localeCompare(a.tarih))
  const puanlar = z.filter((x) => x.puan > 0)
  const benim = puanlar.length ? puanlar.reduce((t, x) => t + x.puan, 0) / puanlar.length : 0
  const yedim = z.map((x) => x.yedim).filter(Boolean)[0]
  const tekrar = z.map((x) => x.tekrar).filter(Boolean)[0]
  const metin = [
    m.ad,
    [m.tur, m.ilce, m.sehir].filter(Boolean).join(' · '),
    m.puan ? `Google: ★ ${m.puan.toFixed(1).replace('.', ',')}${m.yorumSayisi ? ` (${m.yorumSayisi.toLocaleString('tr')} yorum)` : ''}` : '',
    benim ? `Benim puanım: ${benim.toFixed(1).replace('.', ',')} / 5` : '',
    yedim ? `Ne yedim: ${yedim}` : '',
    tekrar ? `Bir dahakine: ${tekrar}` : '',
    !yedim && m.oneriler.length ? `Önerilenler: ${m.oneriler.slice(0, 4).join(', ')}` : '',
    m.paylasan ? `${m.paylasan} önermişti${m.sourceUrl ? `: ${m.sourceUrl}` : ''}` : m.sourceUrl ? `Video: ${m.sourceUrl}` : '',
    `Harita: ${haritadaAcLinki(m)}`
  ]
    .filter(Boolean)
    .join('\n')
  return metin
}

// Kartin altindaki kisa yazi: bilgiler zaten kartta; yalnizca dokunulacak kisa linkler
function kisaHarita(m: LzMekan): string {
  if (m.googleId) return `https://www.google.com/maps/place/?q=place_id:${m.googleId}`
  if (m.lat !== undefined && m.lon !== undefined) return `https://maps.google.com/?q=${m.lat.toFixed(6)},${m.lon.toFixed(6)}`
  return `https://maps.google.com/?q=${encodeURIComponent([m.ad, m.sehir].filter(Boolean).join(' '))}`
}
export function mekanKartMetni(m: LzMekan): string {
  const video = m.sourceUrl ? m.sourceUrl.replace(/[?#].*$/, '') : ''
  return [`${m.ad} — Haritada aç: ${kisaHarita(m)}`, video ? `${m.paylasan ? `${m.paylasan} videosu` : 'Video'}: ${video}` : ''].filter(Boolean).join('\n')
}

// KART PAYLASIMI: fotograf gibi kart + altinda yazi (WhatsApp'ta resim aciklamasi olur; linkler tiklanir).
// Tek resim + yazi tek seferde gider; sayfa dosyasi ayri gonderilir (WhatsApp ikisini birlikte almiyor).
export async function kartPaylas(kart: KartBilgi, metin: string, pencere: string): Promise<'paylasildi' | 'kopyalandi'> {
  const resim = await kartResmi(kart)
  const ad = `${dosyaAdi(kart.baslik, '').replace(/\.html$/, '')}.jpg`
  const { Capacitor } = await import('@capacitor/core')
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem')
    const { Share } = await import('@capacitor/share')
    const yaz = await Filesystem.writeFile({ path: ad, data: resim.split(',')[1], directory: Directory.Cache })
    await Share.share({ title: kart.baslik, text: metin, dialogTitle: pencere, files: [yaz.uri] })
    return 'paylasildi'
  }
  const dosya = new File([await (await fetch(resim)).blob()], ad, { type: 'image/jpeg' })
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean }
  if (nav.share && nav.canShare?.({ files: [dosya] })) {
    await nav.share({ title: kart.baslik, text: metin, files: [dosya] })
    return 'paylasildi'
  }
  await navigator.clipboard?.writeText(metin).catch(() => {})
  const a = document.createElement('a')
  a.href = resim
  a.download = ad
  a.click()
  return 'kopyalandi'
}

// Tarif kartinin altindaki yazi: kisa ozet + kaynak video
export function tarifMetni(r: LzRecipe): string {
  return [
    r.title,
    [r.servings ? `${r.servings} kişilik` : '', r.minutes ? `~${r.minutes} dk` : ''].filter(Boolean).join(' · '),
    r.ingredients.length ? `Malzemeler:\n${r.ingredients.map((m) => `• ${m}`).join('\n')}` : '',
    r.sourceUrl ? `Video: ${r.sourceUrl}` : '',
    'Adım adım tarif ve pişirme modu bir sonraki dosyada.'
  ]
    .filter(Boolean)
    .join('\n')
}

// Paylasim kartlari
export function tarifKarti(r: LzRecipe): KartBilgi {
  return {
    tur: 'Tarif',
    baslik: r.title,
    alt: [r.servings ? `${r.servings} kişilik` : '', r.minutes ? `~${r.minutes} dk` : '', r.author].filter(Boolean).join(' · '),
    satirlar: [r.ingredients.length ? `${r.ingredients.length} malzeme: ${r.ingredients.map((m) => m.replace(/^[^:]{2,30}:\s*/, '').replace(/^([\d.,/½¼¾\s-]+|(yarım|çeyrek|bir)\s+)/i, '').replace(/^(su bardağı|çay bardağı|yemek kaşığı|tatlı kaşığı|çay kaşığı|gr|g|kg|ml|adet|paket)\s+/i, '')).slice(0, 6).join(', ')}` : ''],
    not: 'Malzemeler mesajda · Adım adım tarif ayrı dosyada',
    foto: r.photo
  }
}
export function mekanKarti(m: LzMekan): KartBilgi {
  const z = (m.ziyaretler ?? []).filter((x) => x.puan > 0)
  const benim = z.length ? z.reduce((t, x) => t + x.puan, 0) / z.length : 0
  const yedim = (m.ziyaretler ?? []).map((x) => x.yedim).filter(Boolean)[0]
  return {
    tur: 'Mekan',
    baslik: m.ad,
    alt: [m.tur, m.ilce, m.sehir].filter(Boolean).join(' · '),
    satirlar: [
      [m.puan ? `Google ★ ${m.puan.toFixed(1).replace('.', ',')}${m.yorumSayisi ? ` (${m.yorumSayisi.toLocaleString('tr')})` : ''}` : '', benim ? `Benim puanım ${benim.toFixed(1).replace('.', ',')}/5` : ''].filter(Boolean).join('   ·   '),
      yedim ? `Ne yedim: ${yedim}` : m.oneriler.length ? `Önerilen: ${m.oneriler.slice(0, 3).join(', ')}` : '',
      m.paylasan ? `${m.paylasan} önermişti` : ''
    ],
    not: 'Harita ve yol tarifi linki mesajda',
    foto: m.foto
  }
}

// Duz yazi paylasimi (WhatsApp vb.); tarayicida yoksa panoya kopyalanir
export async function yaziPaylas(baslik: string, metin: string, pencere: string): Promise<'paylasildi' | 'kopyalandi'> {
  const { Capacitor } = await import('@capacitor/core')
  if (Capacitor.isNativePlatform()) {
    const { Share } = await import('@capacitor/share')
    await Share.share({ title: baslik, text: metin, dialogTitle: pencere })
    return 'paylasildi'
  }
  if (navigator.share) {
    await navigator.share({ title: baslik, text: metin })
    return 'paylasildi'
  }
  await navigator.clipboard.writeText(metin)
  return 'kopyalandi'
}

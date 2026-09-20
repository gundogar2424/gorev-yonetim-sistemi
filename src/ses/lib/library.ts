// "İZLE" SEKMESI VE EGZERSIZ EKRANINDAKI YOUTUBE SEKMESI.
// Buradaki videolar harici kaynaktir ve internet gerektirir; uygulamanin
// kendi klipleri ayridir (public/ses-video).
// Baglantilar web aramasiyla bulunmustur; icerikleri izlenerek dogrulanmamistir,
// bu yuzden ekranda "dis kaynak" uyarisi ve her egzersizde bir YouTube ARAMA
// baglantisi gosterilir (bir video kaldirilsa bile arama calismaya devam eder).
// Oncelik Turkce videolardadir; teknigin Turkce anlatimi yoksa Ingilizce
// kaynak eklenir ve satirda "İngilizce" etiketiyle gosterilir.

export interface LibVideo {
  url: string
  title: string
  by?: string // kanal / kisi
  lang?: 'tr' | 'en' | 'fr'
  short?: boolean // kisa video (birkac dakika)
  shorts?: boolean // YouTube Shorts (dikey, ~1 dk)
}

export interface LibTopic {
  id: string
  title: string
  emoji: string
  note: string
  videos: LibVideo[]
}

export const LIBRARY: LibTopic[] = [
  {
    id: 'ses-teli',
    title: 'Ses teli sorunları',
    emoji: '🩺',
    note: 'Hekim anlatımları: ses kısıklığı, nodül, ses teli felci.',
    videos: [
      { url: 'https://www.youtube.com/shorts/_tRlnhOGWsQ', title: 'Ses teli nodülü nedir?', by: 'Op. Dr. Mustafa Uslu', lang: 'tr', short: true, shorts: true },
      { url: 'https://www.youtube.com/watch?v=OS8FiUe3Ak8', title: 'Sesiniz mi kısıldı? Evde 3 altın kural', by: 'Doç. Dr. Necati Enver', lang: 'tr', short: true },
      { url: 'https://www.youtube.com/watch?v=_alGOXXGipY', title: 'Ses kısıklığı ve ses teli problemleri', by: 'Doç. Dr. Necati Enver', lang: 'tr' },
      { url: 'https://www.youtube.com/watch?v=7qmEwxzpT8E', title: 'Ses teli felci', by: 'Doç. Dr. Necati Enver', lang: 'tr' },
      { url: 'https://www.youtube.com/watch?v=Wmluhkuzut0', title: 'Ses teli felci nedir?', by: 'Doç. Dr. İsmail Koçak', lang: 'tr' },
      { url: 'https://www.youtube.com/watch?v=91y2br0dRPM', title: 'Ses teli felci nasıl tedavi edilir?', lang: 'tr' },
      { url: 'https://www.youtube.com/watch?v=uan2_yyY5cU', title: 'Tek taraflı ses teli felci', lang: 'tr' },
      { url: 'https://www.youtube.com/watch?v=34F-JKZQKb0', title: 'Ses teli felci tedavisi', lang: 'tr' },
      { url: 'https://www.youtube.com/watch?v=jYg8wNQZ3sU', title: 'İki taraflı ses teli felci', lang: 'tr' },
      { url: 'https://www.youtube.com/watch?v=s6mZY0jSoLQ', title: 'Ses kısıklığı tedavisi', by: 'Prof. Dr. Arzu Tatlıpınar', lang: 'tr' },
      { url: 'https://www.youtube.com/watch?v=LpR7JF6qIaU', title: 'Ses kısıklığı ve tedavisi', by: 'Op. Dr. Hasan Zorlu', lang: 'tr' },
      { url: 'https://www.youtube.com/watch?v=VjQCjgkA1Ow', title: 'Ses teli nodülü iyileştirme dersi', lang: 'tr' },
      { url: 'https://www.youtube.com/shorts/c_VMwUh4CEM', title: 'Ses teli kanaması nedir?', lang: 'tr', short: true, shorts: true },
      { url: 'https://www.youtube.com/watch?v=nZCe1F83E28', title: 'Ses sorunu çözüldü', lang: 'tr', short: true, shorts: true },
      { url: 'https://www.youtube.com/watch?v=XDDL1ha9gOs', title: 'Ses teli felcinde hangi egzersizler yardımcı olur?', lang: 'en' }
    ]
  },
  {
    id: 'ses-terapisi',
    title: 'Ses terapisi egzersizleri',
    emoji: '🎤',
    note: 'Türkçe ses terapisi anlatımları, tüp (Lax Vox) ve pipet egzersizleri.',
    videos: [
      { url: 'https://www.youtube.com/watch?v=Pmjsn2nsxZA', title: 'Ses terapisi ve ses kısıklığı', by: 'Ses terapisti Mehmet Uyar', lang: 'tr' },
      { url: 'https://www.youtube.com/watch?v=GVUoaxJRAE0', title: 'Ses kısıklığı: dil ve konuşma terapisti anlatıyor', lang: 'tr' },
      { url: 'https://m.youtube.com/watch?v=1SePvXrpxQE', title: 'Ses tellerini güçlendiren egzersiz', by: 'Terapist Maral Yeşilyurt', lang: 'tr', short: true },
      { url: 'https://www.youtube.com/watch?v=I2kgqCa0kuE', title: 'DoctorVox ses terapisi egzersizi', lang: 'tr', short: true },
      { url: 'https://www.youtube.com/playlist?list=PLvsYVnIbuA5NCgsUOx_0FHsMTCpo9SlCl', title: 'DoctorVox / Lax Vox tekniği (tüm seri)', lang: 'tr' },
      { url: 'https://www.youtube.com/watch?v=ZuBRs2Nm0YU', title: 'Glissando egzersizi (perde kaydırma)', lang: 'tr', short: true },
      { url: 'https://www.youtube.com/watch?v=rkWlwlKHhpM', title: 'Portamento egzersizi', lang: 'tr', short: true },
      { url: 'https://www.youtube.com/watch?v=t7Mm4HgyKlo', title: 'Staccato egzersizi', lang: 'tr', short: true },
      { url: 'https://www.youtube.com/watch?v=HIVBmLdQg9c', title: 'Portato egzersizi', lang: 'tr', short: true },
      { url: 'https://www.youtube.com/watch?v=UbuapADtz9c', title: 'Pipete fonasyon egzersizi', lang: 'tr', short: true },
      { url: 'https://m.youtube.com/watch?v=gnQmf6_XfPw', title: 'Pipetle basit ve etkili ses geliştirme egzersizi', lang: 'tr', short: true },
      { url: 'https://www.youtube.com/watch?v=RLUJ2ijHBNY', title: 'Ses çalışmaları: "m" sesi', lang: 'tr', short: true },
      { url: 'https://www.youtube.com/shorts/v3Zq8T8C1Ys', title: 'Günün ses egzersizi: "mam-mam-mam" ısınması', lang: 'tr', short: true, shorts: true },
      { url: 'https://www.youtube.com/watch?v=gBEL1mj2OFI', title: 'Kısa ses egzersizi (vokal koç)', lang: 'tr', short: true, shorts: true },
      { url: 'https://www.youtube.com/watch?v=K79OlbRLebc', title: 'Fonasyon nedir? Doğru ses üretiminin temelleri', lang: 'tr' },
      { url: 'https://www.youtube.com/watch?v=lpYLY3olxcQ', title: 'Sesimi nasıl geliştirebilirim? Ses aralığını artırmak', by: 'Doç. Dr. Necati Enver', lang: 'tr' },
      { url: 'https://www.youtube.com/watch?v=Ob-UY9ZoGVo', title: 'Ses terapisi: nasıl yapıyorum?', lang: 'tr' },
      { url: 'https://m.youtube.com/watch?v=VBvJGb7fplY', title: 'Ses terapisi çalışması (basit ve etkili)', lang: 'tr', short: true }
    ]
  },
  {
    id: 'gur-ses',
    title: 'Gür ve tok ses',
    emoji: '📢',
    note: 'Sesin gür çıkması, konuşurken ses gücü ve ses rengi çalışmaları.',
    videos: [
      { url: 'https://m.youtube.com/watch?v=smHRwppSFQA', title: 'Daha tok bir ses için bu egzersizleri yapın', lang: 'tr', short: true },
      { url: 'https://www.youtube.com/watch?v=3cOsXwmKeSY', title: 'Sesiniz güzel ve güçlü çıksın', lang: 'tr', short: true },
      { url: 'https://www.youtube.com/watch?v=fhCJNZ22e88', title: 'Sesimi nasıl etkili kullanabilirim? (evde diksiyon)', lang: 'tr', short: true },
      { url: 'https://www.youtube.com/watch?v=O0WBy1Pq66A', title: 'Konuşurken sesim kötü çıkıyor: sesi bozan unsurlar', lang: 'tr', short: true },
      { url: 'https://www.youtube.com/watch?v=UXaLEGLjJiA', title: 'Ses rengi nasıl güzelleşir? Uygulamalı egzersiz', lang: 'tr', short: true },
      { url: 'https://www.youtube.com/watch?v=zNUGeFDSWlc', title: 'PhoRTE gür ses egzersizleri — 1. bölüm', lang: 'en', short: true },
      { url: 'https://www.youtube.com/watch?v=8aaHWfv32zc', title: 'PhoRTE — 3. bölüm', lang: 'en', short: true }
    ]
  },
  {
    id: 'vfe',
    title: 'Vokal Fonksiyon Egzersizleri',
    emoji: '🎼',
    note: 'Uygulamadaki VFE 1-4 ve tekniklerin kaynağından anlatımı (çoğu İngilizce).',
    videos: [
      { url: 'https://www.youtube.com/watch?v=uM2TLN7nQW0', title: 'Vocal Function Exercises — Joseph Stemple (yöntemin sahibi)', lang: 'en' },
      { url: 'https://www.youtube.com/watch?v=IeuY84lq3Iw', title: 'Vocal Function Exercises (ses terapisi)', lang: 'en', short: true },
      { url: 'https://www.youtube.com/watch?v=1rzZupWzYes', title: 'Vocal Function Exercises', lang: 'en', short: true },
      { url: 'https://www.youtube.com/watch?v=d6lJdSbd-h8', title: 'Stemple VFE: kanıta dayalı ses terapisi', lang: 'en' },
      { url: 'https://www.youtube.com/watch?v=MHa_JkztRGQ', title: 'Sert glottal başlangıç', lang: 'en', short: true },
      { url: 'https://www.youtube.com/watch?v=9GLjqQlZRkk', title: 'Yarım yutkunma "bum" tekniği', lang: 'en', short: true },
      { url: 'https://www.youtube.com/watch?v=YI1F7fw75b0', title: 'Uzun "a" tutma (fonasyon direnci)', lang: 'en', short: true },
      { url: 'https://www.youtube.com/watch?v=PsjUJjrSE7A', title: 'Suda tüp / yarı kapalı ses yolu egzersizleri', lang: 'en', short: true },
      { url: 'https://www.youtube.com/watch?v=WvtgFbCgY8E', title: 'Kabarcıklı fonasyon (Mayo Clinic)', lang: 'en', short: true },
      { url: 'https://www.youtube.com/watch?v=2UKE6tuCpPk', title: 'Tek taraflı ses teli felcinde ses egzersizleri — Dr. Le Huche', lang: 'fr' }
    ]
  },
  {
    id: 'nefes',
    title: 'Nefes ve ısınma',
    emoji: '🫁',
    note: 'Diyafram nefesi ve kısa ses ısınmaları (hepsi Türkçe).',
    videos: [
      { url: 'https://www.youtube.com/watch?v=74_QDyUcV6I', title: 'Diyafram nefesi egzersizi', lang: 'tr', short: true },
      { url: 'https://www.youtube.com/watch?v=6rCbIT_rx0c', title: 'Doğru nefes nasıl alınır? Diyafram nefesi nasıl gelişir?', lang: 'tr' },
      { url: 'https://www.youtube.com/watch?v=4B1vrHCIVg4', title: 'Karın nefesi / diyafram nefesi', lang: 'tr', short: true },
      { url: 'https://www.youtube.com/shorts/Zy1WYm-aJ58', title: 'Diyafram solunumu (fizyoterapist)', lang: 'tr', short: true, shorts: true },
      { url: 'https://m.youtube.com/watch?v=BdmFgKn4jjg', title: 'Triflo ile solunum egzersizi', lang: 'tr', short: true },
      { url: 'https://www.youtube.com/watch?v=xj57IDmkxME', title: 'Hızlı ısınma: 3 farklı egzersiz', lang: 'tr', short: true },
      { url: 'https://m.youtube.com/watch?v=9XJeQQVdJKg', title: '5 dakikalık ses açma egzersizi', lang: 'tr', short: true },
      { url: 'https://www.youtube.com/watch?v=ZCS2FRLym1g', title: 'Ses açma / vokal ısıtma teknikleri', lang: 'tr', short: true },
      { url: 'https://www.youtube.com/watch?v=ue2EgqA3YcY', title: 'Dudak trili nedir, nasıl yapılır?', lang: 'tr', short: true },
      { url: 'https://www.youtube.com/watch?v=vpgM3iMvFOs', title: 'Dudak trili — ses açma egzersizi', lang: 'tr', short: true },
      { url: 'https://www.youtube.com/watch?v=TRIKSmAN5nU', title: 'Dudak trili ve "i" vokali egzersizi', lang: 'tr', short: true },
      { url: 'https://www.youtube.com/watch?v=oVAOV0PtUPk', title: 'Rezonans çalışması "ye-ye-ye"', lang: 'tr', short: true },
      { url: 'https://www.youtube.com/watch?v=cm8bjGBkvQ8', title: 'Artikülasyon ve rezonans çalışması', lang: 'tr', short: true },
      { url: 'https://www.youtube.com/watch?v=QIXa_g9F9Ug', title: 'Vibrasyon egzersizi ("e" vokali)', lang: 'tr', short: true },
      { url: 'https://www.youtube.com/shorts/cA-7uQ0Sl7Q', title: 'Siren (perde kaydırma) ısınması', lang: 'en', short: true, shorts: true },
      { url: 'https://www.youtube.com/watch?v=INuSII9hlMI', title: 'Şarkı söylemek için ses egzersizi', lang: 'tr', short: true },
      { url: 'https://www.youtube.com/playlist?list=PLEdk0VnOqVyOtrBP4tACcreGiQN7-4zCK', title: 'Ses açma egzersizleri (oynatma listesi)', lang: 'tr' }
    ]
  },
  {
    id: 'diksiyon',
    title: 'Diksiyon',
    emoji: '🗣️',
    note: 'Artikülasyon, kalem çalışması, tekerlemeler, vurgu ve tonlama.',
    videos: [
      { url: 'https://www.youtube.com/watch?v=Ie-zR98Nxf4', title: 'Daha net konuşmanızı sağlayan kolay egzersiz', lang: 'tr', short: true },
      { url: 'https://www.youtube.com/shorts/-Bl5XEoVRUQ', title: '"Ş" harfi tekerlemeleri', lang: 'tr', short: true, shorts: true },
      { url: 'https://www.youtube.com/shorts/LTJ52cHL5nA', title: 'Tek tekerlemeyle nefes ve artikülasyon testi', lang: 'tr', short: true, shorts: true },
      { url: 'https://m.youtube.com/watch?v=o7_TPc1vHKE', title: 'Kalem çalışması ve faydaları', lang: 'tr', short: true },
      { url: 'https://www.youtube.com/watch?v=xyexxnhrfcg', title: 'Diksiyon kalem çalışması', lang: 'tr', short: true },
      { url: 'https://www.youtube.com/watch?v=40pRwpAgaFM', title: 'Tekerlemeler 3 — diksiyon egzersizleri', lang: 'tr', short: true },
      { url: 'https://www.youtube.com/watch?v=_ls4ppKNICg', title: 'Diksiyon alıştırmaları: tekerlemelerin tamamı (+PDF)', lang: 'tr' },
      { url: 'https://www.youtube.com/watch?v=93QeQPkriCI', title: 'Diksiyon nasıl düzeltilir? Tekerlemeler, egzersizler', lang: 'tr' },
      { url: 'https://www.youtube.com/watch?v=jetXqKPCUM0', title: 'Diksiyon düzeltme egzersizleri', lang: 'tr' },
      { url: 'https://www.youtube.com/live/ZWrrC4YXX2Y', title: 'Artikülasyon: dil ve dudak egzersizleri', lang: 'tr' },
      { url: 'https://www.youtube.com/playlist?list=PLMQlm6cpeS1Aedba_G6GF0tceV7L_R5xP', title: 'Bedava diksiyon eğitimi (oynatma listesi)', lang: 'tr' }
    ]
  }
]

export function libCount(): number {
  return LIBRARY.reduce((n, t) => n + t.videos.length, 0)
}

// ---------------------------------------------------------------------------
// EGZERSIZE GORE: her ses egzersizi icin yukaridaki listeden secilmis videolar.
// "urls" LIBRARY icindeki baglantilara isaret eder (tek yerden yonetilsin diye
// kopyalanmaz) ve TURKCE olanlar basa yazilir. "search" TURKCE bir YouTube
// arama sorgusudur: tek tek videolar kaldirilsa/gizlense bile arama her zaman
// guncel sonuc getirir.
export interface ExVideos {
  id: string // content.ts'teki egzersiz id'si
  urls: string[]
  search: string
}

export const EX_VIDEOS: ExVideos[] = [
  {
    id: 'karin-nefesi',
    search: 'diyafram nefesi egzersizi',
    urls: ['https://www.youtube.com/watch?v=74_QDyUcV6I', 'https://www.youtube.com/watch?v=6rCbIT_rx0c', 'https://www.youtube.com/watch?v=4B1vrHCIVg4', 'https://www.youtube.com/shorts/Zy1WYm-aJ58']
  },
  {
    id: 'dudak-tril',
    search: 'dudak trili ses egzersizi',
    urls: ['https://www.youtube.com/watch?v=ue2EgqA3YcY', 'https://www.youtube.com/watch?v=TRIKSmAN5nU', 'https://www.youtube.com/watch?v=vpgM3iMvFOs']
  },
  {
    id: 'mirildanma',
    search: 'mırıldanma m sesi ses egzersizi',
    urls: ['https://www.youtube.com/shorts/v3Zq8T8C1Ys', 'https://www.youtube.com/watch?v=RLUJ2ijHBNY', 'https://www.youtube.com/watch?v=oVAOV0PtUPk', 'https://m.youtube.com/watch?v=1SePvXrpxQE']
  },
  {
    id: 'itme',
    search: 'ses tellerini güçlendiren itme egzersizi',
    urls: ['https://m.youtube.com/watch?v=1SePvXrpxQE', 'https://www.youtube.com/watch?v=nZCe1F83E28', 'https://www.youtube.com/watch?v=Pmjsn2nsxZA', 'https://www.youtube.com/watch?v=7qmEwxzpT8E', 'https://www.youtube.com/watch?v=XDDL1ha9gOs']
  },
  {
    id: 'cekme',
    search: 'ses teli kapanması güçlendirme egzersizi',
    urls: ['https://m.youtube.com/watch?v=1SePvXrpxQE', 'https://www.youtube.com/watch?v=Pmjsn2nsxZA', 'https://www.youtube.com/watch?v=XDDL1ha9gOs']
  },
  {
    id: 'sert-baslangic',
    search: 'sert başlangıç glottal atak ses egzersizi',
    urls: ['https://m.youtube.com/watch?v=1SePvXrpxQE', 'https://www.youtube.com/watch?v=K79OlbRLebc', 'https://www.youtube.com/watch?v=MHa_JkztRGQ']
  },
  {
    id: 'oksuruk',
    search: 'öksürükten sese ses teli egzersizi',
    urls: ['https://www.youtube.com/watch?v=Pmjsn2nsxZA', 'https://m.youtube.com/watch?v=1SePvXrpxQE', 'https://www.youtube.com/watch?v=MHa_JkztRGQ']
  },
  {
    id: 'yarim-yutkunma',
    search: 'yarım yutkunma bum ses egzersizi',
    urls: ['https://m.youtube.com/watch?v=1SePvXrpxQE', 'https://www.youtube.com/watch?v=9GLjqQlZRkk']
  },
  {
    id: 'bas-cevirme',
    search: 'ses teli felci ses egzersizi baş çevirme',
    urls: ['https://www.youtube.com/watch?v=7qmEwxzpT8E', 'https://www.youtube.com/watch?v=Wmluhkuzut0', 'https://www.youtube.com/watch?v=XDDL1ha9gOs']
  },
  {
    id: 'uzun-a',
    search: 'a sesini uzatma fonasyon süresi egzersizi',
    urls: ['https://www.youtube.com/watch?v=K79OlbRLebc', 'https://www.youtube.com/watch?v=YI1F7fw75b0']
  },
  {
    id: 'vfe-i',
    search: 'vokal fonksiyon egzersizleri ısınma',
    urls: ['https://www.youtube.com/shorts/v3Zq8T8C1Ys', 'https://www.youtube.com/watch?v=ZCS2FRLym1g', 'https://www.youtube.com/watch?v=TRIKSmAN5nU', 'https://www.youtube.com/watch?v=uM2TLN7nQW0', 'https://www.youtube.com/watch?v=IeuY84lq3Iw']
  },
  {
    id: 'perde-kaydirma',
    search: 'glissando ses egzersizi perde kaydırma',
    urls: ['https://www.youtube.com/watch?v=ZuBRs2Nm0YU', 'https://www.youtube.com/shorts/cA-7uQ0Sl7Q', 'https://www.youtube.com/watch?v=rkWlwlKHhpM', 'https://m.youtube.com/watch?v=9XJeQQVdJKg']
  },
  {
    id: 'vfe-notalar',
    search: 'staccato portato ses egzersizi nota',
    urls: ['https://www.youtube.com/watch?v=t7Mm4HgyKlo', 'https://www.youtube.com/watch?v=HIVBmLdQg9c', 'https://www.youtube.com/watch?v=QIXa_g9F9Ug', 'https://www.youtube.com/watch?v=d6lJdSbd-h8']
  },
  {
    id: 'gur-a',
    search: 'gür ve tok ses egzersizi',
    urls: ['https://www.youtube.com/watch?v=gBEL1mj2OFI', 'https://m.youtube.com/watch?v=smHRwppSFQA', 'https://www.youtube.com/watch?v=3cOsXwmKeSY', 'https://www.youtube.com/watch?v=zNUGeFDSWlc']
  },
  {
    id: 'gur-ifadeler',
    search: 'sesi etkili kullanma egzersizi',
    urls: ['https://www.youtube.com/watch?v=fhCJNZ22e88', 'https://www.youtube.com/watch?v=O0WBy1Pq66A', 'https://www.youtube.com/watch?v=UXaLEGLjJiA', 'https://www.youtube.com/watch?v=8aaHWfv32zc']
  },
  {
    id: 'su-direnci',
    search: 'lax vox tüp egzersizi',
    urls: ['https://www.youtube.com/watch?v=I2kgqCa0kuE', 'https://www.youtube.com/playlist?list=PLvsYVnIbuA5NCgsUOx_0FHsMTCpo9SlCl', 'https://www.youtube.com/watch?v=PsjUJjrSE7A']
  },
  {
    id: 'pipet',
    search: 'pipetle ses egzersizi',
    urls: ['https://m.youtube.com/watch?v=gnQmf6_XfPw', 'https://www.youtube.com/watch?v=UbuapADtz9c', 'https://www.youtube.com/watch?v=WvtgFbCgY8E']
  }
]

const BY_URL = new Map<string, LibVideo>(LIBRARY.flatMap((t) => t.videos.map((v) => [v.url, v])))

// Bir egzersize baglanan videolar (listede olmayan baglanti sessizce atlanir)
export function videosFor(id: string): LibVideo[] {
  const e = EX_VIDEOS.find((x) => x.id === id)
  if (!e) return []
  return e.urls.map((u) => BY_URL.get(u)).filter((v): v is LibVideo => !!v)
}

export function searchFor(id: string): string {
  return EX_VIDEOS.find((x) => x.id === id)?.search ?? ''
}

// Arama baglantisi: video kaldirilsa bile bu her zaman calisir.
// sp=EgIYAQ%3D%3D -> YouTube'un "kisa (4 dk'dan az)" sure suzgeci; YouTube
// suzgeci taniyamazsa normal sonuc listesi acilir, baglanti yine calisir.
export function searchUrl(q: string, kisa = true): string {
  const temel = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`
  return kisa ? `${temel}&sp=EgIYAQ%3D%3D` : temel
}

// Listedeki YouTube Shorts sayisi
export function shortsCount(): number {
  return LIBRARY.reduce((n, t) => n + t.videos.filter((v) => v.shorts).length, 0)
}

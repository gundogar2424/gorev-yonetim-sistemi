// "İZLE" SEKMESI — konulara ayrilmis, arada izlemek icin kisa YouTube videolari.
// Egzersiz ekranlarinda GOSTERILMEZ; orada yalnizca uygulamanin kendi klipleri
// vardir. Buradaki videolar harici kaynaktir ve internet gerektirir.
// Tumu web aramasinda bulunmus gercek baglantilardir; icerikleri izlenerek
// dogrulanmamistir, bu yuzden ekranda "dis kaynak" uyarisi gosterilir.

export interface LibVideo {
  url: string
  title: string
  by?: string // kanal / kisi
  lang?: 'tr' | 'en' | 'fr'
  short?: boolean // kisa video (Shorts ya da birkac dakika)
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
      { url: 'https://www.youtube.com/shorts/_tRlnhOGWsQ', title: 'Ses teli nodülü nedir?', by: 'Op. Dr. Mustafa Uslu', lang: 'tr', short: true },
      { url: 'https://www.youtube.com/watch?v=OS8FiUe3Ak8', title: 'Sesiniz mi kısıldı? Evde 3 altın kural', by: 'Doç. Dr. Necati Enver', lang: 'tr', short: true },
      { url: 'https://www.youtube.com/watch?v=_alGOXXGipY', title: 'Ses kısıklığı ve ses teli problemleri', by: 'Doç. Dr. Necati Enver', lang: 'tr' },
      { url: 'https://www.youtube.com/watch?v=s6mZY0jSoLQ', title: 'Ses kısıklığı tedavisi', by: 'Prof. Dr. Arzu Tatlıpınar', lang: 'tr' },
      { url: 'https://www.youtube.com/watch?v=LpR7JF6qIaU', title: 'Ses kısıklığı ve tedavisi', by: 'Op. Dr. Hasan Zorlu', lang: 'tr' },
      { url: 'https://www.youtube.com/watch?v=34F-JKZQKb0', title: 'Ses teli felci tedavisi', lang: 'tr' },
      { url: 'https://www.youtube.com/watch?v=XDDL1ha9gOs', title: 'Ses teli felcinde hangi egzersizler yardımcı olur?', lang: 'en' },
      { url: 'https://www.youtube.com/watch?v=jYg8wNQZ3sU', title: 'İki taraflı ses teli felci', lang: 'tr' }
    ]
  },
  {
    id: 'ses-terapisi',
    title: 'Ses terapisi egzersizleri',
    emoji: '🎤',
    note: 'Tüp (Lax Vox), pipet ve terapi egzersizleri.',
    videos: [
      { url: 'https://www.youtube.com/watch?v=I2kgqCa0kuE', title: 'DoctorVox ses terapisi egzersizi', lang: 'tr', short: true },
      { url: 'https://www.youtube.com/watch?v=ZuBRs2Nm0YU', title: 'Glissando egzersizi (perde kaydırma)', lang: 'tr', short: true },
      { url: 'https://www.youtube.com/watch?v=rkWlwlKHhpM', title: 'Portamento egzersizi', lang: 'tr', short: true },
      { url: 'https://www.youtube.com/watch?v=t7Mm4HgyKlo', title: 'Staccato egzersizi', lang: 'tr', short: true },
      { url: 'https://www.youtube.com/watch?v=HIVBmLdQg9c', title: 'Portato egzersizi', lang: 'tr', short: true },
      { url: 'https://www.youtube.com/playlist?list=PLvsYVnIbuA5NCgsUOx_0FHsMTCpo9SlCl', title: 'DoctorVox / Lax Vox tekniği (tüm seri)', lang: 'tr' },
      { url: 'https://www.youtube.com/watch?v=UbuapADtz9c', title: 'Pipete fonasyon egzersizi', lang: 'tr', short: true },
      { url: 'https://www.youtube.com/watch?v=Ob-UY9ZoGVo', title: 'Ses terapisi: nasıl yapıyorum?', lang: 'tr' },
      { url: 'https://m.youtube.com/watch?v=VBvJGb7fplY', title: 'Ses terapisi çalışması (basit ve etkili)', lang: 'tr', short: true },
      { url: 'https://m.youtube.com/watch?v=1SePvXrpxQE', title: 'Ses tellerini güçlendiren egzersiz', lang: 'tr', short: true }
    ]
  },
  {
    id: 'vfe',
    title: 'Vokal Fonksiyon Egzersizleri',
    emoji: '🎼',
    note: 'Uygulamadaki VFE 1-4 ve gür ses egzersizlerinin kaynağından anlatımı (İngilizce).',
    videos: [
      { url: 'https://www.youtube.com/watch?v=uM2TLN7nQW0', title: 'Vocal Function Exercises — Joseph Stemple (yöntemin sahibi)', lang: 'en' },
      { url: 'https://www.youtube.com/watch?v=IeuY84lq3Iw', title: 'Vocal Function Exercises (ses terapisi)', lang: 'en', short: true },
      { url: 'https://www.youtube.com/watch?v=1rzZupWzYes', title: 'Vocal Function Exercises', lang: 'en', short: true },
      { url: 'https://www.youtube.com/watch?v=d6lJdSbd-h8', title: 'Stemple VFE: kanıta dayalı ses terapisi', lang: 'en' },
      { url: 'https://www.youtube.com/watch?v=zNUGeFDSWlc', title: 'PhoRTE (gür ses egzersizleri) — 1. bölüm', lang: 'en', short: true },
      { url: 'https://www.youtube.com/watch?v=8aaHWfv32zc', title: 'PhoRTE — 3. bölüm', lang: 'en', short: true },
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
    note: 'Diyafram nefesi ve kısa ses ısınmaları.',
    videos: [
      { url: 'https://www.youtube.com/watch?v=74_QDyUcV6I', title: 'Diyafram nefesi egzersizi', lang: 'tr', short: true },
      { url: 'https://www.youtube.com/watch?v=4B1vrHCIVg4', title: 'Karın nefesi / diyafram nefesi', lang: 'tr', short: true },
      { url: 'https://www.youtube.com/shorts/Zy1WYm-aJ58', title: 'Diyafram solunumu (fizyoterapist)', lang: 'tr', short: true },
      { url: 'https://www.youtube.com/watch?v=xj57IDmkxME', title: 'Hızlı ısınma: 3 farklı egzersiz', lang: 'tr', short: true },
      { url: 'https://www.youtube.com/watch?v=ue2EgqA3YcY', title: 'Dudak trili nedir, nasıl yapılır?', lang: 'tr', short: true },
      { url: 'https://www.youtube.com/watch?v=vpgM3iMvFOs', title: 'Dudak trili — ses açma egzersizi', lang: 'tr', short: true },
      { url: 'https://www.youtube.com/watch?v=oVAOV0PtUPk', title: 'Rezonans çalışması "ye-ye-ye"', lang: 'tr', short: true },
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

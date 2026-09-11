// EFT (Emotional Freedom Techniques / Duygusal Ozgurlesme Teknigi) icerigi:
// dokunma noktalari, hazir konu (sorun) listesi, kurulum cumleleri, hatirlatma
// ifadeleri ve gunun ipuclari. Klasik "kisa recete" (Gary Craig) sirasi kullanilir.

export interface Point {
  id: string
  name: string
  where: string // vucutta tam yeri
  how: string // nasil vurulur
  cx: number // BodyMap SVG koordinati (viewBox 0 0 300 360)
  cy: number
}

// Kurulum cumlesi soylenirken vurulan nokta (el kenari)
export const KARATE: Point = {
  id: 'kc',
  name: 'Karate Noktası',
  where: 'Elin dış kenarı, serçe parmağın altındaki etli kısım',
  how: 'Diğer elin parmak uçlarıyla el kenarına ritmik vur; kurulum cümlesini söylerken sürekli devam et.',
  cx: 0,
  cy: 0
}

export const POINTS: Point[] = [
  { id: 'eb', name: 'Kaş Başı', where: 'Kaşın burna yakın iç ucu', how: 'İki parmakla, hafifçe.', cx: 128, cy: 92 },
  { id: 'se', name: 'Göz Kenarı', where: 'Gözün dış köşesindeki kemik üstü', how: 'Şakağa değil, göz çukurunun kenarına.', cx: 86, cy: 100 },
  { id: 'ue', name: 'Göz Altı', where: 'Göz bebeğinin tam altındaki kemik', how: 'Elmacık kemiğinin üstüne, göze bastırmadan.', cx: 116, cy: 124 },
  { id: 'un', name: 'Burun Altı', where: 'Burun ile üst dudak arasındaki oluk', how: 'Tek ya da iki parmakla.', cx: 150, cy: 150 },
  { id: 'ch', name: 'Çene', where: 'Alt dudak ile çene ucu arasındaki çukur', how: 'Çenenin ortasına.', cx: 150, cy: 176 },
  { id: 'cb', name: 'Köprücük Kemiği', where: 'Köprücük kemiğinin iç ucunun hemen altı', how: 'Boynun dibindeki "U" çukurunun 2-3 cm altı ve yanı.', cx: 122, cy: 236 },
  { id: 'ua', name: 'Koltuk Altı', where: 'Koltuk altının bir karış altı, kaburgaların yanı', how: 'Açık elle ya da parmaklarla, vücudun yan tarafına.', cx: 66, cy: 300 },
  { id: 'th', name: 'Baş Üstü', where: 'Başın tam tepesi', how: 'Tüm parmak uçlarıyla, tepenin ortasına.', cx: 150, cy: 32 }
]

export function pointById(id: string): Point | undefined {
  return id === 'kc' ? KARATE : POINTS.find((p) => p.id === id)
}

export interface Issue {
  id: string
  name: string
  emoji: string
  hint: string
  setup: string // kurulum cumlesi (karate noktasinda 3 kez soylenir)
  reminders: string[] // her noktada soylenen kisa hatirlatma ifadeleri
  positives: string[] // yogunluk dusunce olumlu tur ifadeleri
}

export const ISSUES: Issue[] = [
  {
    id: 'kaygi',
    name: 'Kaygı / Endişe',
    emoji: '😰',
    hint: 'Huzursuzluk, içten içe sıkıntı, "ya olursa" düşünceleri',
    setup: 'Her ne kadar içimde bu kaygıyı hissetsem de, kendimi derinden ve tamamen kabul ediyorum.',
    reminders: [
      'bu kaygı',
      'göğsümdeki bu sıkışma',
      'bu endişe',
      'ya olursa düşüncesi',
      'bedenimdeki bu huzursuzluk',
      'bu kaygı hissi',
      'kalan bu kaygı',
      'bu kaygıyı bırakmayı seçiyorum'
    ],
    positives: [
      'şu an güvendeyim',
      'nefes alıyorum, sakinleşiyorum',
      'bu duyguya izin veriyorum ve geçmesine izin veriyorum',
      'bedenim gevşiyor',
      'elimden geleni yapıyorum, bu yeterli',
      'sakin olmayı seçiyorum',
      'huzur hissetmeyi seçiyorum',
      'iyiyim, tam da olduğum yerde iyiyim'
    ]
  },
  {
    id: 'stres',
    name: 'Stres / Baskı',
    emoji: '🤯',
    hint: 'Yetişememe, omuzlardaki yük, gerginlik',
    setup: 'Her ne kadar bu kadar stresli ve baskı altında hissetsem de, kendimi derinden ve tamamen kabul ediyorum.',
    reminders: [
      'bu stres',
      'omuzlarımdaki bu yük',
      'bu baskı',
      'yetişememe duygusu',
      'bedenimdeki bu gerginlik',
      'bu kadar stres',
      'kalan bu gerginlik',
      'bu stresi bırakıyorum'
    ],
    positives: [
      'tek seferde tek adım yeter',
      'omuzlarım gevşiyor',
      'her şeyi aynı anda yapmam gerekmiyor',
      'nefesimle sakinleşiyorum',
      'gerginliği bırakmayı seçiyorum',
      'yavaşlayabilirim',
      'hafiflemeyi seçiyorum',
      'bedenim rahatlıyor'
    ]
  },
  {
    id: 'ofke',
    name: 'Öfke / Kızgınlık',
    emoji: '😠',
    hint: 'İçten içe kaynama, haksızlık hissi, sinirlilik',
    setup: 'Her ne kadar içimde bu öfkeyi hissetsem de, kendimi derinden ve tamamen kabul ediyorum.',
    reminders: [
      'bu öfke',
      'içimdeki bu kaynama',
      'bu haksızlık hissi',
      'bu kızgınlık',
      'çenemdeki bu sıkılık',
      'tüm bu öfke',
      'kalan bu kızgınlık',
      'bu öfkeyi bırakmayı seçiyorum'
    ],
    positives: [
      'öfkemi hissedebilirim ve yine de sakin kalabilirim',
      'bu duygu benim, ama ben bu duygu değilim',
      'nefes alıyorum, gevşiyorum',
      'huzuru seçiyorum',
      'bunu bırakmak bana iyi gelecek',
      'çenem gevşiyor',
      'kendime nazik davranıyorum',
      'sakinleşiyorum'
    ]
  },
  {
    id: 'uzuntu',
    name: 'Üzüntü / Keder',
    emoji: '😢',
    hint: 'Ağırlık, ağlama isteği, boşluk hissi',
    setup: 'Her ne kadar bu üzüntüyü içimde taşısam da, kendimi derinden ve tamamen kabul ediyorum.',
    reminders: [
      'bu üzüntü',
      'kalbimdeki bu ağırlık',
      'bu keder',
      'boğazımdaki bu düğüm',
      'bu boşluk hissi',
      'tüm bu üzüntü',
      'kalan bu ağırlık',
      'bu üzüntüye izin veriyorum'
    ],
    positives: [
      'üzülmeme izin veriyorum',
      'bu duygu geçici',
      'kendime şefkat gösteriyorum',
      'kalbim hafifliyor',
      'iyileşmeyi seçiyorum',
      'yalnız değilim',
      'güvendeyim',
      'nefes alıyorum ve bırakıyorum'
    ]
  },
  {
    id: 'korku',
    name: 'Korku / Fobi',
    emoji: '😨',
    hint: 'Belirli bir şeyden korku, panik, kaçma isteği',
    setup: 'Her ne kadar bu korkuyu hissetsem de, kendimi derinden ve tamamen kabul ediyorum.',
    reminders: [
      'bu korku',
      'midemdeki bu düğüm',
      'bu panik hissi',
      'kaçma isteği',
      'bedenimdeki bu titreme',
      'tüm bu korku',
      'kalan bu korku',
      'bu korkuyu bırakmayı seçiyorum'
    ],
    positives: [
      'şu an güvendeyim',
      'ayaklarım yerde, nefesim burada',
      'bu korkuyla baş edebilirim',
      'sakinleşiyorum',
      'bedenim gevşiyor',
      'güvende olmayı seçiyorum',
      'korkum küçülüyor',
      'iyiyim'
    ]
  },
  {
    id: 'agri',
    name: 'Ağrı / Bedensel Rahatsızlık',
    emoji: '🤕',
    hint: 'Baş ağrısı, sırt ağrısı, gerginlikten kaynaklanan ağrı',
    setup: 'Her ne kadar bedenimde bu ağrıyı hissetsem de, kendimi derinden ve tamamen kabul ediyorum.',
    reminders: [
      'bu ağrı',
      'bedenimdeki bu rahatsızlık',
      'bu sızı',
      'bu ağrının gerginliği',
      'ağrının etrafındaki bu sıkılık',
      'tüm bu ağrı',
      'kalan bu ağrı',
      'bedenimin gevşemesine izin veriyorum'
    ],
    positives: [
      'bedenim gevşiyor',
      'ağrının etrafı yumuşuyor',
      'nefesim ağrıya gidiyor',
      'bedenime nazik davranıyorum',
      'rahatlamayı seçiyorum',
      'bedenim kendini iyileştirmeyi biliyor',
      'hafifliyorum',
      'rahatım'
    ]
  },
  {
    id: 'uyku',
    name: 'Uykusuzluk / Yatakta Dönüp Durma',
    emoji: '😴',
    hint: 'Uyuyamama, zihnin durmaması, yorgunluk',
    setup: 'Her ne kadar zihnim durmasa ve uyuyamasam da, kendimi derinden ve tamamen kabul ediyorum.',
    reminders: [
      'bu uyuyamama',
      'durmayan bu düşünceler',
      'yatakta dönüp durma',
      'bu yorgunluk',
      'zihnimdeki bu gürültü',
      'uyuyamama korkusu',
      'kalan bu huzursuzluk',
      'zihnimin sakinleşmesine izin veriyorum'
    ],
    positives: [
      'zihnim yavaşlıyor',
      'bedenim ağırlaşıyor, gevşiyor',
      'yarın da düşünebilirim',
      'şu an dinlenmek güvenli',
      'nefesim uzuyor',
      'uykuya izin veriyorum',
      'sakinim',
      'huzurlu ve rahatım'
    ]
  },
  {
    id: 'ozguven',
    name: 'Özgüven / Yetersizlik Hissi',
    emoji: '🙈',
    hint: '"Yapamam", "yeterli değilim", kendini küçük görme',
    setup: 'Her ne kadar kendimi yetersiz hissetsem de, kendimi derinden ve tamamen kabul ediyorum.',
    reminders: [
      'bu yetersizlik hissi',
      'yapamam düşüncesi',
      'kendimi küçük görme',
      'bu özgüven eksikliği',
      'beğenilmeme korkusu',
      'tüm bu yetersizlik hissi',
      'kalan bu kuşku',
      'bu inancı bırakmayı seçiyorum'
    ],
    positives: [
      'olduğum gibi yeterliyim',
      'hata yapabilirim ve yine de değerliyim',
      'kendime güvenmeyi seçiyorum',
      'elimden geleni yapıyorum',
      'kendimi olduğum gibi kabul ediyorum',
      'içimde güç var',
      'kendime inanıyorum',
      'ben yeterliyim'
    ]
  },
  {
    id: 'istek',
    name: 'İstek / Bağımlılık Krizi',
    emoji: '🍩',
    hint: 'Tatlı, sigara, telefon… şiddetli canı çekme anı',
    setup: 'Her ne kadar şu an bu şiddetli isteği hissetsem de, kendimi derinden ve tamamen kabul ediyorum.',
    reminders: [
      'bu istek',
      'bu canım çekme hissi',
      'şimdi istiyorum duygusu',
      'bedenimdeki bu çekim',
      'bu şiddetli istek',
      'tüm bu istek',
      'kalan bu istek',
      'bu isteğin geçmesine izin veriyorum'
    ],
    positives: [
      'bu istek bir dalga, geçecek',
      'kendimi kontrol edebilirim',
      'bedenime iyi geleni seçiyorum',
      'nefes alıyorum, dalga geçiyor',
      'ben isteklerimden daha güçlüyüm',
      'sakinleşiyorum',
      'özgür olmayı seçiyorum',
      'iyiyim'
    ]
  },
  {
    id: 'sucluluk',
    name: 'Suçluluk / Pişmanlık',
    emoji: '😔',
    hint: 'Keşke yapmasaydım, kendini suçlama, utanç',
    setup: 'Her ne kadar bu suçluluğu ve pişmanlığı hissetsem de, kendimi derinden ve tamamen kabul ediyorum.',
    reminders: [
      'bu suçluluk',
      'keşke düşüncesi',
      'kendimi suçlama',
      'bu pişmanlık',
      'bu utanç hissi',
      'tüm bu suçluluk',
      'kalan bu ağırlık',
      'kendimi affetmeyi seçiyorum'
    ],
    positives: [
      'o zaman elimden geleni yaptım',
      'hatalarımdan öğreniyorum',
      'kendimi affediyorum',
      'geçmişi değiştiremem, bugünü seçebilirim',
      'kendime şefkat gösteriyorum',
      'yükü bırakıyorum',
      'kendime nazik davranıyorum',
      'huzuru seçiyorum'
    ]
  }
]

export function issueById(id: string): Issue | undefined {
  return ISSUES.find((i) => i.id === id)
}

// Kullanicinin kendi yazdigi konu icin ifade ureteci.
export function customIssue(text: string): Issue {
  const x = text.trim()
  return {
    id: 'ozel',
    name: x,
    emoji: '✍️',
    hint: '',
    setup: `Her ne kadar "${x}" ile ilgili bu duyguyu hissetsem de, kendimi derinden ve tamamen kabul ediyorum.`,
    reminders: [
      `${x}`,
      `${x} ile ilgili bu duygu`,
      `bedenimdeki bu his`,
      `${x}`,
      `bu duygu`,
      `tüm bu his`,
      `kalan bu duygu`,
      `bunu bırakmayı seçiyorum`
    ],
    positives: [
      'nefes alıyorum, sakinleşiyorum',
      'bu duyguya izin veriyorum ve geçmesine izin veriyorum',
      'bedenim gevşiyor',
      'güvendeyim',
      'kendime nazik davranıyorum',
      'hafiflemeyi seçiyorum',
      'huzur hissetmeyi seçiyorum',
      'iyiyim'
    ]
  }
}

// Tur ve nokta sirasina gore soylenecek ifade. 2. turdan itibaren ifadeler
// kayarak degisir; olumlu turda olumlu liste kullanilir.
export function phraseFor(issue: Issue, round: number, pointIndex: number, positive: boolean): string {
  const list = positive ? issue.positives : issue.reminders
  const offset = positive ? 0 : Math.max(0, round - 1) * 3
  return list[(offset + pointIndex) % list.length]
}

// Gunun ipucu: EFT uygulamasi icin pratik oneriler (tibbi tavsiye degildir).
export const TIPS: string[] = [
  'Kurulum cümlesini yüksek sesle söyle. Sesli söylemek, duyguya odaklanmayı kolaylaştırır.',
  'Vuruşlar sert olmasın: parmak uçlarıyla, kapıyı hafifçe tıklatır gibi.',
  'Konuyu ne kadar somutlaştırırsan o kadar iyi. "Kaygı" yerine "yarınki toplantıda konuşma sırası bana gelince hissettiğim sıkışma".',
  'Turdan sonra derin bir nefes al ve yeniden puan ver. Puan düşmediyse konuyu daha da özelleştirmeyi dene.',
  'Yoğunluk 2-3\'e inince olumlu tura geç; ama daha önce olumlu ifadelere atlama.',
  'Her iki tarafa da vurabilirsin, tek tarafa da. Fark yok; rahat olan elini kullan.',
  'Bir konu bittiğinde ardından başka bir "katman" çıkabilir (öfkenin altında üzüntü gibi). Onunla da çalış.',
  'Duygu bedende nerede? Göğüs, mide, boğaz… O yeri ifadeye kat: "midemdeki bu düğüm".',
  'Su iç. Uygulama sonrası çoğu kişi susadığını fark eder.',
  'Günde iki dakika düzenli uygulama, ayda bir uzun seanstan daha etkilidir.',
  'Nefesini zorlamadan izle. Vuruş ritmi nefesinle uyumlu olursa gevşeme daha hızlı gelir.',
  'Kendine kızmadan yap: "kendimi kabul ediyorum" kısmı süs değil, tekniğin özüdür.'
]

export function tipOfDay(dayNo: number): string {
  return TIPS[((dayNo % TIPS.length) + TIPS.length) % TIPS.length]
}

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
  return ISSUES.find((i) => i.id === id) ?? HUNGER_ISSUES.find((i) => i.id === id)
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

// =========================================================================
// YEMEK ISTEGI: kullanici canini ceken yemegi yazar; yemegin turune gore
// (tatli / tuzlu-citir / hamur isi / fast food / icecek / genel) ozel
// telkinler uretilir. Ifadelerde {x} yemegin adiyla degistirilir.
// =========================================================================
export type FoodKind = 'tatli' | 'tuzlu' | 'hamur' | 'fastfood' | 'icecek' | 'genel'

const FOOD_KEYS: Record<Exclude<FoodKind, 'genel'>, string[]> = {
  tatli: [
    'çikolata', 'cikolata', 'tatlı', 'tatli', 'baklava', 'pasta', 'kek', 'dondurma', 'şeker', 'seker', 'kurabiye',
    'bisküvi', 'biskuvi', 'lokum', 'helva', 'sütlaç', 'sutlac', 'künefe', 'kunefe', 'gofret', 'bal', 'reçel', 'recel',
    'waffle', 'tart', 'profiterol', 'kadayıf', 'kadayif', 'şekerleme', 'sekerleme', 'donut', 'muffin', 'browni', 'brownie',
    'krema', 'puding', 'tulumba', 'revani', 'şerbet', 'serbet', 'çikolatalı', 'cikolatali', 'nutella', 'jelibon'
  ],
  tuzlu: [
    'cips', 'çips', 'kuruyemiş', 'kuruyemis', 'fıstık', 'fistik', 'çekirdek', 'cekirdek', 'kraker', 'patlamış', 'patlamis',
    'mısır', 'misir', 'tuzlu', 'kızartma', 'kizartma', 'patates', 'çerez', 'cerez', 'leblebi', 'zeytin', 'peynir', 'turşu', 'tursu'
  ],
  hamur: [
    'ekmek', 'simit', 'poğaça', 'pogaca', 'börek', 'borek', 'makarna', 'pide', 'lahmacun', 'mantı', 'manti', 'hamur', 'açma',
    'acma', 'tost', 'sandviç', 'sandvic', 'pilav', 'bulgur', 'gözleme', 'gozleme', 'bazlama', 'çörek', 'corek', 'kruvasan',
    'krep', 'pankek', 'erişte', 'eriste', 'noodle'
  ],
  fastfood: [
    'pizza', 'hamburger', 'burger', 'döner', 'doner', 'kebap', 'sosisli', 'nugget', 'fast food', 'fastfood', 'dürüm', 'durum',
    'kokoreç', 'kokorec', 'köfte', 'kofte', 'tavuk', 'kanat', 'sucuk', 'salam', 'sosis', 'ciğer', 'ciger', 'iskender'
  ],
  icecek: [
    'kola', 'gazoz', 'soda', 'meyve suyu', 'kahve', 'çay', 'cay', 'enerji', 'içecek', 'icecek', 'milkshake', 'frappe',
    'bira', 'şarap', 'sarap', 'rakı', 'raki', 'alkol', 'ayran', 'limonata', 'şalgam', 'salgam', 'latte', 'smoothie'
  ]
}

export function foodKind(text: string): FoodKind {
  const t = text.toLocaleLowerCase('tr')
  for (const k of Object.keys(FOOD_KEYS) as Exclude<FoodKind, 'genel'>[]) {
    if (FOOD_KEYS[k].some((w) => t.includes(w))) return k
  }
  return 'genel'
}

export const FOOD_KIND_LABEL: Record<FoodKind, string> = {
  tatli: 'Tatlı / şekerli',
  tuzlu: 'Tuzlu / çıtır atıştırmalık',
  hamur: 'Hamur işi / karbonhidrat',
  fastfood: 'Fast food / ağır yemek',
  icecek: 'İçecek',
  genel: 'Yemek isteği'
}

interface FoodScript {
  setup: string
  reminders: string[]
  positives: string[]
}

// Her turun kendi "sesi" var: tatlida odul/rahatlama, tuzluda elin durmamasi,
// hamur isinde doygunluk/uyusukluk, fast foodda hiz/kolaylik, icecekte alis-
// kanlik ritueli. Hepsi klasik EFT istek protokolunu izler: once istegi
// oldugu gibi kabul, sonra bedende hissetme, sonra birakma.
const FOOD_SCRIPTS: Record<FoodKind, FoodScript> = {
  tatli: {
    setup: 'Her ne kadar şu an canım çok {x} istese ve bu isteğe karşı koymak zor gelse de, kendimi derinden ve tamamen kabul ediyorum.',
    reminders: [
      'bu {x} isteği',
      'ağzımda {x} tadı',
      'şekerin vereceği o anlık rahatlama',
      'kendimi {x} ile ödüllendirme isteği',
      'bu tatlı isteğinin altındaki duygu',
      'midemdeki bu çekim',
      'kalan bu {x} isteği',
      'bu isteğin dalga gibi geçmesine izin veriyorum'
    ],
    positives: [
      'şekere ihtiyacım yok, huzura ihtiyacım var',
      'bu istek bir dalga, birazdan geçecek',
      'bedenime gerçekten iyi geleni seçiyorum',
      'kendimi {x} olmadan da ödüllendirebilirim',
      'ben isteklerimden daha güçlüyüm',
      'nefes alıyorum, istek sönüyor',
      'sakin ve özgür hissetmeyi seçiyorum',
      'iyiyim, tam da olduğum gibi iyiyim'
    ]
  },
  tuzlu: {
    setup: 'Her ne kadar elim durmadan {x} istese ve durmak zor gelse de, kendimi derinden ve tamamen kabul ediyorum.',
    reminders: [
      'bu {x} isteği',
      'elimin {x} paketine gitme isteği',
      'o çıtır ses, o tuz',
      'sıkıntımı {x} ile bastırma isteği',
      'bir tane daha, bir tane daha',
      'midemdeki bu çekim',
      'kalan bu {x} isteği',
      'bu isteğin geçmesine izin veriyorum'
    ],
    positives: [
      'ellerimi başka şeyle meşgul edebilirim',
      'bu istek bir dalga, geçecek',
      'gerçekten aç mıyım, yoksa canım mı sıkkın?',
      'bedenime iyi geleni seçiyorum',
      'durabilirim; kontrol bende',
      'nefes alıyorum, istek sönüyor',
      'özgür olmayı seçiyorum',
      'iyiyim'
    ]
  },
  hamur: {
    setup: 'Her ne kadar şu an canım çok {x} istese ve doymak bilmediğimi hissetsem de, kendimi derinden ve tamamen kabul ediyorum.',
    reminders: [
      'bu {x} isteği',
      'o sıcak, doyurucu {x}',
      'boşluğu {x} ile doldurma isteği',
      'yedikten sonraki o ağırlık',
      'bu doymak bilmeme hissi',
      'midemdeki bu çekim',
      'kalan bu {x} isteği',
      'bu isteği bırakmayı seçiyorum'
    ],
    positives: [
      'bedenim zaten yeterince besleniyor',
      'bu istek bir dalga, geçecek',
      'boşluğu yemekle değil nefesle dolduruyorum',
      'hafif hissetmeyi seçiyorum',
      'bedenime iyi geleni seçiyorum',
      'kontrol bende',
      'sakin ve tokum',
      'iyiyim'
    ]
  },
  fastfood: {
    setup: 'Her ne kadar şu an canım çok {x} istese ve "bir kere yesem ne olur" diye düşünsem de, kendimi derinden ve tamamen kabul ediyorum.',
    reminders: [
      'bu {x} isteği',
      'bir kere yesem ne olur düşüncesi',
      'o kolay, hızlı, yağlı lezzet',
      'yorgunluğumu {x} ile ödüllendirme isteği',
      'yedikten sonraki pişmanlık',
      'midemdeki bu çekim',
      'kalan bu {x} isteği',
      'bu isteğin geçmesine izin veriyorum'
    ],
    positives: [
      'kendimi yemekle değil dinlenerek ödüllendiriyorum',
      'bu istek bir dalga, geçecek',
      'bedenime iyi geleni seçiyorum',
      'yarın kendime teşekkür edeceğim',
      'ben isteklerimden daha güçlüyüm',
      'nefes alıyorum, istek sönüyor',
      'hafif ve özgür hissetmeyi seçiyorum',
      'iyiyim'
    ]
  },
  icecek: {
    setup: 'Her ne kadar şu an canım çok {x} istese ve bu alışkanlığı bırakmak zor gelse de, kendimi derinden ve tamamen kabul ediyorum.',
    reminders: [
      'bu {x} isteği',
      'elimde {x} olmadan eksik hissetme',
      'bu alışkanlığın rahatlığı',
      'o ilk yudumun verdiği his',
      'boğazımdaki bu istek',
      'bedenimdeki bu çekim',
      'kalan bu {x} isteği',
      'bu isteğin geçmesine izin veriyorum'
    ],
    positives: [
      'bir bardak su da beni rahatlatır',
      'bu istek bir dalga, geçecek',
      'bedenime iyi geleni seçiyorum',
      'alışkanlıklarımı ben yönetirim',
      'nefes alıyorum, istek sönüyor',
      'ben isteklerimden daha güçlüyüm',
      'özgür olmayı seçiyorum',
      'iyiyim'
    ]
  },
  genel: {
    setup: 'Her ne kadar şu an canım çok {x} istese ve bu isteğe karşı koymak zor gelse de, kendimi derinden ve tamamen kabul ediyorum.',
    reminders: [
      'bu {x} isteği',
      'ağzımda {x} tadı',
      'şimdi yemek istiyorum duygusu',
      'bu isteğin altındaki duygu',
      'bedenimdeki bu çekim',
      'bu şiddetli {x} isteği',
      'kalan bu {x} isteği',
      'bu isteğin geçmesine izin veriyorum'
    ],
    positives: [
      'bu istek bir dalga, geçecek',
      'gerçekten aç mıyım, yoksa bir duygu mu bu?',
      'bedenime iyi geleni seçiyorum',
      'ben isteklerimden daha güçlüyüm',
      'nefes alıyorum, istek sönüyor',
      'kontrol bende',
      'özgür olmayı seçiyorum',
      'iyiyim'
    ]
  }
}

function fill(s: string, x: string): string {
  return s.replace(/\{x\}/g, x)
}

// Yemek adi -> o yemege ozel telkinlerle dolu Issue
export function foodIssue(text: string): Issue & { kind: FoodKind } {
  const x = text.trim()
  const kind = foodKind(x)
  const sc = FOOD_SCRIPTS[kind]
  return {
    id: 'yemek',
    kind,
    name: `${x} isteği`,
    emoji: '🍽️',
    hint: FOOD_KIND_LABEL[kind],
    setup: fill(sc.setup, x),
    reminders: sc.reminders.map((r) => fill(r, x)),
    positives: sc.positives.map((p) => fill(p, x))
  }
}

// Ana sayfa ve konu ekraninda hizli secim
export const QUICK_FOODS = ['çikolata', 'cips', 'ekmek', 'pizza', 'kola', 'tatlı', 'kahve', 'dondurma']

export function emojiFor(issueId: string): string {
  if (issueId === 'yemek') return '🍽️'
  return issueById(issueId)?.emoji ?? '✍️'
}

// =========================================================================
// ACLIK: belirli bir yemek degil, genel yeme istegini / acligi bastirmak
// icin dort ayri durum. Her birinin kendi kurulum cumlesi, hatirlatma ve
// olumlu ifadeleri var. Once telkinler gosterilir, sonra seans.
// NOT: Gercek, uzun sureli aclik icin degil; ogun arasi ani yeme istegi icin.
// =========================================================================
export const HUNGER_ISSUES: Issue[] = [
  {
    id: 'aclik',
    name: 'Açlık / Yeme isteği',
    emoji: '🍽️',
    hint: 'Öğün arası ani açlık, "bir şeyler atıştırayım" hissi',
    setup: 'Her ne kadar şu an kendimi çok aç hissetsem ve bir şeyler yemek istesem de, kendimi derinden ve tamamen kabul ediyorum.',
    reminders: [
      'bu açlık hissi',
      'midemdeki bu boşluk',
      'bir şeyler atıştırma isteği',
      'bu açlık gerçek mi, yoksa alışkanlık mı?',
      'şimdi yemeliyim düşüncesi',
      'bedenimdeki bu huzursuzluk',
      'kalan bu açlık hissi',
      'bu hissin dalga gibi geçmesine izin veriyorum'
    ],
    positives: [
      'bedenim bir sonraki öğüne kadar rahatça bekleyebilir',
      'bu his bir dalga, 15 dakikada geçer',
      'bir bardak su içiyorum ve bekliyorum',
      'gerçek açlıksa öğünümde doyarım; bu bir istekse bırakırım',
      'midem sakin, zihnim sakin',
      'ben açlığımdan daha güçlüyüm',
      'hafif ve rahat hissetmeyi seçiyorum',
      'iyiyim, tokum, huzurluyum'
    ]
  },
  {
    id: 'aclik-gece',
    name: 'Gece açlığı',
    emoji: '🌙',
    hint: 'Akşam yemeğinden sonra buzdolabına gitme isteği',
    setup: 'Her ne kadar gece bu saatte canım yemek istese ve buzdolabı beni çekse de, kendimi derinden ve tamamen kabul ediyorum.',
    reminders: [
      'bu gece açlığı',
      'buzdolabına gitme isteği',
      'yatmadan önce bir şey yeme alışkanlığı',
      'akşam boşluğunu yemekle doldurma isteği',
      'yorgunluğumu yemekle bastırma isteği',
      'midemdeki bu çekim',
      'kalan bu gece isteği',
      'bu isteğin geçmesine izin veriyorum'
    ],
    positives: [
      'mutfak bu gece kapalı',
      'bedenim gece dinlenmek istiyor, yemek değil',
      'bir bardak su ya da bitki çayı yeterli',
      'sabah kendime teşekkür edeceğim',
      'uykum yemekten daha iyi gelecek',
      'bu istek bir dalga, uyuyunca geçecek',
      'hafif uyumayı seçiyorum',
      'sakinim, tokum, uykum var'
    ]
  },
  {
    id: 'aclik-oruc',
    name: 'Diyet / oruç açlığı',
    emoji: '⏳',
    hint: 'Diyet ya da aralıklı oruç sırasında zorlanma',
    setup: 'Her ne kadar diyetimde bu açlığa dayanmak zor gelse ve pes etmek istesem de, kendimi derinden ve tamamen kabul ediyorum.',
    reminders: [
      'bu diyet açlığı',
      'pes etme isteği',
      'şimdi yesem ne olur düşüncesi',
      'bu mahrumiyet hissi',
      'midemdeki bu boşluk',
      'saat geçmiyor hissi',
      'kalan bu açlık',
      'bu açlığa dayanabileceğime izin veriyorum'
    ],
    positives: [
      'bu açlık, bedenimin yağ yaktığının işareti',
      'her dakika hedefime yaklaşıyorum',
      'açlık dalga dalga gelir ve gider',
      'su içiyorum, nefes alıyorum, bekliyorum',
      'daha önce de başardım, yine başarırım',
      'kararlıyım ve sakinim',
      'bedenime güveniyorum',
      'güçlüyüm, iyiyim, devam ediyorum'
    ]
  },
  {
    id: 'aclik-duygusal',
    name: 'Duygusal açlık',
    emoji: '🫥',
    hint: 'Can sıkıntısı, stres ya da üzüntüden yeme isteği',
    setup: 'Her ne kadar aç olmadığımı bilsem de duygularımı yemekle bastırmak istesem de, kendimi derinden ve tamamen kabul ediyorum.',
    reminders: [
      'bu duygusal açlık',
      'can sıkıntısını yemekle doldurma isteği',
      'bu duyguyu hissetmek yerine yeme isteği',
      'boşluğu tabakla kapatma isteği',
      'yemekle kendimi teselli etme alışkanlığı',
      'göğsümdeki bu boşluk',
      'kalan bu istek',
      'bu duyguyu yemeden hissetmeye izin veriyorum'
    ],
    positives: [
      'ihtiyacım olan yemek değil, biraz şefkat',
      'bu duyguyu hissedebilirim ve geçmesine izin verebilirim',
      'kendimi yemekle değil nefesle sakinleştiriyorum',
      'boşluğu yemekle değil, iyi gelen bir şeyle dolduruyorum',
      'duygumu tanıdım, ona yer açtım',
      'ben duygularımdan daha güçlüyüm',
      'huzur hissetmeyi seçiyorum',
      'iyiyim, güvendeyim'
    ]
  }
]

export function hungerById(id: string): Issue | undefined {
  return HUNGER_ISSUES.find((i) => i.id === id)
}

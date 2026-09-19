// DIKSIYON egzersizleri: nefes, sesli/unsuz harf artikulasyonu, hece
// dizileri, tekerlemeler, kalem egzersizi, vurgu-tonlama ve hiz. Addüksiyon
// seansindan AYRI bir bolum; ayni uygulamada "Diksiyon" sekmesi.
//
// Her egzersizde ekranda buyuk yazilan "satirlar" vardir; kullanici bunlari
// verilen surede okur/soyler. Tempo (yavas/orta/hizli) sureyi olceklendirir.

export type DGroup = 'nefes' | 'sesli' | 'unsuz' | 'tekerleme' | 'kalem' | 'vurgu'

export interface DExercise {
  id: string
  name: string
  emoji: string
  group: DGroup
  short: string
  why: string
  steps: string[]
  lines: string[] // ekranda okunacak/soylenecek metin(ler); tekrarda sirayla
  reps: number // tekrar sayisi (satir sayisindan bagimsiz: her tekrar = bir satir)
  sec: number // bir tekrar icin saniye (orta tempoda)
  tip?: string
  clip?: string // uygulamaya gomulu kisa gosterim videosu
}

export const DGROUP_LABEL: Record<DGroup, string> = {
  nefes: 'Nefes',
  sesli: 'Sesli harfler',
  unsuz: 'Ünsüzler ve heceler',
  tekerleme: 'Tekerlemeler',
  kalem: 'Kalem egzersizi',
  vurgu: 'Vurgu, tonlama, hız'
}

export type DTempo = 'yavas' | 'orta' | 'hizli'
export const DTEMPO_MULT: Record<DTempo, number> = { yavas: 1.5, orta: 1, hizli: 0.7 }
export const DTEMPO_LABEL: Record<DTempo, string> = { yavas: 'Yavaş', orta: 'Orta', hizli: 'Hızlı' }

const PARAGRAF_1 =
  'Sabahın erken saatlerinde şehir henüz uyanmamıştı. Sokaklarda yalnızca fırıncının kepenk sesi ve uzaktan gelen bir vapur düdüğü duyuluyordu. Yaşlı adam bastonuna yaslanıp parkın kapısında durdu, derin bir nefes aldı ve ağaçların arasından süzülen ışığa baktı.'
const PARAGRAF_2 =
  'Kitaplığın en üst rafında, yıllardır açılmamış kalın bir defter duruyordu. Sayfaları sararmış, köşeleri kıvrılmıştı. İçinde eski tarifler, kısa notlar ve küçük çizimler vardı. Her satır, bir zamanlar bu evde yaşayan birinin sabırla yazdığı bir hatırayı saklıyordu.'

export const DEXERCISES: DExercise[] = [
  // ---------------- NEFES ----------------
  {
    id: 'diyafram',
    name: 'Diyafram nefesi',
    emoji: '🫁',
    group: 'nefes',
    short: 'Karından nefes al: 4 say al, 4 tut, 8 sayarak "s" ile ver.',
    why: 'Diksiyonun temeli nefes kontrolüdür. Diyafram nefesi cümle sonlarında sesin düşmesini, hızlı konuşmayı ve boğaz sıkmayı önler.',
    steps: [
      'Dik otur ya da ayakta dur; bir elini karnına koy.',
      'Burnundan 4 sayarak nefes al; karnın şişsin, omuzların kalkmasın.',
      '4 sayarak tut.',
      'Dişlerinin arasından "sssss" diyerek 8 sayarak eşit biçimde ver.'
    ],
    lines: ['AL (4) · TUT (4) · VER "sssss" (8)'],
    clip: './ses-video/karin-nefesi.mp4',
    reps: 5,
    sec: 16
  },
  {
    id: 'uzun-s',
    name: 'Uzun "S" ile nefes',
    emoji: '🐍',
    group: 'nefes',
    short: 'Tek nefeste eşit ve kesintisiz bir "sss" sesini olabildiğince uzat.',
    why: 'Nefesi ölçülü kullanmayı öğretir; uzun cümleleri tek nefeste, sesi düşürmeden bitirmeni sağlar.',
    steps: ['Derin bir diyafram nefesi al.', 'Dişlerin arasından "sssss" diye eşit ve ince bir ses ver; ses ne gürleşsin ne zayıflasın.', 'Nefesin bitene kadar sürdür; her seferinde biraz daha uzatmaya çalış.'],
    lines: ['sssssssss…'],
    reps: 3,
    sec: 20
  },

  // ---------------- SESLI HARFLER ----------------
  {
    id: 'sesli-harfler',
    name: 'Sekiz sesli harf',
    emoji: '👄',
    group: 'sesli',
    short: 'A E I İ O Ö U Ü — her birini ağız şekline dikkat ederek abartılı söyle.',
    why: 'Türkçede anlaşılırlığı en çok sesli harflerin netliği belirler. Ağız açıklığı ve dudak şekli doğru olunca sözcükler "yuvarlanmaz".',
    steps: [
      'Aynaya bak; her harfi ekrandaki tarife göre abartılı ağız hareketiyle söyle.',
      'Her harfi 2-3 saniye uzat, sonra sonrakine geç.',
      'Çeneni gevşek tut, dilin ağzının tabanında dursun.'
    ],
    lines: [
      'A — ağız iki parmak açık, dil düz',
      'E — ağız yayvan, dudak köşeleri geri',
      'I — dişler yakın, dudaklar gevşek',
      'İ — dudaklar gülümser gibi yayvan',
      'O — dudaklar yuvarlak, ağız orta açık',
      'Ö — dudaklar yuvarlak ve öne',
      'U — dudaklar büzük, küçük yuvarlak',
      'Ü — dudaklar iyice büzük ve öne'
    ],
    reps: 8,
    sec: 4
  },
  {
    id: 'sesli-gecis',
    name: 'Sesli geçişleri',
    emoji: '🔁',
    group: 'sesli',
    short: 'Sesli harfleri tek nefeste, ses kesilmeden birbirine bağla.',
    why: 'Sesliler arasında ağız şekli hızlı ve temiz değişmeli; bu geçişler konuşmada akıcılığı verir.',
    steps: ['Tek nefeste, ses kopmadan sırayla söyle.', 'Her harfte ağız şeklinin değiştiğini hisset.', 'Önce yavaş, sonra hızlan.'],
    lines: ['a — e — ı — i — o — ö — u — ü', 'ü — u — ö — o — i — ı — e — a', 'a — o — u — a — o — u', 'e — i — ü — e — i — ü'],
    reps: 4,
    sec: 8
  },

  // ---------------- UNSUZLER / HECELER ----------------
  {
    id: 'dudak-unsuzleri',
    name: 'Dudak ünsüzleri (P B M)',
    emoji: '💋',
    group: 'unsuz',
    short: 'Dudakları sıkıca kapatıp bırakarak pa-pe-pı-pi… dizileri.',
    why: 'P, B, M dudakların tam kapanıp açılmasıyla çıkar; tembel dudaklar bu sesleri yutar ("bir" yerine "bi").',
    steps: ['Dudaklarını iyice kapat, havayı bırakırken heceyi söyle.', 'Her heceyi net ve eşit uzunlukta söyle; hızlanınca netlik bozulmasın.'],
    lines: ['pa pe pı pi po pö pu pü', 'ba be bı bi bo bö bu bü', 'ma me mı mi mo mö mu mü', 'pam pem pım pim pom pöm pum püm'],
    reps: 4,
    sec: 7
  },
  {
    id: 'dis-dudak',
    name: 'Diş-dudak ünsüzleri (F V)',
    emoji: '🦷',
    group: 'unsuz',
    short: 'Üst dişler alt dudağa değerek fa-fe-fı-fi…, va-ve-vı-vi…',
    why: 'F ve V\'de üst dişler alt dudağa hafifçe değmeli; değmezse ses "h" gibi belirsizleşir.',
    steps: ['Üst dişlerini alt dudağına hafifçe dayayıp havayı sürt.', 'F sessiz, V titreşimli: eline dokunup titreşimi hisset.'],
    lines: ['fa fe fı fi fo fö fu fü', 'va ve vı vi vo vö vu vü', 'fav fev fıv fiv fov föv fuv füv'],
    reps: 3,
    sec: 7
  },
  {
    id: 'dil-ucu',
    name: 'Dil ucu ünsüzleri (T D N L)',
    emoji: '👅',
    group: 'unsuz',
    short: 'Dil ucu üst dişlerin arkasına vurarak ta-te-tı-ti…, la-le-lı-li…',
    why: 'T, D, N, L dil ucunun üst diş etine net vurmasıyla çıkar; "gelmedi"nin "gemedi" olması bu tembellikten kaynaklanır.',
    steps: ['Dil ucunu üst ön dişlerinin hemen arkasına vur.', 'Her hecede dil ucunun aynı noktaya değdiğini hisset.'],
    lines: ['ta te tı ti to tö tu tü', 'da de dı di do dö du dü', 'na ne nı ni no nö nu nü', 'la le lı li lo lö lu lü'],
    reps: 4,
    sec: 7
  },
  {
    id: 'r-sesi',
    name: '"R" sesi',
    emoji: '🐯',
    group: 'unsuz',
    short: 'Dil ucunu titreterek rrr; tra-tre, dra-dre, kara kara…',
    why: 'Türkçede en çok yutulan ses "r"dir ("bir" → "bi", "geliyor" → "geliyo"). Dil ucu titreşimi çalışılınca sözcük sonları netleşir.',
    steps: ['Dil ucunu üst damağa yaklaştır, güçlü hava ver: "rrrr" (dil ucu titresin).', 'Sonra hecelerde: tra-tre… dra-dre…', 'Sözcük sonlarındaki r\'yi özellikle vurgula: biR, vaR, geliyoR.'],
    lines: ['rrrrr… rrrrr… rrrrr…', 'tra tre trı tri tro trö tru trü', 'dra dre drı dri dro drö dru drü', 'biR · vaR · geliyoR · alıyoR · kadaR', 'kara kara kargalar kırk kere kırkıyor'],
    reps: 5,
    sec: 8
  },
  {
    id: 'damak',
    name: 'Damak ünsüzleri (K G)',
    emoji: '🎯',
    group: 'unsuz',
    short: 'Dilin arkası damağa vurarak ka-ke-kı-ki…, ga-ge-gı-gi…',
    why: 'K ve G dil sırtının yumuşak damağa net vurmasıyla çıkar; gevşek çıkınca "h"ye kayar.',
    steps: ['Dilin arka kısmını damağa yapıştırıp aniden bırak.', 'Ka-ke\'de ağız açık, ki-kü\'de dil daha önde: farkı hisset.'],
    lines: ['ka ke kı ki ko kö ku kü', 'ga ge gı gi go gö gu gü', 'kak kek kık kik kok kök kuk kük'],
    reps: 3,
    sec: 7
  },
  {
    id: 'islikli',
    name: 'Islıklı ünsüzler (S Z Ş J Ç C)',
    emoji: '🎐',
    group: 'unsuz',
    short: 'sa-se, za-ze, şa-şe, ja-je, ça-çe, ca-ce dizileri.',
    why: 'Islıklı sesler dişlerin ve dilin ince konumuna bağlıdır; peltek çıkışlar ("s" yerine "th") burada düzelir.',
    steps: ['S\'de dişler kapalıya yakın, dil ucu alt dişlerin arkasında; hava ince bir kanaldan çıksın.', 'Ş\'de dudaklar hafif öne, dil biraz geride.', 'Her diziyi net ve eşit hızda söyle.'],
    lines: ['sa se sı si so sö su sü', 'za ze zı zi zo zö zu zü', 'şa şe şı şi şo şö şu şü', 'ja je jı ji jo jö ju jü', 'ça çe çı çi ço çö çu çü', 'ca ce cı ci co cö cu cü'],
    reps: 6,
    sec: 7
  },

  // ---------------- TEKERLEMELER ----------------
  {
    id: 'tekerleme-1',
    name: 'Tekerleme: Berber',
    emoji: '💈',
    group: 'tekerleme',
    short: 'Bir berber bir berbere…',
    why: 'Tekerlemeler dudak, dil ve çeneyi hızlı ve doğru çalıştırır; tek seste takılmadan geçmeyi öğretir.',
    steps: ['Önce yavaş ve her sesi net söyleyerek oku.', 'Sonra hızlan; hata yapınca yeniden yavaşla.', 'Nefesi cümle başında al, ortada kesme.'],
    lines: ['Bir berber bir berbere "Gel beraber bir berber dükkânı açalım" demiş.'],
    reps: 3,
    sec: 8
  },
  {
    id: 'tekerleme-2',
    name: 'Tekerleme: Köşe',
    emoji: '🧊',
    group: 'tekerleme',
    short: 'Şu köşe yaz köşesi…',
    why: 'Ş ve S ayrımını, yayvan ve yuvarlak sesli geçişlerini çalıştırır.',
    steps: ['"Ş" ile "s"yi karıştırmadan, yavaştan hızlıya.'],
    lines: ['Şu köşe yaz köşesi, şu köşe kış köşesi, ortada su şişesi.'],
    reps: 3,
    sec: 7
  },
  {
    id: 'tekerleme-3',
    name: 'Tekerleme: Kartal',
    emoji: '🦅',
    group: 'tekerleme',
    short: 'Kartal kalkar dal sarkar…',
    why: 'K, L, R ve dil ucu sesleri; sözcük sonlarındaki r\'leri yutmadan söylemeyi çalıştırır.',
    steps: ['Her sözcüğün sonundaki "r"yi bırakma.'],
    lines: ['Kartal kalkar dal sarkar, dal sarkar kartal kalkar.'],
    reps: 3,
    sec: 6
  },
  {
    id: 'tekerleme-4',
    name: 'Tekerleme: Pasaj',
    emoji: '🏬',
    group: 'tekerleme',
    short: 'Şemsipaşa Pasajı\'nda…',
    why: 'Ş-S-Z ıslıklıları ve ü-ü-e sesli geçişleri.',
    steps: ['Islıklı sesleri karıştırmadan, ağzı yeterince açarak.'],
    lines: ['Şemsipaşa Pasajı\'nda sesi büzüşesiceler.'],
    reps: 3,
    sec: 6
  },
  {
    id: 'tekerleme-5',
    name: 'Tekerleme: Hoşaf',
    emoji: '🥣',
    group: 'tekerleme',
    short: 'Üç tunç tas has hoşaf.',
    why: 'Kısa ama zor: ç-t-s-h art arda; her ünsüzü net çıkarmayı öğretir.',
    steps: ['Kısa; 5 kez art arda, hiç takılmadan söylemeye çalış.'],
    lines: ['Üç tunç tas has hoşaf.'],
    reps: 5,
    sec: 4
  },
  {
    id: 'tekerleme-6',
    name: 'Tekerleme: Takatuka',
    emoji: '🥁',
    group: 'tekerleme',
    short: 'Al bu takatukaları takatukacıya…',
    why: 'Uzun sözcüklerde nefes kontrolü ve hece netliği.',
    steps: ['Tek nefeste bitirmeye çalış; olmuyorsa virgülde nefes al.'],
    lines: ['Al bu takatukaları takatukacıya takatukalatmaya götür. Takatukacı takatukaları takatukalatmazsa takatukaları takatukacıdan takatukalatmadan geri getir.'],
    reps: 2,
    sec: 14
  },
  {
    id: 'tekerleme-7',
    name: 'Tekerleme: Yoğurt',
    emoji: '🥛',
    group: 'tekerleme',
    short: 'Bu yoğurdu sarımsaklasak da mı saklasak…',
    why: 'S-K-L dizileri ve soru tonlaması.',
    steps: ['Soru tonlamasını da ver: cümle sonu yükselsin.'],
    lines: ['Bu yoğurdu sarımsaklasak da mı saklasak, sarımsaklamasak da mı saklasak?'],
    reps: 3,
    sec: 8
  },
  {
    id: 'tekerleme-8',
    name: 'Tekerleme: Küp',
    emoji: '🏺',
    group: 'tekerleme',
    short: 'Kırk kırık küp, kırkının da kulpu kırık kara küp.',
    why: 'K ve R yoğun; dil sırtı ve dil ucu arasında hızlı geçiş.',
    steps: ['Her "k"yı damaktan net patlat, "r"leri titret.'],
    lines: ['Kırk kırık küp, kırkının da kulpu kırık kara küp.'],
    reps: 3,
    sec: 6
  },
  {
    id: 'tekerleme-9',
    name: 'Tekerleme: Değirmen',
    emoji: '🐕',
    group: 'tekerleme',
    short: 'Değirmene girdi köpek…',
    why: 'K-P-T patlayıcıları ve ritim.',
    steps: ['Ritmini koruyarak, her sözcüğü ayrı ayrı duyurarak.'],
    lines: ['Değirmene girdi köpek, değirmenci çaldı kötek; hem kepek yedi köpek, hem kötek yedi köpek.'],
    reps: 3,
    sec: 9
  },
  {
    id: 'tekerleme-10',
    name: 'Tekerleme: Çekoslovakya',
    emoji: '🗺️',
    group: 'tekerleme',
    short: 'Çekoslovakyalılaştıramadıklarımızdan mısınız?',
    why: 'Tek uzun sözcükte hece hece netlik ve nefes.',
    steps: ['Önce hecelere bölerek: Çe-kos-lo-vak-ya-lı-laş-tı-ra-ma-dık-la-rı-mız-dan. Sonra bütün.'],
    lines: ['Çekoslovakyalılaştıramadıklarımızdan mısınız?', 'Ocak kıvılcımlandırıcılardan mısınız, kapı gıcırdatıcılardan mısınız?'],
    reps: 4,
    sec: 7
  },

  // ---------------- KALEM ----------------
  {
    id: 'kalem-okuma',
    name: 'Kalemle okuma',
    emoji: '✏️',
    group: 'kalem',
    short: 'Dişlerinin arasına yatay bir kalem al, paragrafı anlaşılır okumaya çalış; sonra kalemsiz oku.',
    why: 'Kalem çeneyi kilitler; anlaşılır olmak için dil ve dudaklar fazladan çalışmak zorunda kalır. Kalem çıkınca konuşma belirgin biçimde netleşir.',
    steps: [
      'Temiz bir kalemi yatay olarak azı dişlerinin arasına al (ısırma, hafif tut).',
      'Paragrafı sesli ve anlaşılır okumaya çalış; her sesi abartılı çıkar.',
      'Sonra kalemi çıkar, aynı paragrafı yeniden oku; farkı hisset.'
    ],
    lines: ['KALEMLE: ' + PARAGRAF_1, 'KALEMSİZ: ' + PARAGRAF_1, 'KALEMLE: ' + PARAGRAF_2, 'KALEMSİZ: ' + PARAGRAF_2],
    reps: 4,
    sec: 30,
    tip: 'Çene ağrırsa ara ver; günde 5 dakikadan fazla yapma.'
  },

  // ---------------- VURGU / TONLAMA / HIZ ----------------
  {
    id: 'vurgu',
    name: 'Vurgu değiştirme',
    emoji: '🎯',
    group: 'vurgu',
    short: 'Aynı cümleyi her seferinde başka sözcüğü vurgulayarak söyle.',
    why: 'Vurgu anlamı değiştirir. Hangi sözcüğü öne çıkardığını bilinçli seçmek konuşmayı canlı ve anlaşılır kılar.',
    steps: ['Büyük yazılan sözcüğü daha gür, biraz daha uzun ve hafif yüksek perdeden söyle.', 'Diğer sözcükler normal kalsın.'],
    lines: [
      'BEN yarın sabah İzmir\'e gidiyorum.',
      'Ben YARIN sabah İzmir\'e gidiyorum.',
      'Ben yarın SABAH İzmir\'e gidiyorum.',
      'Ben yarın sabah İZMİR\'E gidiyorum.',
      'Ben yarın sabah İzmir\'e GİDİYORUM.'
    ],
    reps: 5,
    sec: 5
  },
  {
    id: 'tonlama',
    name: 'Tonlama',
    emoji: '🎭',
    group: 'vurgu',
    short: 'Aynı sözcüğü soru, ünlem, sevinç, şaşkınlık ve üzüntüyle söyle.',
    why: 'Ses perdesinin iniş çıkışı duyguyu taşır; tekdüze konuşma dinleyiciyi yorar.',
    steps: ['Her satırdaki duyguyu yüzünle de yaşayarak söyle; ses kendiliğinden değişir.'],
    lines: ['Geldin mi? (soru — sonu yükselsin)', 'Geldin! (sevinç — canlı, yüksek)', 'Geldin… (üzüntü — alçak, yavaş)', 'Geldin?! (şaşkınlık — ani yükseliş)', 'Geldin. (düz bildirme — sonu düşsün)'],
    reps: 5,
    sec: 4
  },
  {
    id: 'hiz',
    name: 'Hız kontrolü',
    emoji: '⏩',
    group: 'vurgu',
    short: 'Aynı paragrafı yavaş, normal ve hızlı oku; her hızda netlik korunsun.',
    why: 'Heyecanlanınca hızlanmak sesleri yutturur. Farklı hızlarda netliği korumak, günlük konuşmada kontrol sağlar.',
    steps: ['YAVAŞ: her sözcüğü ayrı ayrı, abartılı net.', 'NORMAL: doğal konuşma hızı, noktalama işaretlerinde dur.', 'HIZLI: hızlan ama tek bir ses bile yutulmasın; yutulursa yeniden yavaşla.'],
    lines: ['YAVAŞ: ' + PARAGRAF_2, 'NORMAL: ' + PARAGRAF_2, 'HIZLI: ' + PARAGRAF_2],
    reps: 3,
    sec: 25
  }
]


export function findDExercise(id: string): DExercise | undefined {
  return DEXERCISES.find((e) => e.id === id)
}

// Varsayilan diksiyon seansi: her gruptan makul bir secki (hepsi ~15 dk surer).
// Kullanici Ayarlar'dan acip kapatabilir.
export const DEFAULT_DISABLED_D = ['uzun-s', 'dis-dudak', 'damak', 'tekerleme-4', 'tekerleme-6', 'tekerleme-8', 'tekerleme-9', 'tekerleme-10', 'hiz']

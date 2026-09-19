// Vokal kord (ses teli) ADDUKSIYON egzersizleri: ses tellerinin birbirine
// tam kapanmasini (glottal kapanma) guclendirmeye yonelik, ses terapisinde
// yaygin kullanilan teknikler. Her egzersiz; ne oldugu, neden yapildigi,
// adim adim nasil yapilacagi, soylenecek ses ve varsayilan tekrar/sure ile
// tanimlanir. Kullanici Ayarlar'dan egzersizleri acip kapatabilir.
//
// KAYNAKLAR (src/ses/lib/sources.ts'te baglantilariyla): tek tarafli ses teli
// felci icin "eklektik" protokol (Delphi, 2025: oksuruk-fonasyon, yarim
// yutkunma bum, Vokal Fonksiyon Egzersizleri, karin nefesi); erken donem
// fonasyonsuz adduksiyon egzersizleri RCT (J Voice 2025); Stemple VFE (gunde
// 2 kez, her egzersiz 2 kez, 6-8 hafta); PhoRTE (gur "a", gur kaydirma, gur
// ifadeler yuksek/alcak perde); yari kapali ses yolu (pipet) derlemeleri.
// Itme/cekme (Froeschels) klasik adduksiyon teknigidir ama literatur
// supraglottik asiri zorlanma (hiperfonksiyon) riskine dikkat ceker; bu
// yuzden VARSAYILAN KAPALI gelir, terapist onerdiyse acilir.
//
// UYARI: Bu icerik genel bilgi amaclidir; KBB hekimi / dil ve konusma
// terapistinin degerlendirmesinin YERINE GECMEZ. Uygulama icinde de bu uyari
// gosterilir ve ilk acilista onaylatilir.

export type Group = 'isinma' | 'ana' | 'sogutma'

// tekrar : her tekrarda "tut" suresi kadar ses cikarilir, sonra dinlenilir
// sure   : tek parca, verilen sure boyunca surdurulur (ornegin mirildanma)
// mpt    : en uzun "a" tutma; mikrofonla olculur ya da elle kronometre
export type Mode = 'tekrar' | 'sure' | 'mpt'

export interface Exercise {
  id: string
  name: string
  emoji: string
  group: Group
  mode: Mode
  short: string // bir cumlelik ozet (listede)
  why: string // neden yapilir
  steps: string[] // nasil yapilir
  cue: string | string[] // ekranda buyuk yazilan "simdi soyle" ifadesi (dizi ise tekrarda sirayla)
  reps: number // tekrar sayisi (mode=sure icin set sayisi)
  hold: number // saniye: tutma suresi (mpt'de kullanilmaz)
  rest: number // saniye: tekrarlar arasi dinlenme
  caution?: string // bu egzersize ozel dikkat
}

export const EXERCISES: Exercise[] = [
  // ---------------- ISINMA ----------------
  {
    id: 'karin-nefesi',
    name: 'Karın nefesi',
    emoji: '🫁',
    group: 'isinma',
    mode: 'sure',
    short: 'Elin karnında: burnundan 4 sayarak al, "sss" ile 8 sayarak ver.',
    why: 'Ses telleri için ilk güç nefestir. Karından (diyaframdan) destek, boğazı sıkmadan gür ses üretmeyi sağlar; tek taraflı ses teli felci protokollerinin standart parçasıdır.',
    steps: [
      'Dik otur; bir elini karnına koy, omuzların kalkmasın.',
      'Burnundan 4 sayarak nefes al; karnın elini itsin.',
      'Dişlerinin arasından "sssss" diyerek 8 sayarak eşit ve kontrollü ver.',
      'Süre dolana kadar yinele.'
    ],
    cue: 'AL (4) · VER "sss" (8)',
    reps: 3,
    hold: 12,
    rest: 3
  },
  {
    id: 'dudak-tril',
    name: 'Dudak titretme',
    emoji: '💨',
    group: 'isinma',
    mode: 'sure',
    short: 'Dudakları "brrr" diye titreterek ses tellerini ısıt.',
    why: 'Ses tellerini zorlamadan ısıtır, nefes ile sesi bağlar; ana egzersizlere hazırlar.',
    steps: [
      'Rahat otur, omuzlarını gevşet.',
      'Burnundan derin bir nefes al.',
      'Dudaklarını gevşek bırak, hava üfleyerek "brrr" diye titret; aynı anda rahat bir sesle mırıldan.',
      'Süre dolana kadar sürdür, nefesin bitince yeniden al.'
    ],
    cue: 'brrr…',
    reps: 3,
    hold: 10,
    rest: 5
  },
  {
    id: 'mirildanma',
    name: 'Mırıldanma (mmm)',
    emoji: '🎵',
    group: 'isinma',
    mode: 'sure',
    short: 'Dudaklar kapalı, rahat bir "mmm" sesi.',
    why: 'Sesi öne, dudaklara odaklar; boğazı sıkmadan ses üretmeyi hatırlatır.',
    steps: [
      'Dudakların kapalı, dişlerin hafif aralık olsun.',
      'Rahat, orta bir perdede "mmm" de; dudaklarında karıncalanma hisset.',
      'Boğazını sıkma, ses yumuşak olsun.'
    ],
    cue: 'mmm…',
    reps: 3,
    hold: 8,
    rest: 4
  },

  // ---------------- ANA (ADDUKSIYON) ----------------
  {
    id: 'itme',
    name: 'İtme ile "A!"',
    emoji: '🙌',
    group: 'ana',
    mode: 'tekrar',
    short: 'Avuçlarını göğüs hizasında birbirine bastırırken kısa, sert bir "A!" de.',
    why: 'İtme sırasında ses telleri refleks olarak sıkıca kapanır; bu kapanmayı sesle eşleştirmek addüksiyonu güçlendirir (itme–çekme tekniği).',
    steps: [
      'Otur; avuçlarını göğüs hizasında birbirine yasla.',
      'Nefes al. Avuçlarını kuvvetle birbirine bastırırken aynı anda kısa ve sert bir "A!" de.',
      'Bastırmayı bırak, gevşe, normal nefes al.',
      'Alternatif: sandalyenin oturağını iki yandan tutup yukarı çekerken ya da masaya bastırırken de yapılabilir.'
    ],
    cue: 'A!',
    reps: 8,
    hold: 2,
    rest: 3,
    caution: 'Klasik ama ZORLAYICI bir teknik; bu yüzden varsayılan olarak kapalıdır, terapistin önerdiyse Ayarlar\'dan aç. Sesi bulmaya çalışırken boğazın üst kısmını sıkma, ince/falsetto sese kaçma; ses kaba ve boğuk çıkıyorsa daha az güçle yap. Itme sırasında kan basıncı geçici yükselir: tansiyon, kalp, glokom ya da fıtık varsa önce hekimine sor. Baş dönmesi olursa dur.'
  },
  {
    id: 'cekme',
    name: 'Çekme ile "A!"',
    emoji: '🤝',
    group: 'ana',
    mode: 'tekrar',
    short: 'Parmaklarını kenetleyip dışa doğru çekerken "A!" de.',
    why: 'İtme egzersiziyle aynı ilke: kol kaslarının ani gerilmesi ses tellerini kapatır; ses bu ana denk getirilir.',
    steps: [
      'Ellerinin parmaklarını göğüs hizasında birbirine kenetle.',
      'Nefes al. Kollarını dışa doğru kuvvetle çekerken kısa ve sert "A!" de.',
      'Bırak, omuzlarını gevşet, nefes al.'
    ],
    cue: 'A!',
    reps: 8,
    hold: 2,
    rest: 3,
    caution: 'İtme egzersizindeki uyarılar bunun için de geçerlidir: varsayılan kapalıdır, terapist önerdiyse aç; boğazın üstünü sıkmadan, az güçle.'
  },
  {
    id: 'sert-baslangic',
    name: 'Sert başlangıçlı sesli harfler',
    emoji: '⚡',
    group: 'ana',
    mode: 'tekrar',
    short: 'Nefesi bir an tut, sonra sesli harfi "patlatarak" başlat.',
    why: 'Sert (glottal) başlangıç, ses tellerinin ses başlamadan önce tam kapanmasını gerektirir; erken dönem ses teli felcinde en sık kullanılan ve kapanmayı iyileştirdiği gösterilen tekniklerden biridir.',
    steps: [
      'Nefes al ve bir an tut (boğazını kapatmış gibi hisset).',
      'Sonra sesli harfi ani ve net biçimde bırak: "A!" — sanki hafifçe öksürür gibi başlıyor.',
      'Her tekrarda ekrandaki harfi söyle: A, E, İ, O, U.',
      'Ses kısa ve tok olsun; bağırma.'
    ],
    cue: ['A!', 'E!', 'İ!', 'O!', 'U!'],
    reps: 10,
    hold: 2,
    rest: 2,
    caution: 'Boğazda yanma ya da ağrı olursa hemen dur; bu teknik abartılırsa ses tellerini yorabilir.'
  },
  {
    id: 'oksuruk',
    name: 'Öksürükten sese',
    emoji: '😮‍💨',
    group: 'ana',
    mode: 'tekrar',
    short: 'Hafif bir öksürük/boğaz temizleme ile başla, aynı nefeste "aaa" diye uzat.',
    why: 'Öksürükte ses telleri tam kapanır; bu kapanmayı hemen seslendirmeye bağlamak güçlü bir addüksiyon alıştırmasıdır.',
    steps: [
      'Nefes al.',
      'Hafif, kontrollü bir öksürük ("öhö") yap ve DURMADAN aynı nefeste sesi uzat: "öhö-aaaa".',
      'Ses tok ve net çıksın; nefesli, fısıltı gibi olmasın.',
      'Dinlen, sonra tekrar.'
    ],
    cue: 'öhö-aaa',
    reps: 6,
    hold: 3,
    rest: 4,
    caution: 'Öksürük sert değil hafif olsun; boğazı tahriş etme.'
  },
  {
    id: 'yarim-yutkunma',
    name: 'Yarım yutkunma "bum"',
    emoji: '🫧',
    group: 'ana',
    mode: 'tekrar',
    short: 'Yutkunmaya başla, tam ortasında kuvvetli bir "bum" de.',
    why: 'Yutkunma sırasında gırtlak yükselir ve ses telleri sıkıca kapanır; "bum" sesi bu kapanma anında üretilir (half-swallow boom).',
    steps: [
      'Çeneni hafifçe göğsüne doğru indir.',
      'Yutkunmaya başla; tam ortasında, yutkunmayı bitirmeden kuvvetli ve kısa "BUM!" de.',
      'Gevşe, nefes al, tekrar.',
      'Bir tarafın zayıfsa terapistin başını o tarafa çevirerek yapmanı isteyebilir.'
    ],
    cue: 'BUM!',
    reps: 8,
    hold: 2,
    rest: 3
  },
  {
    id: 'bas-cevirme',
    name: 'Başı çevirerek "iii"',
    emoji: '↔️',
    group: 'ana',
    mode: 'tekrar',
    short: 'Başını sonuna kadar sağa/sola çevir, o konumda "iii" de.',
    why: 'Baş çevrilince gırtlak kısmen daralır ve zayıf taraftaki ses teli orta hatta yaklaşır; ses daha kolay ve tok çıkar.',
    steps: [
      'Otur, omuzlar sabit kalsın.',
      'Başını sonuna kadar SAĞA çevir; o konumda tok bir "iii" de.',
      'Sonraki tekrarda başını SOLA çevirip aynısını yap. Ekran hangi tarafı söyleyecek.',
      'Hangi tarafta ses daha net çıkıyorsa not al; terapistin bunu bilmek ister.'
    ],
    cue: ['SAĞA çevir: iii', 'SOLA çevir: iii'],
    reps: 8,
    hold: 3,
    rest: 3
  },
  {
    id: 'uzun-a',
    name: 'Uzun "A" tutma (ölçüm)',
    emoji: '⏱️',
    group: 'ana',
    mode: 'mpt',
    short: 'Derin nefes al, rahat bir "aaa" sesini bitene kadar tut; süre ölçülür.',
    why: 'En uzun ses tutma süresi (MPT), ses tellerinin ne kadar iyi kapandığının en basit göstergesidir ve tedavi etkisini izlemede geçerli bir ölçüttür. Yetişkinlerde kadınlar ~15-25 sn, erkekler ~25-35 sn; 10 sn altı konuşurken nefessiz kalmayla ilişkilidir.',
    steps: [
      'Burnundan olabildiğince derin nefes al.',
      'Rahat perdede, orta yükseklikte "aaaa" de ve sesin bitene kadar tut. Bağırma, sıkma.',
      'Mikrofon açıksa süre kendiliğinden ölçülür; değilse "Bitti" düğmesine bas.',
      'Üç deneme yap; en iyi süre kaydedilir.'
    ],
    cue: 'aaaa…',
    reps: 3,
    hold: 0,
    rest: 10
  },
  {
    id: 'vfe-i',
    name: 'VFE 1 · Yumuşak uzun "i"',
    emoji: '🎼',
    group: 'ana',
    mode: 'tekrar',
    short: 'Rahat bir notada, neredeyse duyulmayacak kadar yumuşak ama net bir "iii"yi olabildiğince uzun tut.',
    why: 'Vokal Fonksiyon Egzersizleri (Stemple) dört parçadır; ilki ısınma: az hava, net ses. Araştırmalar VFE ile ses tutma süresinin uzadığını ve glottal verimin arttığını gösteriyor. Günde 2 kez, 6-8 hafta önerilir.',
    steps: [
      'Nefes al. Rahat, orta bir notada "iii" de.',
      'Ses zar zor duyulacak kadar yumuşak ama NET olsun (nefesli/fısıltı değil).',
      'Sesi öne, dudaklara odakla; ağız "ters megafon" gibi (dudaklar hafif büzük).',
      'Bitene kadar tut; süreyi her hafta uzatmaya çalış.'
    ],
    cue: 'iiii… (yumuşak, net)',
    reps: 2,
    hold: 12,
    rest: 5
  },
  {
    id: 'perde-kaydirma',
    name: 'VFE 2-3 · Perde kaydırma "nol"',
    emoji: '🎢',
    group: 'ana',
    mode: 'tekrar',
    short: '"Nooool" diyerek en kalından en inceye, sonra en inceden en kalına kesintisiz kay.',
    why: 'Ses tellerini tüm uzunluk aralığında gerip gevşetir; kapanmayı tüm perdelerde düzenler (Vokal Fonksiyon Egzersizleri 2 ve 3).',
    steps: [
      'Nefes al.',
      '"Nooool" sözcüğüyle en kalın rahat perdeden en inceye yavaşça kay (siren gibi).',
      'Sonraki tekrarda inceden kalına in.',
      'Ses kopmadan, yumuşak ve kesintisiz kaysın; kopan yerleri zorlamadan geç.'
    ],
    cue: ['kalından İNCEYE: nooool', 'inceden KALINA: nooool'],
    reps: 4,
    hold: 6,
    rest: 3
  },
  {
    id: 'vfe-notalar',
    name: 'VFE 4 · Beş basamak "ol"',
    emoji: '🎹',
    group: 'ana',
    mode: 'tekrar',
    short: 'Beş ardışık notada (do-re-mi-fa-sol gibi) "ooool"u olabildiğince uzun tut.',
    why: 'Vokal Fonksiyon Egzersizlerinin dördüncü parçası: her notada uzun, yumuşak, net ses; kas dayanıklılığı ve nefes-ses eşgüdümü.',
    steps: [
      'Rahat kalın bir notadan başla (do gibi).',
      '"Ooool" diye yumuşak ve net, bitene kadar tut.',
      'Her tekrarda bir basamak yukarı çık: do, re, mi, fa, sol.',
      'Zorlanmadan; sesi öne, dudaklara odakla.'
    ],
    cue: ['1. nota: ooool', '2. nota: ooool', '3. nota: ooool', '4. nota: ooool', '5. nota: ooool'],
    reps: 5,
    hold: 10,
    rest: 4
  },
  {
    id: 'gur-a',
    name: 'Gür "A" (PhoRTE)',
    emoji: '📣',
    group: 'ana',
    mode: 'tekrar',
    short: 'Enerjik, gür bir "aaa"yı olabildiğince uzun tut; sonra gür sesle kalından inceye kay.',
    why: 'Yüksek yoğunluklu ses egzersizi (PhoRTE/LSVT ilkesi): gür ses, ses tellerinin daha sıkı kapanmasını gerektirir. Yaşa bağlı ses teli zayıflığında (presbifoni) çalışmalarda ses yükünü azalttığı ve yaşam kalitesini artırdığı gösterilmiştir.',
    steps: [
      'Nefes al; karnından destekle.',
      'Gür, enerjik, "güçlü" bir "aaaa" — bağırmadan, boğazı sıkmadan. Bitene kadar tut.',
      'Sonraki tekrarda aynı gür sesle kalından inceye, sonra inceden kalına kay.',
      'Hedef: normal konuşmandan belirgin daha gür; ses kısılmadan.'
    ],
    cue: ['GÜR: aaaa…', 'GÜR kalından inceye: aaaa', 'GÜR inceden kalına: aaaa'],
    reps: 3,
    hold: 8,
    rest: 5,
    caution: 'Gür ses = bağırmak değil. Ses kısılıyor ya da acıyorsa daha az güçle yap.'
  },
  {
    id: 'gur-ifadeler',
    name: 'Gür ifadeler (yüksek / alçak)',
    emoji: '🗣️',
    group: 'ana',
    mode: 'tekrar',
    short: 'Günlük cümleleri önce bahçe çitinin ötesine seslenir gibi yüksek perdeden, sonra otoriter alçak perdeden gür söyle.',
    why: 'PhoRTE\'nin 3. ve 4. parçası: gür sesi günlük konuşmaya taşır. Aynı cümle iki perdede söylenince ses telleri farklı uzunluklarda güçlü kapanmaya alışır.',
    steps: [
      'Nefes al; karından destek.',
      'Ekrandaki cümleyi "çitin ötesindeki komşuya seslenir gibi" YÜKSEK perdeden ve gür söyle.',
      'Sonraki tekrarda aynı cümleyi ALÇAK, otoriter, güçlü bir sesle söyle.',
      'Boğazını sıkma; gücü nefesten al.'
    ],
    cue: ['YÜKSEK: "Günaydın, nasılsın?"', 'ALÇAK: "Günaydın, nasılsın?"', 'YÜKSEK: "Kapıyı kapatır mısın?"', 'ALÇAK: "Kapıyı kapatır mısın?"', 'YÜKSEK: "Bugün hava çok güzel."', 'ALÇAK: "Bugün hava çok güzel."'],
    reps: 6,
    hold: 4,
    rest: 3,
    caution: 'Gür ses = bağırmak değil. Ses kısılıyor ya da acıyorsa daha az güçle yap.'
  },

  {
    id: 'su-direnci',
    name: 'Suda tüp fonasyonu (Lax Vox)',
    emoji: '🫧',
    group: 'ana',
    mode: 'sure',
    short: 'Silikon tüpün ucu 1-2 cm suda; tüpten "uuu" diye ses ver, kabarcıklar düzenli çıksın.',
    why: 'Su direnci terapisi: sudaki tüp, ses tellerinin üstünde düzenli bir geri basınç ve titreşim yaratır; ses telleri daha az güçle, daha tam kapanarak titreşir. 2024\'te tek taraflı ses teli felcinde yoğun su direnci programı, Vokal Fonksiyon Egzersizleriyle benzer olumlu sonuç verdi; 2025 çalışmaları tüm yarı kapalı ses yolu egzersizlerinin ses bozukluklarında etkili olduğunu gösteriyor.',
    steps: [
      'Gereç: 30-35 cm uzunluğunda, ~1 cm çapında silikon tüp (eczane/akvaryum hortumu) ve yarıya kadar su dolu bir şişe. Tüp yoksa kalın pipetle kuru yap.',
      'Tüpün ucunu suya 1-2 cm batır (derinlik arttıkça direnç artar; 2 cm\'yi geçme).',
      'Dudaklarını tüpe kapat; rahat perdede "uuu" diye ses ver. Kabarcıklar DÜZENLİ ve yumuşak çıksın; yanaklar şişmesin, boğaz sıkılmasın.',
      'Süre dolana kadar sürdür; ikinci sette perdeyi hafifçe aşağı-yukarı kaydır, üçüncü sette kısa cümleler mırıldan.'
    ],
    cue: ['uuu… (kabarcıklar düzenli)', 'uuu… kalından inceye ve geri', 'tüpten "merhaba, nasılsın" mırıldan'],
    reps: 3,
    hold: 20,
    rest: 8,
    caution: 'Su yutma riskine karşı oturarak yap. Baş dönmesi olursa dur. Tüpü her kullanımdan sonra yıka.'
  },

  // ---------------- SOGUTMA ----------------
  {
    id: 'pipet',
    name: 'Pipetle ses (soğutma / mola)',
    emoji: '🥤',
    group: 'sogutma',
    mode: 'sure',
    short: 'Bir pipetten "uuu" diye ses ver; ses tellerini dinlendirir. Gün içinde 2 dakikalık "mola" olarak da yapılır.',
    why: 'Yarı kapalı ses yolu (pipet) egzersizleri: ağızdaki daralma geri basınç yaratır, ses telleri daha az güçle ve daha tam kapanarak titreşir. Derlemeler ses bozukluklarında akustik ölçümleri ve glottal verimi iyileştirdiğini gösteriyor; kısa ve sık (günde birkaç kez 1-3 dk) yapılabilir.',
    steps: [
      'Bir pipeti dudaklarının arasına al (yoksa dudaklarını küçük bir "u" yapıp üfle).',
      'Rahat perdede, pipetten "uuu" diye ses ver; yanaklar şişmesin.',
      'İstersen perdeyi hafifçe aşağı yukarı kaydır.'
    ],
    cue: 'uuu… (pipetten)',
    reps: 2,
    hold: 15,
    rest: 5
  }
]

export const GROUP_LABEL: Record<Group, string> = {
  isinma: 'Isınma',
  ana: 'Addüksiyon egzersizleri',
  sogutma: 'Soğutma'
}

export function findExercise(id: string): Exercise | undefined {
  return EXERCISES.find((e) => e.id === id)
}

// Genel uyari metni (ilk acilista onaylatilir; Ayarlar'da da gorunur)
export const DISCLAIMER = [
  'Bu uygulama vokal kord (ses teli) addüksiyon egzersizlerini evde düzenli yapmana yardım eden bir rehberdir; tıbbi bir cihaz değildir.',
  'Egzersizlere bir KBB hekimi ya da dil ve konuşma terapisti önerdiyse başla. Hangi egzersizlerin sana uygun olduğunu onlar belirler; Ayarlar\'dan uygun olmayanları kapat.',
  'Boğazda ağrı, yanma, ses kısıklığında artış, baş dönmesi ya da nefes darlığı olursa hemen dur ve hekimine haber ver.',
  'İtme/çekme egzersizleri kan basıncını geçici yükseltir: tansiyon, kalp, göz tansiyonu ya da fıtık sorunun varsa önce hekimine sor.',
  'Araştırmalarda etkili bulunan doz: GÜNDE 2 SEANS (sabah/akşam), 6-8 HAFTA düzenli. Her seans 10-15 dk. Sesin yorulursa o gün daha azını yap.',
  'İtme/çekme egzersizleri klasik ama zorlayıcıdır ve boğazın üstünü sıkma alışkanlığına yol açabilir; bu yüzden kapalı gelir. Terapistin önerdiyse Ayarlar\'dan aç.'
]

// Varsayilan KAPALI adduksiyon egzersizleri (bkz. ustteki kaynak notu)
export const DEFAULT_DISABLED = ['itme', 'cekme']

// KANITA DAYALI PROGRAM ON AYARLARI. Literatur iki tabloyu ayirir:
//  - felc: tek tarafli ses teli felci / zayif kapanma (erken donem, <3-4 ay):
//    2025 eklektik protokol (oksuruk-fonasyon, bum, VFE, karin nefesi) +
//    sert baslangic + su direnci/SOVT. Gur ses egzersizleri sonra eklenir.
//  - presbifoni: yasa bagli ses teli incelmesi / ses zayifligi: PhoRTE (gur
//    ses) + VFE + SOVT; zorlayici kapanma teknikleri gereksiz.
//  - genel: hepsi acik (itme/cekme haric).
export type Program = 'genel' | 'felc' | 'presbifoni'
export const PROGRAM_LABEL: Record<Program, string> = {
  genel: 'Genel (tümü)',
  felc: 'Ses teli felci / zayıf kapanma',
  presbifoni: 'Yaşa bağlı ses zayıflığı'
}
export const PROGRAM_SHORT: Record<Program, string> = {
  genel: 'Genel program',
  felc: 'Ses teli felci programı',
  presbifoni: 'Yaşa bağlı zayıflık programı'
}
export const PROGRAM_DESC: Record<Program, string> = {
  genel: 'İtme/çekme dışında tüm egzersizler. Terapistinin verdiği listeye göre kendin düzenle.',
  felc: 'Tek taraflı ses teli felci, felç sonrası zayıf kapanma, nefesli ses. 2025 uzman uzlaşısı protokolü: karın nefesi, öksürükten sese, yarım yutkunma "bum", Vokal Fonksiyon Egzersizleri + sert başlangıç, baş çevirme, suda tüp. Gür ses egzersizleri ilk haftalarda kapalı.',
  presbifoni: 'Yaşla incelen ses telleri, güçsüz/nefesli ses, konuşurken yorulma. Kanıtı en güçlü ikili: PhoRTE (gür ses) + Vokal Fonksiyon Egzersizleri, yanında suda tüp/pipet. Zorlayıcı kapanma teknikleri kapalı.'
}
// Her programda KAPALI gelecek egzersizler
export const PROGRAM_DISABLED: Record<Program, string[]> = {
  genel: ['itme', 'cekme'],
  felc: ['itme', 'cekme', 'gur-a', 'gur-ifadeler'],
  presbifoni: ['itme', 'cekme', 'sert-baslangic', 'oksuruk', 'yarim-yutkunma', 'bas-cevirme']
}

// Gunun ipucu (kucuk, gunluk degisen)
const TIPS = [
  'Egzersizden önce bir bardak su iç; ses telleri nemliyken daha rahat çalışır.',
  'Boğazını sıkmadan, gücü nefesten al: karnın şişsin, omuzlar kalkmasın.',
  'Fısıltıyla konuşmak ses tellerini dinlendirmez, aksine yorar. Normal ama az konuş.',
  'Boğaz temizleme alışkanlığı ses tellerini tahriş eder; onun yerine bir yudum su iç.',
  'Egzersiz günlerini seri hâline getir: aynı saatte, kısa ve düzenli.',
  'Sesin yorgunsa o gün yalnızca ısınma ve pipet egzersizini yap.',
  'En uzun "A" süreni her hafta ölç; sayının yavaş yavaş artması kapanmanın iyileştiğini gösterir.'
]

export function tipOfDay(dayNumber: number): string {
  return TIPS[((dayNumber % TIPS.length) + TIPS.length) % TIPS.length]
}

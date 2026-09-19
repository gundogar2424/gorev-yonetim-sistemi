// Vokal kord (ses teli) ADDUKSIYON egzersizleri: ses tellerinin birbirine
// tam kapanmasini (glottal kapanma) guclendirmeye yonelik, ses terapisinde
// yaygin kullanilan teknikler. Her egzersiz; ne oldugu, neden yapildigi,
// adim adim nasil yapilacagi, soylenecek ses ve varsayilan tekrar/sure ile
// tanimlanir. Kullanici Ayarlar'dan egzersizleri acip kapatabilir.
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
    caution: 'Itme/çekme sırasında kan basıncı geçici olarak yükselir. Tansiyon, kalp, göz tansiyonu (glokom) ya da fıtık sorunun varsa önce hekimine sor. Baş dönmesi olursa dur.'
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
    caution: 'İtme egzersizindeki uyarılar bunun için de geçerlidir.'
  },
  {
    id: 'sert-baslangic',
    name: 'Sert başlangıçlı sesli harfler',
    emoji: '⚡',
    group: 'ana',
    mode: 'tekrar',
    short: 'Nefesi bir an tut, sonra sesli harfi "patlatarak" başlat.',
    why: 'Sert (glottal) başlangıç, ses tellerinin ses başlamadan önce tam kapanmasını gerektirir; kapanma refleksini eğitir.',
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
    why: 'En uzun ses tutma süresi (MPT), ses tellerinin ne kadar iyi kapandığının en basit göstergesidir. Süre uzadıkça kapanma iyileşiyor demektir.',
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
    id: 'perde-kaydirma',
    name: 'Perde kaydırma (glide)',
    emoji: '🎢',
    group: 'ana',
    mode: 'tekrar',
    short: 'Kalından inceye, sonra inceden kalına kayan bir "ooo".',
    why: 'Ses tellerini tüm uzunluk aralığında gerip gevşetir; kapanmayı tüm perdelerde düzenler (Vokal Fonksiyon Egzersizleri).',
    steps: [
      'Nefes al.',
      'En kalın rahat perdeden başlayıp "ooo" diyerek yavaşça en inceye kadar kay (siren gibi).',
      'Sonraki tekrarda inceden kalına in.',
      'Ses kopmadan, kesintisiz kaysın; kopan yerleri zorlamadan geç.'
    ],
    cue: ['kalından İNCEYE: ooo', 'inceden KALINA: ooo'],
    reps: 6,
    hold: 5,
    rest: 3
  },
  {
    id: 'yuksek-sayma',
    name: 'Yüksek sesle sayma',
    emoji: '📣',
    group: 'ana',
    mode: 'sure',
    short: 'Bir odanın karşısındaki birine seslenir gibi 1\'den 10\'a say.',
    why: 'Gür ses, ses tellerinin daha sıkı kapanmasını gerektirir; günlük konuşmaya taşınabilir bir güç sağlar.',
    steps: [
      'Nefes al; karnından destekle.',
      'Odanın karşısındaki birine seslenir gibi, net ve gür: "BİR, İKİ, ÜÇ… ON".',
      'Boğazını sıkma; gücü nefesten al. Süre bitene kadar başa dönüp say.'
    ],
    cue: 'BİR, İKİ, ÜÇ…',
    reps: 3,
    hold: 10,
    rest: 5,
    caution: 'Gür ses = bağırmak değil. Ses kısılıyor ya da acıyorsa daha az güçle yap.'
  },

  // ---------------- SOGUTMA ----------------
  {
    id: 'pipet',
    name: 'Pipetle ses (soğutma)',
    emoji: '🥤',
    group: 'sogutma',
    mode: 'sure',
    short: 'Bir pipetten "uuu" diye ses ver; ses tellerini dinlendirir.',
    why: 'Yarı kapalı ses yolu (pipet) ses tellerinin dengeli ve yumuşak titreşmesini sağlar; seansı gerginlik bırakmadan bitirir.',
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
  'Her seans kısa tutulur (10-15 dk). Günde 2-3 kısa seans, tek uzun seanstan iyidir. Sesin yorulursa o gün daha azını yap.'
]

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

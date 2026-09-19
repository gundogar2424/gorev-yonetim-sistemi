// Uygulama iceriginin dayandigi kaynaklar (Ayarlar > Kaynaklar ve README).
// Baglantilar acik erisimli ozet/abstract sayfalaridir.
export interface Source {
  title: string
  note: string // bu uygulamada neyi destekliyor
  url: string
}

export const SOURCES: Source[] = [
  {
    title: 'Effectiveness of Voice Therapy in Unilateral Vocal Fold Paralysis: Systematic Review and Meta-Analysis (J Voice, 2024)',
    note: 'Tek taraflı ses teli felcinde ses terapisi ses kalitesini ve işlevini iyileştirir (havuzlanmış kanıt).',
    url: 'https://pubmed.ncbi.nlm.nih.gov/39122575/'
  },
  {
    title: 'Two SOVT-Based Treatment Protocols in UVFP: Proof-of-Concept (J Voice, 2024)',
    note: 'Yoğun su direnci terapisi (tüp suda) ve VFE protokolleri; akut ve kronik felçte akustik, algısal ve öz bildirim ölçümlerinde olumlu etki. "Suda tüp fonasyonu" egzersizinin dayanağı.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/39395877/'
  },
  {
    title: 'Impact of SOVT Exercises on Multidimensional Measures of Voice in Dysphonia: RCT (J Voice, 2025)',
    note: 'Üç farklı yarı kapalı ses yolu egzersizi de tedavisiz gruba göre anlamlı iyileşme sağladı; fonasyon çabası (subglottik basınç, eşik basıncı) düşer.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/40451716/'
  },
  {
    title: 'Systematic Review of SLP Interventions for Presbyphonia (J Voice, 2024)',
    note: 'Yaşa bağlı ses zayıflığında ses terapisi: öz bildirim, aerodinamik, akustik ve uzman değerlendirmesinde ikna edici iyileşme. VFE ve PhoRTE en çok incelenen ikili; PhoRTE algılanan çabayı da azaltır.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/38195333/'
  },
  {
    title: 'Treating Presbyphonia in 2024: A Scoping Review (J Voice)',
    note: 'Önce ses terapisi; farklı egzersiz ve tekniklerin birleştirilmesi önerilir. Program ön ayarlarının mantığı.',
    url: 'https://www.jvoice.org/article/S0892-1997(24)00460-0/abstract'
  },
  {
    title: 'Effect of an iOS App on Voice Therapy Adherence and Motivation: RCT',
    note: 'Uygulama desteği ev egzersizi kaçırmayı yaklaşık yarıya indirir. Günlük hedef kartı ve hatırlatmaların dayanağı.',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8740599/'
  },
  {
    title: 'Speech therapy with or without transcutaneous electrical stimulation in vocal cord paralysis (J Thorac Dis, 2025)',
    note: 'Klinikte terapiye eklenen elektriksel uyarım kapanmayı daha çok iyileştirebilir; cihaz ve uzman gerektirir, uygulamada yok — terapistine sor.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/41229841/'
  },
  {
    title: 'Efficacy of an Eclectic Voice Therapy Protocol in Unilateral Vocal Fold Paralysis (J Voice, 2025)',
    note: 'Delphi ile seçilen 4 teknik: öksürük-fonasyon, yarım yutkunma "bum", Vokal Fonksiyon Egzersizleri, karın nefesi; 3 haftada algısal, akustik ve öz bildirim ölçümlerinde anlamlı iyileşme.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/41339132/'
  },
  {
    title: 'Early Voice Therapy Using Non-Phonatory Exercises in UVFP After Thyroidectomy: RCT (J Voice, 2025)',
    note: 'Felcin ilk haftasında sessiz (fonasyonsuz) addüksiyon egzersizleri kapanmayı destekler, fonasyon çabasını azaltır ve yanlış telafileri önleyebilir.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/40328557/'
  },
  {
    title: 'Efficacy of Voice Therapy for Early Unilateral Adductor Vocal Fold Paralysis (J Voice)',
    note: 'Sert glottal başlangıçla erken ses terapisi glottal kapanmayı ve ses işlevini iyileştirir; ilk 4 hafta içinde başlanması önerilir.',
    url: 'https://www.sciencedirect.com/science/article/abs/pii/S0892199716303952'
  },
  {
    title: 'Effects of Vocal Function Exercises: A Systematic Review (J Voice)',
    note: 'VFE (Stemple): normal ve bozuk seslerde, yaşa bağlı ses zayıflığında etkili; nesnel ölçümlerde hafif-orta, öz bildirimde orta-güçlü etki.',
    url: 'https://www.sciencedirect.com/science/article/abs/pii/S0892199716304465'
  },
  {
    title: 'Vocal function exercises for normal voice: the effects of varying dosage (PubMed)',
    note: 'Günde 2 kez, 6 hafta; doz arttıkça MPT daha çok uzuyor ama bırakma artıyor. Uygulamadaki "günde 2 seans" hedefinin dayanağı.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/28925286/'
  },
  {
    title: 'PhoRTE with and without EMST for Presbyphonia: Noninferiority RCT (J Voice, 2021)',
    note: 'Gür "a", gür perde kaydırma, gür ifadeler (yüksek/alçak perde): yaşa bağlı ses teli zayıflığında ses engellilik puanında anlamlı iyileşme.',
    url: 'https://www.jvoice.org/article/S0892-1997(21)00077-1/abstract'
  },
  {
    title: 'Semi-Occluded Vocal Tract Training With a Free-End Tube in Dysphonic Adults: Systematic Review (J Voice, 2025)',
    note: 'Pipet/tüp fonasyonu akustik ölçümleri ve glottal verimi iyileştirir; soğutma ve dengeleme için kullanıldı.',
    url: 'https://www.sciencedirect.com/science/article/abs/pii/S0892199725000086'
  },
  {
    title: 'The effect of head position on glottic closure in patients with UVFP (J Voice, 2003)',
    note: 'Başı çevirerek fonasyon: kapanmaya etkisi kişiden kişiye değişir; hangi tarafın iyi olduğunu terapistle belirlemek gerekir.',
    url: 'https://www.sciencedirect.com/science/article/abs/pii/S0892199703001437'
  },
  {
    title: 'The maximum phonation time as marker for voice treatment efficacy: network meta-analysis (Clin Otolaryngol, 2023)',
    note: 'MPT tedavi etkisini izlemede geçerli bir ölçüt.',
    url: 'https://onlinelibrary.wiley.com/doi/10.1111/coa.14019'
  },
  {
    title: 'Iowa Head and Neck Protocols: The Voice Clinic (2025)',
    note: 'MPT normal aralıkları: kadın ~15-25 sn, erkek ~25-35 sn; 10 sn altında konuşurken nefessiz kalma.',
    url: 'https://medicine.uiowa.edu/iowaprotocols/voice-clinic'
  },
  {
    title: 'Maximum Phonation Time in Healthy Older Adults (J Voice, 2011)',
    note: 'Yaşlılarda MPT: kadın 10-21 sn, erkek 13-23 sn; yaşla azalır. 12 sn altı yaşa bağlı ses zayıflığı olasılığını artırır.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/21439778/'
  },
  {
    title: 'Accuracy of Smartphone Recordings for Acoustic Voice Quality Assessment: Systematic Review and Meta-Analysis (AJSLP, 2025)',
    note: 'Telefon kayıtlarında perde ve jitter güvenilir; shimmer ve HNR klinik sistemden sapabilir. Uygulamadaki "eğilim için kullan" uyarısının dayanağı.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/41037430/'
  },
  {
    title: 'Validity of Acoustic Measures Obtained Using Smartphones With and Without Headset Microphones (JSLHR, 2024)',
    note: 'F0 ve jitter kayıt yöntemine dayanıklı; shimmer ve HNR kayıt yöntemine ve gürültüye duyarlı.',
    url: 'https://pubs.asha.org/doi/10.1044/2024_JSLHR-23-00759'
  },
  {
    title: 'Clinical Practice Guideline: Hoarseness (Dysphonia) Update (AAO-HNS, 2018)',
    note: 'Ses terapisiyle düzelebilecek nedenlerde ses terapisi önerilir; 4 haftayı aşan ses kısıklığında laringoskopi. Uygulama tıbbi değerlendirmenin yerine geçmez.',
    url: 'https://journals.sagepub.com/doi/10.1177/0194599817751030'
  }
]

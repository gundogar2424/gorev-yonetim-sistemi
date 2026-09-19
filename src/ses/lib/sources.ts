// Uygulama iceriginin dayandigi kaynaklar (Ayarlar > Kaynaklar ve README).
// Baglantilar acik erisimli ozet/abstract sayfalaridir.
export interface Source {
  title: string
  note: string // bu uygulamada neyi destekliyor
  url: string
}

export const SOURCES: Source[] = [
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

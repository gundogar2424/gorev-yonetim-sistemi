// Termomiks Defteri veri tipleri.
// Diyet Kocu ve CRM ile HICBIR tip/tablo paylasmaz; tamamen bagimsizdir.

// Cihaz devri. TM7'de: yumusak karistirma (kasik simgesi), 0.5, 1-10 ve Turbo.
// Bos dize = o adimda bicak donmuyor (orn. "kapagi kapat, 10 dk beklet").
export type TmSpeed = '' | 'yumusak' | '0.5' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'turbo'

// Sicaklik. Bos dize = isitma yok. 'varoma' = buhar kademesi.
// Sayilar derece cinsindendir; TM7'de 37-160 arasi kullanilir.
export type TmTemp = '' | 'varoma' | string

// TM7'nin ozel modlari. Bos dize = klasik (devir + sicaklik + sure) calisma.
export type TmMode =
  | ''
  | 'sote' // Kavurma / sote (yuksek sicaklik)
  | 'yavas' // Yavas pisirme
  | 'sousvide' // Sous-vide
  | 'ferment' // Fermente / mayalama
  | 'hamur' // Hamur yogurma
  | 'pirinc' // Pirinc modu
  | 'blender' // Yuksek devir blender / smoothie
  | 'tartim' // Tartim (dara)
  | 'buhar' // Varoma ile buharda pisirme
  | 'temizlik' // Kendi kendini temizleme

// Tarifin tek bir adimi. Termomiks tarifleri "ne kadar sure, kac devir, kac
// derece" ucgeni uzerine kuruludur; alanlar buna gore ayrilmistir.
export interface TmStep {
  text: string // Ne yapilacak (kisa cumle)
  ingredients: string // Bu adimda kaba giren malzemeler (bos olabilir)
  seconds: number // Sure (saniye). 0 = suresiz/elle yapilan adim
  speed: TmSpeed
  reverse: boolean // Ters yon (bicak tersine doner — malzeme dagilmasin)
  temp: TmTemp
  mode: TmMode
  tip: string // Kucuk ipucu / dikkat notu (bos olabilir)
}

export interface TmRecipe {
  id?: number
  title: string
  category: string // Corba, Ana Yemek, Tatli, Hamur Isi, Sos, Icecek, Kahvalti, Diger
  servings: number // Kac kisilik (0 = belirtilmemis)
  minutes: number // Toplam sure, dakika (0 = belirtilmemis)
  ingredients: string[] // "2 su bardagi un" gibi serbest satirlar
  steps: TmStep[]
  notes: string
  warnings: string[] // Donusumde dikkat edilecekler (kap dolulugu, sicaklik vb.)
  source: string // Nereden alindi (site adi / kisi / defter)
  video: string // Tarif videosunun adresi (https). Bos olabilir.
  originalText: string // Yapistirilan ORIJINAL tarif (karsilastirmak icin saklanir)
  origin: 'ai' | 'manual' // Hazir koddan mi geldi, elle mi yazildi
  photo: string // Tarif fotografi (data URI). Bos olabilir.
  favorite: 0 | 1 // Dexie boolean'i indeksleyemez; 0/1 tutulur
  cookCount: number // Kac kez pisirildi
  lastCookedAt: number // Son pisirme zamani (0 = hic)
  createdAt: number
  updatedAt: number
}

export interface TmSettings {
  id?: number // Her zaman 1
  autoAdvance: boolean // Pisirme modunda sure bitince kendiliginden sonraki adima gec
  sound: boolean // Sure bitince sesli uyari + titresim (uygulama ondeyken)
  notify: boolean // Ekran kapaliyken/arka planda sistem bildirimiyle uyar
  keepAwake: boolean // Pisirirken ekran acik kalsin
  autoBackup: boolean // Acilista defteri telefona dosya olarak yaz
  lastAutoBackupAt: number // Son otomatik yedegin zamani (0 = hic)
  lastAutoBackupPath: string // Yazildigi yol (Ayarlar'da gosterilir)
  lastAutoBackupSig: string // Defterin o anki parmak izi (degismediyse yazma)
}

// Disaridan gelen (yapistirilan koddaki) ham tarif — kaydedilmeden once onizlenir
export interface TmConversion {
  title: string
  category: string
  servings: number
  minutes: number
  ingredients: string[]
  steps: TmStep[]
  notes: string
  warnings: string[]
  photo: string
  video: string
}

// Oyun listesi. Her oyun beynin farkli bir yetisini calistirir; gunluk plan
// bu listeden 3 oyun secer ve gunler icinde hepsini dolasir.
export type Skill = 'Hafıza' | 'Dikkat' | 'Hız' | 'Dil' | 'Hesap' | 'Mantık'

export interface GameInfo {
  id: string
  name: string
  skill: Skill
  emoji: string
  short: string // listede tek satir
  how: string // oyun basinda gosterilen kisa anlatim
  maxLevel: number
}

export const GAMES: readonly GameInfo[] = [
  {
    id: 'hafiza',
    name: 'Hafıza Kartları',
    skill: 'Hafıza',
    emoji: '🃏',
    short: 'Kapalı kartların eşini bul',
    how: 'Kartlar kapalı. İki kart aç; aynıysa açık kalır, değilse kapanır. Kartların yerini aklında tut ve hepsini eşleştir.',
    maxLevel: 8
  },
  {
    id: 'sira',
    name: 'Sıra Takibi',
    skill: 'Hafıza',
    emoji: '🎨',
    short: 'Yanan renkleri sırayla tekrarla',
    how: 'Renkler sırayla yanar. Sonra aynı sırayla sen dokun. Her turda dizi bir uzar. Dikkatle izle!',
    maxLevel: 8
  },
  {
    id: 'renk',
    name: 'Renk Tuzağı',
    skill: 'Dikkat',
    emoji: '🚦',
    short: 'Yazıya değil, mürekkep rengine bak',
    how: 'Ekranda bir renk adı yazar ama yazının kendi rengi farklı olabilir. Yazının RENGİNE göre doğru düğmeye bas. Yazılana kanma!',
    maxLevel: 8
  },
  {
    id: 'sayi',
    name: 'Sayı Avı',
    skill: 'Hız',
    emoji: '🔢',
    short: 'Sayılara 1’den başlayıp sırayla dokun',
    how: 'Karışık dizilmiş sayılar var. 1’den başla, sırayla hepsine dokun. Ne kadar hızlı, o kadar iyi.',
    maxLevel: 8
  },
  {
    id: 'harf',
    name: 'Karışık Harfler',
    skill: 'Dil',
    emoji: '🔤',
    short: 'Karışmış harflerden kelimeyi kur',
    how: 'Harfler karışmış. Doğru sırayla dokunarak kelimeyi oluştur. Takılırsan “İpucu” ilk harfi gösterir.',
    maxLevel: 8
  },
  {
    id: 'hesap',
    name: 'Zihinden Hesap',
    skill: 'Hesap',
    emoji: '🧮',
    short: 'Kâğıt kalemsiz hızlı işlem',
    how: 'Bir işlem sorulur, dört seçenek çıkar. Doğru sonuca dokun. Seviye yükseldikçe sayılar büyür.',
    maxLevel: 8
  },
  {
    id: 'kelime',
    name: 'Kelimeleri Hatırla',
    skill: 'Hafıza',
    emoji: '📝',
    short: 'Listeyi ezberle, sonra tanı',
    how: 'Önce kısa bir kelime listesi gösterilir; ezberle. Sonra tek tek kelimeler çıkar: “listede vardı” ya da “yoktu” de.',
    maxLevel: 8
  },
  {
    id: 'farkli',
    name: 'Farklı Olanı Bul',
    skill: 'Mantık',
    emoji: '🔍',
    short: 'Gruba uymayan tek şekli yakala',
    how: 'Ekrandaki şekillerden biri diğerlerinden farklı. Onu bul ve dokun. Seviye yükseldikçe fark incelir.',
    maxLevel: 8
  }
]

export function gameById(id: string | undefined): GameInfo | undefined {
  return GAMES.find((g) => g.id === id)
}

export const SKILL_COLORS: Record<Skill, string> = {
  Hafıza: 'bg-violet-100 text-violet-800',
  Dikkat: 'bg-amber-100 text-amber-800',
  Hız: 'bg-sky-100 text-sky-800',
  Dil: 'bg-emerald-100 text-emerald-800',
  Hesap: 'bg-rose-100 text-rose-800',
  Mantık: 'bg-teal-100 text-teal-800'
}

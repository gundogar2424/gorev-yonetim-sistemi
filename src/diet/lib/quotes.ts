// Gunluk motivasyon sozleri. Token harcamaz; her gun listeden biri secilir.
const QUOTES: string[] = [
  'Bugün küçük bir "hayır", yarın büyük bir "evet" demektir. 💪',
  'Diyet bir ceza değil, kendine verdiğin bir armağandır. 🎁',
  'Aç kalmıyorsun, seçimlerini düzeltiyorsun. 🥗',
  'Bir öğün her şeyi bozmaz, bir öğün her şeyi de düzeltmez. Devamlılık kazanır. 🔁',
  'Canın çekti diye zayıf değilsin; durabildiğin için güçlüsün. 🛑',
  'Su iç, derin nefes al, biraz yürü — istek geçer, gurur kalır. 🌊',
  'Bugünün emeği, aynadaki yarının gülümsemesi. 😊',
  'Tartı bir gün gösterir, alışkanlık bir ömür. ⚖️',
  'Mükemmel olmana gerek yok, sadece pes etme. 🌱',
  'Her sağlıklı seçim, kendine "değerlisin" demektir. ❤️',
  'Dün ne olduğu önemli değil; bugün ne yiyeceğin senin elinde. 🌅',
  'Açlık bir dalgadır; binersen geçer, kovalarsan büyür. 🏄',
  'Küçük adımlar da seni hedefe götürür, durduğun yere değil. 👟',
  'Kendine sabret; sevdiğin biriyle konuşur gibi konuş. 🤍',
  'Bugün direndiğin şey, yarın hiç özlemeyeceğin şeydir. ✨'
]

// Verilen tarihe (YYYY-MM-DD) gore sabit bir soz dondurur (gun boyu degismez)
export function quoteOfDay(dateStr: string): string {
  let sum = 0
  for (let i = 0; i < dateStr.length; i++) sum += dateStr.charCodeAt(i)
  return QUOTES[sum % QUOTES.length]
}

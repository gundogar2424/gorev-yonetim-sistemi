// Gunun ipucu: beyin sagligi icin arastirmalarla desteklenen, uygulanabilir
// oneriler. (Lancet Demans Komisyonu 2020/2024 raporlarindaki degistirilebilir
// risk etkenlerinden yola cikilarak sade dille yazildi.) Tibbi tavsiye degildir.
export const TIPS: string[] = [
  'Günde 30 dakika tempolu yürüyüş, beyne giden kan akışını artırır. Zihin oyunları kadar bedeni çalıştırmak da önemli.',
  'Tansiyonunu düzenli ölçtür. Orta yaşta kontrolsüz yüksek tansiyon, ileri yaşta unutkanlık riskini artıran etkenlerden biri.',
  'Her gece 7-8 saat uyku. Beyin gün içindeki atıkları uykuda temizler.',
  'Bugün bir arkadaşını ya da akrabanı ara. Sosyal bağlar zihni canlı tutar; yalnızlık risk etkenidir.',
  'İşitme kaybı varsa ertelemeden işitme cihazı kullan. İşitmeyi düzeltmek, önlenebilir risk etkenlerinin en büyüklerinden.',
  'Yeni bir şey öğren: bir tarif, bir şarkı, birkaç yabancı kelime. Yenilik, beyinde yeni bağlantılar kurdurur.',
  'Zeytinyağı, sebze, balık, baklagil ve ceviz ağırlıklı Akdeniz tipi beslenme beyin sağlığıyla ilişkilendirilmiştir.',
  'Sigara içiyorsan bırakmak için geç değil. Bırakanlarda risk zamanla içmeyenlere yaklaşır.',
  'Bulmaca, okuma, satranç, el işi… Zihni zorlayan uğraşlar “bilişsel rezerv” biriktirir.',
  'Kan şekerini takip et. Diyabet kontrol altındaysa beyin damarları da korunur.',
  'Gözlük numaran güncel mi? Görme kaybını düzeltmek de zihinsel sağlığa katkı sağlar.',
  'Alkolü sınırlı tut; haftada 14 birimden fazlası beyin için zararlı kabul edilir.',
  'Düşmelerden korun: evde halı kenarlarını sabitle, iyi aydınlat. Kafa travması bir risk etkenidir.',
  'Uzun süre oturma. Her saat başı kalkıp birkaç dakika dolaş.',
  'Bugün oyunları yaparken zorlanıyorsan iyi haber: beyin zorlandığında gelişir. Kolay gelen egzersiz az işe yarar.'
]

export function tipOfDay(dayNo: number): string {
  return TIPS[((dayNo % TIPS.length) + TIPS.length) % TIPS.length]
}

import { Link } from 'react-router-dom'
import DietHeader from '../DietHeader'

const links = [
  { to: '/beni-tani', icon: '🧠', title: 'Beni Tanı & İçgörü', desc: 'Yapay zekanın seni tanıyan profili + haftalık kişisel içgörü' },
  { to: '/takip?tab=saglik', icon: '🩺', title: 'Şeker & Tansiyon', desc: 'Kan şekeri ve tansiyon kaydı + grafikler' },
  { to: '/menu', icon: '🍽️', title: 'Menüm', desc: 'Diyet listene sor (öğlen ne var?) ve sohbetle düzelt' },
  { to: '/oneri', icon: '🍳', title: 'Ne Yesem?', desc: 'Sofranın/elindeki ürünlerin fotoğrafını çek, sana uygunları gramajıyla önersin' },
  { to: '/disarida', icon: '🍽️', title: 'Dışarıda / Restoran', desc: 'Menü fotoğrafını ya da kare kodu (QR) yükle, diyetine uygununu bul' },
  { to: '/fotograf', icon: '📸', title: 'Önce - Sonra', desc: 'İlerleme fotoğrafları, yan yana karşılaştırma' },
  { to: '/ozet', icon: '📊', title: 'Özet Rapor', desc: 'Son 7/14/30 günün genel durumu' },
  { to: '/egzersiz', icon: '🏃', title: 'Egzersiz', desc: 'Yaptığın egzersizi yaz, puan ve rozet kazan' },
  { to: '/hatirlaticilar', icon: '🔔', title: 'Hatırlatıcılar', desc: 'Öğün saatlerinde bildirim (APK)' },
  { to: '/tahliller', icon: '📄', title: 'Tahliller', desc: 'Foto/PDF yükle, hafızada tut, yorumlat' },
  { to: '/checkup', icon: '🩺', title: 'Sağlık Check-up', desc: 'Tüm verilerini hekim gibi yorumlar, sağlık sorularını yanıtlar' },
  { to: '/alisveris', icon: '🛒', title: 'Alışveriş Listesi', desc: 'Sağlıklı alışveriş listeni oluştur' }
]

export default function More() {
  return (
    <div>
      <DietHeader title="Daha Fazla" />
      <div className="p-3 space-y-3">
        {links.map((l) => (
          <Link key={l.to} to={l.to} className="card p-4 flex items-center gap-4 active:scale-[0.98] transition">
            <div className="text-3xl">{l.icon}</div>
            <div className="flex-1">
              <h2 className="font-bold text-slate-800">{l.title}</h2>
              <p className="text-xs text-slate-500">{l.desc}</p>
            </div>
            <span className="text-slate-300 text-2xl">›</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

import { useState } from 'react'
import { Link } from 'react-router-dom'
import DietHeader from '../DietHeader'

type MoreLink = { to: string; icon: string; title: string; desc: string }

// Sık kullanılan (üstte, hep görünür) — kullanım alışkanlığına göre
const mainLinks: MoreLink[] = [
  { to: '/takip?tab=saglik', icon: '🩺', title: 'Şeker & Tansiyon', desc: 'Kan şekeri ve tansiyon kaydı + grafikler' },
  { to: '/ilaclarim', icon: '💊', title: 'İlaçlarım & Vitaminlerim', desc: 'İlaç/vitamin tanımla, hatırlat, işaretle; uyum raporu' },
  { to: '/egzersiz', icon: '🏃', title: 'Egzersiz', desc: 'Yaptığın egzersizi (adım, kalori…) kaydet, puan kazan' },
  { to: '/checkup', icon: '🩺', title: 'Sağlık Check-up', desc: 'Tüm verilerini hekim gibi yorumlar, sorularını yanıtlar' },
  { to: '/hatirlaticilar', icon: '🔔', title: 'Hatırlatıcılar', desc: 'Öğün/ilaç saatlerinde bildirim (APK)' }
]

// Daha az kullanılan (gizli başlar, "Diğer" ile açılır)
const moreLinks: MoreLink[] = [
  { to: '/beni-tani', icon: '🧠', title: 'Beni Tanı & İçgörü', desc: 'Seni tanıyan profil + haftalık kişisel içgörü' },
  { to: '/ozet', icon: '📊', title: 'Özet Rapor', desc: 'Son 7/14/30 günün genel durumu' },
  { to: '/tahliller', icon: '📄', title: 'Tahliller', desc: 'Foto/PDF yükle, hafızada tut, yorumlat' },
  { to: '/menu', icon: '🍽️', title: 'Menüm', desc: 'Diyet listene sor (öğlen ne var?) ve düzelt' },
  { to: '/oneri', icon: '🍳', title: 'Ne Yesem?', desc: 'Elindeki ürünlerin fotoğrafından uygun öğün önerisi' },
  { to: '/disarida', icon: '🍴', title: 'Dışarıda / Restoran', desc: 'Menü fotoğrafı/QR yükle, diyetine uygununu bul' },
  { to: '/fotograf', icon: '📸', title: 'Önce - Sonra', desc: 'İlerleme fotoğrafları, yan yana karşılaştırma' },
  { to: '/alisveris', icon: '🛒', title: 'Alışveriş Listesi', desc: 'Sağlıklı alışveriş listeni oluştur' }
]

function LinkCard({ l }: { l: MoreLink }) {
  return (
    <Link to={l.to} className="card p-4 flex items-center gap-4 active:scale-[0.98] transition">
      <div className="text-3xl">{l.icon}</div>
      <div className="flex-1">
        <h2 className="font-bold text-slate-800">{l.title}</h2>
        <p className="text-xs text-slate-500">{l.desc}</p>
      </div>
      <span className="text-slate-300 text-2xl">›</span>
    </Link>
  )
}

export default function More() {
  const [showMore, setShowMore] = useState(false)
  return (
    <div>
      <DietHeader title="Daha Fazla" />
      <div className="p-3 space-y-3">
        {mainLinks.map((l) => (
          <LinkCard key={l.to} l={l} />
        ))}

        <button
          onClick={() => setShowMore((v) => !v)}
          className="w-full text-sm font-semibold text-slate-500 bg-slate-100 rounded-xl py-2.5"
        >
          {showMore ? 'Diğer araçları gizle ▲' : `Diğer araçlar (${moreLinks.length}) ▼`}
        </button>

        {showMore && moreLinks.map((l) => <LinkCard key={l.to} l={l} />)}
      </div>
    </div>
  )
}

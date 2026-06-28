import { Link } from 'react-router-dom'
import DietHeader from '../DietHeader'

const links = [
  { to: '/hatirlaticilar', icon: '🔔', title: 'Hatırlatıcılar', desc: 'Öğün saatlerinde bildirim (APK)' },
  { to: '/tahliller', icon: '📄', title: 'Tahliller', desc: 'Foto/PDF yükle, hafızada tut, yorumlat' },
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

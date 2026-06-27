import { Link } from 'react-router-dom'

interface Props {
  title: string
  subtitle?: string
}

// Diyet Kocu sayfalari icin ortak baslik. Sagda CRM'e donus baglantisi var.
export default function DietHeader({ title, subtitle }: Props) {
  return (
    <header className="sticky top-0 z-10 bg-emerald-600 text-white px-4 py-3 flex items-center justify-between shadow">
      <div>
        <h1 className="text-lg font-bold leading-tight">🥗 {title}</h1>
        {subtitle && <p className="text-xs text-emerald-100">{subtitle}</p>}
      </div>
      <Link to="/" className="text-xs bg-emerald-700/60 hover:bg-emerald-700 rounded-lg px-2.5 py-1.5">
        CRM'e dön
      </Link>
    </header>
  )
}

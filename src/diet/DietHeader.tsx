interface Props {
  title: string
  subtitle?: string
}

// Diyet Kocu sayfalari icin ortak baslik.
export default function DietHeader({ title, subtitle }: Props) {
  return (
    <header className="sticky top-0 z-10 bg-emerald-600 text-white px-4 py-3 shadow">
      <h1 className="text-lg font-bold leading-tight">🥗 {title}</h1>
      {subtitle && <p className="text-xs text-emerald-100">{subtitle}</p>}
    </header>
  )
}

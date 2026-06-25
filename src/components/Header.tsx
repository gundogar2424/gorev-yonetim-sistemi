interface Props {
  title: string
  subtitle?: string
  right?: React.ReactNode
}

export default function Header({ title, subtitle, right }: Props) {
  return (
    <header className="sticky top-0 z-10 bg-brand-700 text-white px-4 py-3 flex items-center justify-between shadow">
      <div>
        <h1 className="text-lg font-bold leading-tight">{title}</h1>
        {subtitle && <p className="text-xs text-brand-100">{subtitle}</p>}
      </div>
      {right}
    </header>
  )
}

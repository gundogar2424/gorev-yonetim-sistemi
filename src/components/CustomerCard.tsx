import type { Customer } from '../types'
import { telLink, whatsappLink } from '../lib/contact'

// Musteri liste karti (Musteriler ve Bölge ekranlarinda ortak kullanilir)
export default function CustomerCard({ c, onClick }: { c: Customer; onClick: () => void }) {
  return (
    <li className="card p-3 flex items-center gap-3">
      <button onClick={onClick} className="flex items-center gap-3 flex-1 min-w-0 text-left">
        {c.photo ? (
          <img src={c.photo} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center font-bold shrink-0">
            {(c.companyTitle || '?').slice(0, 1).toLocaleUpperCase('tr-TR')}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-800 leading-snug break-words line-clamp-2">
            {c.companyTitle}
          </p>
          {(c.contactName || c.role) && (
            <p className="text-sm text-slate-500 truncate">
              {c.contactName}
              {c.role ? ` · ${c.role}` : ''}
            </p>
          )}
          {!c.contactName && c.phone && <p className="text-sm text-slate-500 truncate">{c.phone}</p>}
          {(c.district || c.city || c.gps) && (
            <p className="text-xs font-medium text-brand-700 truncate mt-0.5">
              📍 {[c.district, c.city].filter(Boolean).join(', ') || 'Konum kayıtlı'}
            </p>
          )}
        </div>
      </button>

      {c.phone && (
        <div className="flex gap-1 shrink-0">
          <a
            href={telLink(c.phone)}
            className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-lg"
            aria-label="Ara"
            onClick={(e) => e.stopPropagation()}
          >
            📞
          </a>
          <a
            href={whatsappLink(c.phone)}
            target="_blank"
            rel="noreferrer"
            className="w-10 h-10 rounded-full bg-green-50 text-green-600 flex items-center justify-center text-lg"
            aria-label="WhatsApp"
            onClick={(e) => e.stopPropagation()}
          >
            💬
          </a>
        </div>
      )}
    </li>
  )
}

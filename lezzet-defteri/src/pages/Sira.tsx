import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { lzDb } from '../db'
import type { LzSira } from '../types'
import { Header, Icon, T_BASLIK, T_SOLUK } from '../components/ui'
import { siraTekrar } from '../lib/sira'

const IKON: Record<LzSira['durum'], string> = { bekliyor: '⏳', isleniyor: '⚙️', bitti: '✅', hata: '⚠️' }

// Arka arkaya paylasilan tariflerin durumu
export default function Sira() {
  const liste = useLiveQuery(() => lzDb.sira.orderBy('createdAt').reverse().toArray(), [], [] as LzSira[]) ?? []
  const bekleyen = liste.filter((x) => x.durum === 'bekliyor' || x.durum === 'isleniyor').length
  const biten = liste.filter((x) => x.durum === 'bitti')

  return (
    <div>
      <Header title="Tarif sırası" subtitle={bekleyen ? `${bekleyen} tarif işleniyor / sırada` : 'Sıra boş'} back />
      <div className="px-4 space-y-2.5 pb-8">
        <p className={`text-[12.5px] px-1 ${T_SOLUK}`}>
          Instagram, TikTok ya da YouTube’dan art arda “Paylaş → Lezzet Defteri” diyebilirsin; tarifler sırayla işlenip deftere kendiliğinden
          eklenir. Uygulama kapanırsa sıra kaybolmaz, açınca devam eder.
        </p>
        {liste.length === 0 && <div className={`lz-card p-6 text-center text-sm ${T_SOLUK}`}>Sırada tarif yok.</div>}
        {liste.map((x) => (
          <div key={x.id} className="lz-card p-3.5 flex gap-3 items-start">
            <span className={`text-xl leading-none mt-0.5 ${x.durum === 'isleniyor' ? 'animate-spin' : ''}`}>{IKON[x.durum]}</span>
            <div className="flex-1 min-w-0">
              <div className={`font-semibold text-[14.5px] leading-snug line-clamp-2 break-all ${T_BASLIK}`}>{x.baslik}</div>
              <div
                className={`text-[12.5px] mt-0.5 ${
                  x.durum === 'hata' || x.mesaj.startsWith('⚠️') ? 'text-rose-600 dark:text-rose-300' : T_SOLUK
                }`}
              >
                {x.mesaj}
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {x.durum === 'bitti' && x.recipeId > 0 && (
                  <Link to={`/tarif/${x.recipeId}`} className="lz-btn-primary px-3 py-1.5 text-[12.5px]">
                    Tarifi aç
                  </Link>
                )}
                {x.durum === 'bitti' && x.mesaj.startsWith('Bu tarif zaten') && (
                  <button className="lz-btn-soft px-3 py-1.5 text-[12.5px]" onClick={() => void siraTekrar(x.id!, true)}>
                    ↻ Yeniden çıkar
                  </button>
                )}
                {x.durum === 'hata' && (
                  <button className="lz-btn-primary px-3 py-1.5 text-[12.5px]" onClick={() => void siraTekrar(x.id!)}>
                    ↻ Tekrar dene
                  </button>
                )}
                {x.durum !== 'isleniyor' && (
                  <button className="lz-btn-soft px-3 py-1.5 text-[12.5px]" onClick={() => void lzDb.sira.delete(x.id!)} aria-label="Sıradan sil">
                    <Icon name="x" className="w-3.5 h-3.5" /> Sil
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {biten.length > 0 && (
          <button className={`text-[13px] w-full py-2 ${T_SOLUK}`} onClick={() => void lzDb.sira.bulkDelete(biten.map((x) => x.id!))}>
            Bitenleri listeden temizle
          </button>
        )}
      </div>
    </div>
  )
}

// Tariflerim basligindaki 📥 dugmesinde bekleyen sayisi
export function SiraRozeti() {
  const n = useLiveQuery(() => lzDb.sira.where('durum').anyOf('bekliyor', 'isleniyor', 'hata').count(), [], 0) ?? 0
  if (!n) return null
  return (
    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-lz-600 text-white text-[11px] font-bold flex items-center justify-center">
      {n}
    </span>
  )
}

// Tariflerim ekraninin ustundeki kucuk durum seridi: sirada ya da yeni
// eklenmis (henuz temizlenmemis) tarif varsa gorunur.
export function SiraSeridi() {
  const liste = useLiveQuery(() => lzDb.sira.toArray(), [], [] as LzSira[]) ?? []
  const bekleyen = liste.filter((x) => x.durum === 'bekliyor' || x.durum === 'isleniyor').length
  const hata = liste.filter((x) => x.durum === 'hata').length
  const biten = liste.filter((x) => x.durum === 'bitti').length
  if (!bekleyen && !hata && !biten) return null
  const parca = [
    bekleyen ? `${bekleyen} tarif sırada işleniyor` : '',
    biten ? `${biten} tarif sıradan eklendi` : '',
    hata ? `${hata} tarif işlenemedi` : ''
  ].filter(Boolean)
  return (
    <Link to="/sira" className="lz-card p-3 flex items-center gap-3">
      <span className={`text-lg ${bekleyen ? 'animate-pulse' : ''}`}>{bekleyen ? '⚙️' : hata ? '⚠️' : '📥'}</span>
      <span className={`flex-1 text-[13.5px] font-medium ${T_BASLIK}`}>{parca.join(' · ')}</span>
      <Icon name="back" className={`w-5 h-5 rotate-180 ${T_SOLUK}`} />
    </Link>
  )
}

import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { temelLink } from '../lib/kopya'
import { lzDb } from '../db'
import type { LzSira } from '../types'
import { Header, Icon, T_BASLIK, T_SOLUK } from '../components/ui'
import { mekanOlarakTekrar, siraDurdur, siraIsle, siraTekrar } from '../lib/sira'

// Durum isareti: renkli nokta (emojisiz)
const IKON: Record<LzSira['durum'], string> = { bekliyor: 'bg-[#d4d4d8]', isleniyor: 'bg-amber-400 animate-pulse', bitti: 'bg-emerald-500', hata: 'bg-rose-500' }

// Arka arkaya paylasilan tariflerin durumu
export default function Sira() {
  const liste = useLiveQuery(() => lzDb.sira.orderBy('createdAt').reverse().toArray(), [], [] as LzSira[]) ?? []
  const bekleyen = liste.filter((x) => x.durum === 'bekliyor' || x.durum === 'isleniyor').length
  const biten = liste.filter((x) => x.durum === 'bitti')
  const hatali = liste.filter((x) => x.durum === 'hata')

  return (
    <div>
      <Header title="Tarif sırası" subtitle={bekleyen ? `${bekleyen} tarif işleniyor / sırada` : 'Sıra boş'} back />
      <div className="px-4 space-y-2.5 pb-8">
        <p className={`text-[12.5px] px-1 ${T_SOLUK}`}>
          Instagram, TikTok ya da YouTube’dan art arda “Paylaş → Lezzet Rotası” diyebilirsin; tarifler sırayla işlenip deftere kendiliğinden
          eklenir. Uygulama kapanırsa sıra kaybolmaz, açınca devam eder.
        </p>
        {hatali.length > 1 && (
          <button
            className="lz-btn-primary w-full text-sm"
            onClick={async () => {
              for (const x of hatali) await lzDb.sira.update(x.id!, { durum: 'bekliyor', mesaj: 'Sırada', updatedAt: Date.now() })
              void siraIsle()
            }}
          >
            ↻ Hatalıların hepsini tekrar dene ({hatali.length})
          </button>
        )}
        {liste.length === 0 && <div className={`lz-card p-6 text-center text-sm ${T_SOLUK}`}>Sırada tarif yok.</div>}
        {liste.map((x) => (
          <div key={x.id} className="lz-card p-3.5 flex gap-3 items-start">
            <span className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${IKON[x.durum]}`} />
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
                {x.durum === 'bitti' && !!x.mekanId && (
                  <Link to={`/mekan/${x.mekanId}`} className="lz-btn-primary px-3 py-1.5 text-[12.5px]">
                    Mekanı aç
                  </Link>
                )}
                {x.durum === 'bitti' && !!x.mekanId && <AyniVideodakiler id={x.mekanId} />}
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
                {x.tur !== 'mekan' && !x.mekanId && (x.durum === 'hata' || (x.durum === 'bitti' && x.recipeId > 0)) && (
                  <button className="lz-btn-soft px-3 py-1.5 text-[12.5px]" onClick={() => void mekanOlarakTekrar(x.id!)}>
                    Bu bir mekan
                  </button>
                )}
                {x.durum === 'hata' && (
                  <button className="lz-btn-primary px-3 py-1.5 text-[12.5px]" onClick={() => void siraTekrar(x.id!)}>
                    ↻ Tekrar dene
                  </button>
                )}
                {x.durum === 'isleniyor' && Date.now() - (x.updatedAt ?? 0) > 3 * 60 * 1000 && (
                  <button className="lz-btn-soft px-3 py-1.5 text-[12.5px]" onClick={() => void siraDurdur(x.id!)}>
                    ⏹ Durdur
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

// Tariflerim basligindaki dugmesinde bekleyen sayisi
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
      <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${hata && !bekleyen ? 'bg-rose-50 text-rose-600 dark:bg-[#2a1a1d]' : 'bg-lz-50 text-lz-600 dark:bg-[#3a1d16]'} ${bekleyen ? 'animate-pulse' : ''}`}>
        <Icon name="inbox" className="w-[18px] h-[18px]" />
      </span>
      <span className={`flex-1 text-[13.5px] font-medium ${T_BASLIK}`}>{parca.join(' · ')}</span>
      <Icon name="back" className={`w-5 h-5 rotate-180 ${T_SOLUK}`} />
    </Link>
  )
}

// Ayni videodan kaydedilen diger mekanlar: her biri dogrudan acilabilsin
function AyniVideodakiler({ id }: { id: number }) {
  const liste =
    useLiveQuery(async () => {
      const m = await lzDb.mekanlar.get(id)
      if (!m?.sourceUrl) return []
      const t = temelLink(m.sourceUrl)
      return (await lzDb.mekanlar.toArray()).filter((x) => x.id !== id && x.sourceUrl && temelLink(x.sourceUrl) === t)
    }, [id]) ?? []
  return (
    <>
      {liste.map((m) => (
        <Link key={m.id} to={`/mekan/${m.id}`} className="lz-btn-soft px-3 py-1.5 text-[12.5px]">
          {m.ad}
        </Link>
      ))}
    </>
  )
}

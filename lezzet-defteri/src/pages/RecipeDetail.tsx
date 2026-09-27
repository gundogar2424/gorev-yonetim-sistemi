import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { addPlan, addToShopping, deleteRecipe, lzDb, toggleFavorite, updateRecipe } from '../db'
import type { LzMeal, LzTable } from '../types'
import { Icon, PlatformLabel, Sheet, T_BASLIK, T_GOVDE, T_SOLUK, Thumb, Toast, sureYaz, useToast } from '../components/ui'
import { olcekle } from '../lib/qty'
import { GUN_ADI, OGUNLER, gunAnahtari, gunEkle, haftaBasi, kisaTarih } from '../lib/dates'
import { PLATFORM_AD } from '../lib/importer'

export default function RecipeDetail() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const r = useLiveQuery(() => lzDb.recipes.get(id), [id])
  const sofralar = useLiveQuery(() => lzDb.sofralar.orderBy('name').toArray(), [], [] as LzTable[]) ?? []
  const [kisi, setKisi] = useState(0) // 0 = tarifteki porsiyon
  const [isaretli, setIsaretli] = useState<Set<number>>(new Set())
  const [planAc, setPlanAc] = useState(false)
  const [toast, goster] = useToast()

  if (r === undefined) return null
  if (!r) {
    return (
      <div className="p-6 text-center">
        <p className={T_SOLUK}>Tarif bulunamadı.</p>
        <Link to="/" className="lz-btn-soft mt-4">
          Tariflere dön
        </Link>
      </div>
    )
  }

  const temel = r.servings || 0
  const hedef = kisi || temel
  const carpan = temel && hedef ? hedef / temel : 1
  const malzemeler = r.ingredients.map((m) => olcekle(m, carpan))

  const alisveriseEkle = async () => {
    const secim = isaretli.size ? malzemeler.filter((_, i) => !isaretli.has(i)) : malzemeler
    const n = await addToShopping(secim, r.id!, r.title)
    goster(n ? `${n} malzeme alışveriş listesine eklendi` : 'Hepsi zaten listede')
  }

  const paylas = async () => {
    const metin = [
      r.title,
      '',
      'Malzemeler:',
      ...malzemeler.map((m) => `• ${m}`),
      '',
      'Yapılışı:',
      ...r.steps.map((s, i) => `${i + 1}. ${s}`),
      r.sourceUrl ? `\nKaynak: ${r.sourceUrl}` : ''
    ].join('\n')
    try {
      if (navigator.share) await navigator.share({ title: r.title, text: metin })
      else {
        await navigator.clipboard.writeText(metin)
        goster('Tarif panoya kopyalandı')
      }
    } catch {
      /* kullanici vazgecti */
    }
  }

  const sofraDegis = (tid: number) =>
    updateRecipe(r.id!, { tableIds: r.tableIds.includes(tid) ? r.tableIds.filter((x) => x !== tid) : [...r.tableIds, tid] })

  return (
    <div>
      {/* Kapak */}
      <div className="relative">
        <Thumb src={r.photo} className="w-full h-72 rounded-b-[32px] text-7xl" />
        <div className="absolute inset-x-0 top-0 flex justify-between p-4" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
          <RoundBtn onClick={() => navigate(-1)} label="Geri">
            <Icon name="back" />
          </RoundBtn>
          <div className="flex gap-2">
            <RoundBtn onClick={() => void paylas()} label="Paylaş">
              <Icon name="share" />
            </RoundBtn>
            <RoundBtn onClick={() => void toggleFavorite(r.id!)} label="Favori">
              <svg viewBox="0 0 24 24" className={`w-5 h-5 ${r.favorite ? 'text-amber-400' : ''}`} fill={r.favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
                <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9L3.5 9.7l5.9-.8z" strokeLinejoin="round" />
              </svg>
            </RoundBtn>
            <RoundBtn onClick={() => navigate(`/duzenle/${r.id}`)} label="Düzenle">
              <Icon name="edit" />
            </RoundBtn>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-6 relative space-y-3 pb-8">
        <div className="lz-card p-4">
          <h1 className={`text-[23px] font-bold leading-tight ${T_BASLIK}`}>{r.title}</h1>
          <div className="mt-2 flex items-center gap-3 flex-wrap">
            <PlatformLabel r={r} />
            {r.minutes > 0 && (
              <span className={`inline-flex items-center gap-1 text-[12px] ${T_SOLUK}`}>
                <Icon name="clock" className="w-3.5 h-3.5" /> {sureYaz(r.minutes)}
              </span>
            )}
            {r.cookCount > 0 && <span className="text-[12px] text-lz-600">{r.cookCount} kez pişirildi</span>}
          </div>
          {r.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {r.tags.map((t) => (
                <span key={t} className="lz-pill">
                  {t}
                </span>
              ))}
            </div>
          )}
          {r.sourceUrl && (
            <a
              href={r.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-lz-600"
            >
              <Icon name="link" className="w-4 h-4" /> {PLATFORM_AD[r.platform] === 'Web' ? 'Kaynağı aç' : `${PLATFORM_AD[r.platform]}’da aç`}
            </a>
          )}
        </div>

        <Link
          to={`/thermomix/${r.id}`}
          className="lz-card p-3 flex items-center gap-3 active:scale-[0.99] transition"
        >
          <span className="w-10 h-10 rounded-2xl bg-lz-50 dark:bg-[#3a1d16] text-lz-600 flex items-center justify-center">
            <Icon name="pot" />
          </span>
          <span className="flex-1">
            <span className={`block font-semibold text-[15px] ${T_BASLIK}`}>{r.tm ? 'Thermomix sürümü' : 'Thermomix’e uyarla'}</span>
            <span className={`block text-[12px] ${T_SOLUK}`}>
              {r.tm ? `${r.tm.steps.length} TM7 adımı · devir, sıcaklık, süre` : 'TM7 adımlarına çevir (yapay zeka)'}
            </span>
          </span>
          <Icon name="back" className={`w-5 h-5 rotate-180 ${T_SOLUK}`} />
        </Link>

        <div className="grid grid-cols-2 gap-2.5">
          <Link to={`/pisir/${r.id}`} className="lz-btn-primary">
            <Icon name="play" className="w-4 h-4" /> Pişir
          </Link>
          <button className="lz-btn-soft" onClick={() => setPlanAc(true)}>
            <Icon name="calendar" className="w-4 h-4" /> Haftaya ekle
          </button>
        </div>

        {/* Malzemeler */}
        <div className="lz-card p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className={`font-bold text-[17px] ${T_BASLIK}`}>Malzemeler</h2>
            {temel > 0 && (
              <div className="flex items-center gap-1 bg-[#f3ebe2] dark:bg-[#2a2420] rounded-full p-1">
                <button className="w-8 h-8 rounded-full bg-white dark:bg-[#221d1a] font-bold" onClick={() => setKisi(Math.max(1, hedef - 1))} aria-label="Azalt">
                  −
                </button>
                <span className={`text-[13px] font-semibold px-1.5 tabular-nums ${T_BASLIK}`}>{hedef} kişilik</span>
                <button className="w-8 h-8 rounded-full bg-white dark:bg-[#221d1a] font-bold" onClick={() => setKisi(hedef + 1)} aria-label="Artır">
                  +
                </button>
              </div>
            )}
          </div>
          {malzemeler.length === 0 ? (
            <p className={`text-sm ${T_SOLUK}`}>Malzeme yazılmamış.</p>
          ) : (
            <ul className="divide-y divide-[#f3ebe2] dark:divide-[#2a2420]">
              {malzemeler.map((m, i) => (
                <li key={i}>
                  <label className="flex items-start gap-3 py-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-1 w-[18px] h-[18px] flex-shrink-0"
                      checked={isaretli.has(i)}
                      onChange={() => {
                        const s = new Set(isaretli)
                        if (s.has(i)) s.delete(i)
                        else s.add(i)
                        setIsaretli(s)
                      }}
                    />
                    <span className={`text-[15px] leading-snug ${isaretli.has(i) ? 'line-through opacity-50' : ''} ${T_GOVDE}`}>{m}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {malzemeler.length > 0 && (
            <button className="lz-btn-soft w-full mt-3 text-sm" onClick={() => void alisveriseEkle()}>
              <Icon name="cart" className="w-4 h-4" />
              {isaretli.size ? 'Evde olmayanları listeye ekle' : 'Alışveriş listesine ekle'}
            </button>
          )}
          {malzemeler.length > 0 && <p className={`text-[11.5px] mt-2 text-center ${T_SOLUK}`}>Evde olanları işaretle; yalnızca eksikler eklenir.</p>}
        </div>

        {/* Yapilis */}
        <div className="lz-card p-4">
          <h2 className={`font-bold text-[17px] mb-2 ${T_BASLIK}`}>Yapılışı</h2>
          {r.steps.length === 0 ? (
            <p className={`text-sm ${T_SOLUK}`}>Adım yazılmamış.</p>
          ) : (
            <ol className="space-y-3">
              {r.steps.map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span className="w-7 h-7 rounded-full bg-lz-50 dark:bg-[#3a1d16] text-lz-600 dark:text-lz-300 text-[13px] font-bold flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <p className={`text-[15px] leading-relaxed pt-0.5 ${T_GOVDE}`}>{s}</p>
                </li>
              ))}
            </ol>
          )}
        </div>

        {r.notes && (
          <div className="lz-card p-4">
            <h2 className={`font-bold text-[17px] mb-2 ${T_BASLIK}`}>Notlar</h2>
            <p className={`text-[14.5px] leading-relaxed whitespace-pre-line ${T_GOVDE}`}>{r.notes}</p>
          </div>
        )}

        <div className="lz-card p-4">
          <h2 className={`font-bold text-[17px] mb-2 ${T_BASLIK}`}>Sofralar</h2>
          {sofralar.length === 0 ? (
            <p className={`text-sm ${T_SOLUK}`}>Henüz sofra yok. Tariflerim › Sofralarım’dan oluşturabilirsin.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {sofralar.map((t) => (
                <button key={t.id} onClick={() => void sofraDegis(t.id!)} className={`lz-chip ${r.tableIds.includes(t.id!) ? 'lz-chip-on' : ''}`}>
                  {t.emoji} {t.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          className="lz-btn-danger w-full"
          onClick={async () => {
            if (!confirm('Bu tarif silinsin mi?')) return
            await deleteRecipe(r.id!)
            navigate('/', { replace: true })
          }}
        >
          <Icon name="trash" className="w-4 h-4" /> Tarifi sil
        </button>
      </div>

      <PlanSec
        open={planAc}
        onClose={() => setPlanAc(false)}
        onSec={async (tarih, ogun) => {
          await addPlan(tarih, ogun, r.id!)
          setPlanAc(false)
          goster('Haftalık plana eklendi')
        }}
      />
      <Toast text={toast} />
    </div>
  )
}

function RoundBtn({ onClick, label, children }: { onClick: () => void; label: string; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="w-10 h-10 rounded-full bg-white/90 dark:bg-[#171412]/80 backdrop-blur text-[#2b211b] dark:text-[#f2ebe5] flex items-center justify-center shadow-sm active:scale-95 transition"
    >
      {children}
    </button>
  )
}

// Gun + ogun secimi (bu hafta ve gelecek hafta)
export function PlanSec({ open, onClose, onSec }: { open: boolean; onClose: () => void; onSec: (tarih: string, ogun: LzMeal) => void }) {
  const [ogun, setOgun] = useState<LzMeal>('aksam')
  const bugun = new Date()
  const bas = haftaBasi(bugun)
  const gunler = Array.from({ length: 14 }, (_, i) => gunEkle(bas, i)).filter((g) => gunAnahtari(g) >= gunAnahtari(bugun))
  return (
    <Sheet open={open} onClose={onClose} title="Hangi gün?">
      <div className="flex gap-2 mb-4">
        {OGUNLER.map((o) => (
          <button key={o.id} onClick={() => setOgun(o.id)} className={`lz-chip flex-1 justify-center ${ogun === o.id ? 'lz-chip-on' : ''}`}>
            {o.emoji} {o.ad}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {gunler.map((g) => {
          const bugunMu = gunAnahtari(g) === gunAnahtari(bugun)
          return (
            <button key={gunAnahtari(g)} onClick={() => onSec(gunAnahtari(g), ogun)} className="lz-card p-3 text-left active:scale-[0.98] transition">
              <div className={`font-semibold ${T_BASLIK}`}>{bugunMu ? 'Bugün' : GUN_ADI[(g.getDay() + 6) % 7]}</div>
              <div className={`text-[12px] ${T_SOLUK}`}>{kisaTarih(g)}</div>
            </button>
          )
        })}
      </div>
    </Sheet>
  )
}

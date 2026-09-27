import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { addTable, deleteTable, listRecipes, lzDb, toggleFavorite } from '../db'
import { apiAnahtari } from '../lib/ai'
import type { LzRecipe, LzTable } from '../types'
import { Header, Icon, Logo, PlatformLabel, Sheet, T_BASLIK, T_SOLUK, Thumb, sureYaz } from '../components/ui'

const SOFRA_EMOJI = ['👩', '👨', '👧', '👦', '👵', '👴', '💑', '👶', '🎉', '🥗', '🏠', '🍽️']
const YENI_GUN = 7

type Filtre = 'hepsi' | 'yeni' | 'favori' | string // string = etiket adi

export default function Recipes() {
  const navigate = useNavigate()
  const tarifler = useLiveQuery(() => listRecipes(), [], [] as LzRecipe[]) ?? []
  const sofralar = useLiveQuery(() => lzDb.sofralar.orderBy('name').toArray(), [], [] as LzTable[]) ?? []
  const [sekme, setSekme] = useState<'tarifler' | 'sofralar'>('tarifler')
  const [q, setQ] = useState('')
  const [filtre, setFiltre] = useState<Filtre>('hepsi')
  const [sofra, setSofra] = useState<number>(0)
  const [yeniSofra, setYeniSofra] = useState(false)
  const [duzenSofra, setDuzenSofra] = useState<LzTable | null>(null)

  const etiketler = Array.from(new Set(tarifler.flatMap((r) => r.tags))).sort((a, b) => a.localeCompare(b, 'tr'))
  const yeniSinir = Date.now() - YENI_GUN * 86400000
  const arama = q.trim().toLocaleLowerCase('tr')

  const gorunen = tarifler.filter((r) => {
    if (sofra && !r.tableIds.includes(sofra)) return false
    if (filtre === 'yeni' && r.createdAt < yeniSinir) return false
    if (filtre === 'favori' && !r.favorite) return false
    if (filtre !== 'hepsi' && filtre !== 'yeni' && filtre !== 'favori' && !r.tags.includes(filtre)) return false
    if (!arama) return true
    return `${r.title} ${r.ingredients.join(' ')} ${r.tags.join(' ')} ${r.author}`.toLocaleLowerCase('tr').includes(arama)
  })

  return (
    <div>
      <Header
        title={
          <span className="flex items-center gap-2 min-w-0">
            <Logo className="w-8 h-8 flex-shrink-0" /> <span className="truncate text-[22px]">Lezzet Defteri</span>
          </span>
        }
        right={
          <Link to="/ne-pisirsem" className="lz-btn-soft px-3 py-2 text-[12.5px] whitespace-nowrap">
            ✨ Ne pişirsem?
          </Link>
        }
      />

      <div className="px-4 space-y-3">
        <label className="relative block">
          <span className={`absolute left-4 top-1/2 -translate-y-1/2 ${T_SOLUK}`}>
            <Icon name="search" className="w-[18px] h-[18px]" />
          </span>
          <input className="lz-input pl-11" placeholder="Kaydettiklerinde ara…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>

        {/* Tariflerim / Sofralarım */}
        <div className="grid grid-cols-2 bg-[#f3ebe2] dark:bg-[#221d1a] rounded-full p-1">
          {(['tarifler', 'sofralar'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSekme(s)}
              className={`py-2 rounded-full text-sm font-semibold transition ${
                sekme === s ? 'bg-lz-600 text-white shadow-sm' : 'text-[#8c7d72] dark:text-[#a3968b]'
              }`}
            >
              {s === 'tarifler' ? 'Tariflerim' : 'Sofralarım'}
            </button>
          ))}
        </div>

        {sekme === 'tarifler' ? (
          <>
            {/* Sofra (kisi) suzgeci */}
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4">
              {sofralar.map((t) => {
                const on = sofra === t.id
                return (
                  <button key={t.id} onClick={() => setSofra(on ? 0 : t.id!)} className="flex flex-col items-center gap-1 flex-shrink-0 w-16">
                    <span
                      className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl transition ${
                        on ? 'bg-lz-600 ring-4 ring-lz-100 dark:ring-lz-900' : 'bg-white dark:bg-[#221d1a]'
                      }`}
                    >
                      {t.emoji}
                    </span>
                    <span className={`text-[11.5px] truncate w-full text-center ${on ? 'text-lz-600 font-semibold' : T_SOLUK}`}>{t.name}</span>
                  </button>
                )
              })}
              <button onClick={() => setYeniSofra(true)} className="flex flex-col items-center gap-1 flex-shrink-0 w-16">
                <span className="w-14 h-14 rounded-full flex items-center justify-center border-2 border-dashed border-[#e3d6c9] dark:border-[#3a322d] text-[#b3a69b]">
                  <Icon name="plus" />
                </span>
                <span className={`text-[11.5px] ${T_SOLUK}`}>Sofra</span>
              </button>
            </div>

            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4">
              <Chip on={filtre === 'hepsi'} onClick={() => setFiltre('hepsi')} label="Tüm Tarifler" />
              <Chip on={filtre === 'yeni'} onClick={() => setFiltre('yeni')} label="✨ Yeni" />
              <Chip on={filtre === 'favori'} onClick={() => setFiltre('favori')} label="★ Favoriler" />
              {etiketler.map((e) => (
                <Chip key={e} on={filtre === e} onClick={() => setFiltre(filtre === e ? 'hepsi' : e)} label={e} />
              ))}
            </div>

            {tarifler.length === 0 ? (
              <BosDefter />
            ) : gorunen.length === 0 ? (
              <div className={`lz-card p-6 text-center text-sm ${T_SOLUK}`}>Bu seçime uyan tarif yok.</div>
            ) : (
              <div className="space-y-2.5 pb-4">
                {gorunen.map((r) => (
                  <RecipeCard key={r.id} r={r} />
                ))}
              </div>
            )}
          </>
        ) : (
          <SofraListesi
            sofralar={sofralar}
            tarifler={tarifler}
            onAc={(id) => {
              setSofra(id)
              setFiltre('hepsi')
              setSekme('tarifler')
            }}
            onYeni={() => setYeniSofra(true)}
            onDuzenle={(t) => setDuzenSofra(t)}
          />
        )}
      </div>

      <button
        onClick={() => navigate('/ekle')}
        className="fixed z-30 w-14 h-14 rounded-full bg-lz-600 text-white shadow-lg shadow-lz-600/30 flex items-center justify-center active:scale-95 transition"
        style={{ bottom: 'calc(5.5rem + env(safe-area-inset-bottom))', right: 'max(1.25rem, calc(50vw - 18rem + 1.25rem))' }}
        aria-label="Tarif ekle"
      >
        <Icon name="plus" className="w-7 h-7" />
      </button>

      <YeniSofra open={yeniSofra} onClose={() => setYeniSofra(false)} />
      <YeniSofra open={!!duzenSofra} duzenle={duzenSofra ?? undefined} onClose={() => setDuzenSofra(null)} />
    </div>
  )
}

function Chip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`lz-chip flex-shrink-0 ${on ? 'lz-chip-on' : ''}`}>
      {label}
    </button>
  )
}

function RecipeCard({ r }: { r: LzRecipe }) {
  const meta = [r.ingredients.length ? `${r.ingredients.length} malzeme` : '', sureYaz(r.minutes)].filter(Boolean).join(' · ')
  return (
    <div className="lz-card p-2.5 flex items-center gap-3">
      <Link to={`/tarif/${r.id}`} className="flex items-center gap-3 flex-1 min-w-0">
        <Thumb src={r.photo} className="w-[76px] h-[76px] rounded-2xl" />
        <div className="min-w-0 flex-1 py-0.5">
          <div className={`font-semibold text-[15.5px] leading-snug line-clamp-2 ${T_BASLIK}`}>{r.title}</div>
          <div className="mt-1">
            <PlatformLabel r={r} />
          </div>
          {meta && <div className={`text-[12px] mt-0.5 ${T_SOLUK}`}>{meta}</div>}
        </div>
      </Link>
      <button
        onClick={() => r.id && toggleFavorite(r.id)}
        className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${r.favorite ? 'text-amber-400' : 'text-[#e0d4c8] dark:text-[#3a322d]'}`}
        aria-label={r.favorite ? 'Favoriden çıkar' : 'Favoriye ekle'}
      >
        <svg viewBox="0 0 24 24" className="w-[22px] h-[22px]" fill={r.favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
          <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9L3.5 9.7l5.9-.8z" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  )
}

function BosDefter() {
  return (
    <div className="lz-card p-6 text-center">
      <Logo className="w-16 h-16 mx-auto mb-2" />
      <p className={`font-semibold mb-1 ${T_BASLIK}`}>Tüm tariflerin tek yerde.</p>
      <p className={`text-sm mb-4 ${T_SOLUK}`}>
        Instagram, TikTok, YouTube ya da bir tarif sitesinden linki yapıştır; malzemeler ve yapılışı deftere insin.
      </p>
      <div className="flex gap-2 justify-center">
        <Link to="/ekle" className="lz-btn-primary px-4 py-2.5 text-sm">
          Tarif ekle
        </Link>
        <Link to="/yeni" className="lz-btn-soft px-4 py-2.5 text-sm">
          Elle yaz
        </Link>
      </div>
    </div>
  )
}

function SofraListesi({
  sofralar,
  tarifler,
  onAc,
  onYeni,
  onDuzenle
}: {
  sofralar: LzTable[]
  tarifler: LzRecipe[]
  onAc: (id: number) => void
  onYeni: () => void
  onDuzenle: (t: LzTable) => void
}) {
  return (
    <div className="space-y-3 pb-4">
      <p className={`text-[13px] px-1 ${T_SOLUK}`}>
        Sofralar, tarifleri sevdiklerine göre toplar: “Kocam”, “Canım Kızım”, “Misafir sofrası”… Her sofraya sevmediklerini ve alerjilerini
        yazarsan “Ne pişirsem?” ve sihirli haftalık menü bunlara uyar.
      </p>
      <div className="grid grid-cols-2 gap-2.5">
        {sofralar.map((t) => {
          const icindekiler = tarifler.filter((r) => r.tableIds.includes(t.id!))
          return (
            <div key={t.id} className="lz-card p-3 relative">
              <button onClick={() => onAc(t.id!)} className="text-left w-full">
                <div className="flex -space-x-3 mb-2">
                  {icindekiler.slice(0, 3).map((r) => (
                    <Thumb key={r.id} src={r.photo} className="w-11 h-11 rounded-full ring-2 ring-white dark:ring-[#221d1a] text-lg" />
                  ))}
                  {icindekiler.length === 0 && (
                    <span className="w-11 h-11 rounded-full bg-[#f6ece2] dark:bg-[#2a2420] flex items-center justify-center text-xl">{t.emoji}</span>
                  )}
                </div>
                <div className={`font-semibold truncate ${T_BASLIK}`}>
                  {t.emoji} {t.name}
                </div>
                <div className={`text-[12px] ${T_SOLUK}`}>{icindekiler.length} tarif</div>
                {t.notes && <div className={`text-[11.5px] mt-1 line-clamp-2 ${T_SOLUK}`}>⚠︎ {t.notes}</div>}
              </button>
              <button
                onClick={() => onDuzenle(t)}
                className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center ${T_SOLUK}`}
                aria-label="Sofrayı düzenle"
              >
                <Icon name="edit" className="w-4 h-4" />
              </button>
            </div>
          )
        })}
        <button
          onClick={onYeni}
          className="rounded-[22px] border-2 border-dashed border-[#e3d6c9] dark:border-[#3a322d] p-3 flex flex-col items-center justify-center gap-1 min-h-[120px] text-[#b3a69b]"
        >
          <Icon name="plus" className="w-6 h-6" />
          <span className="text-sm font-medium">Yeni sofra</span>
        </button>
      </div>
    </div>
  )
}

export function YeniSofra({
  open,
  onClose,
  onCreated,
  duzenle
}: {
  open: boolean
  onClose: () => void
  onCreated?: (id: number) => void
  duzenle?: LzTable
}) {
  const [ad, setAd] = useState('')
  const [emoji, setEmoji] = useState(SOFRA_EMOJI[0])
  const [not, setNot] = useState('')
  useEffect(() => {
    if (!open) return
    setAd(duzenle?.name ?? '')
    setEmoji(duzenle?.emoji ?? SOFRA_EMOJI[0])
    setNot(duzenle?.notes ?? '')
  }, [open, duzenle])

  const kaydet = async () => {
    if (!ad.trim()) return
    if (duzenle?.id) {
      await lzDb.sofralar.update(duzenle.id, { name: ad.trim(), emoji, notes: not.trim() })
    } else {
      const id = await addTable(ad, emoji, not)
      onCreated?.(id)
    }
    onClose()
  }
  return (
    <Sheet open={open} onClose={onClose} title={duzenle ? 'Sofrayı düzenle' : 'Yeni sofra'}>
      <div className="space-y-4">
        <input className="lz-input" placeholder="Örn. Kocam, Canım Kızım, Misafir" value={ad} onChange={(e) => setAd(e.target.value)} />
        <div className="grid grid-cols-6 gap-2">
          {SOFRA_EMOJI.map((e) => (
            <button
              key={e}
              onClick={() => setEmoji(e)}
              className={`h-12 rounded-2xl text-2xl ${emoji === e ? 'bg-lz-100 dark:bg-lz-900 ring-2 ring-lz-500' : 'bg-white dark:bg-[#221d1a]'}`}
            >
              {e}
            </button>
          ))}
        </div>
        <label className="block">
          <span className="lz-label block mb-1.5 px-1">Sevmedikleri, alerjileri, beslenme biçimi</span>
          <textarea
            className="lz-input min-h-[80px] text-[15px]"
            placeholder="Örn. patlıcan sevmez, fındık alerjisi var, az tuzlu yer"
            value={not}
            onChange={(e) => setNot(e.target.value)}
          />
          <span className={`block text-[11.5px] mt-1 px-1 ${T_SOLUK}`}>
            {apiAnahtari() ? 'Yapay zeka tarif ve menü önerirken buna uyar.' : 'Yapay zeka açılınca tarif ve menü önerileri buna uyar.'}
          </span>
        </label>
        <button className="lz-btn-primary w-full" disabled={!ad.trim()} onClick={() => void kaydet()}>
          {duzenle ? 'Kaydet' : 'Sofrayı oluştur'}
        </button>
        {duzenle?.id && (
          <button
            className="lz-btn-danger w-full text-sm"
            onClick={async () => {
              if (!confirm(`“${duzenle.name}” sofrası silinsin mi? Tarifler silinmez.`)) return
              await deleteTable(duzenle.id!)
              onClose()
            }}
          >
            Sofrayı sil
          </button>
        )}
      </div>
    </Sheet>
  )
}

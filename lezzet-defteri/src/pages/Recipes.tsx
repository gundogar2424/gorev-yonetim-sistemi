import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { etkilesimEski, etkilesimGetir } from '../lib/begeni'
import { esles, sonAramaEkle, sonAramalar } from '../lib/arama'
import { SonAramalar } from '../components/SonAramalar'
import { adaylar } from '../lib/hesaplar'
import { addTable, deleteTable, listRecipes, lzDb, toggleFavorite } from '../db'
import { apiAnahtari } from '../lib/ai'
import { SiraRozeti, useSiraOzeti } from './Sira'
import Mekanlar, { YAKIN_SERIT_KM, useYakinMekanSayisi } from './Mekanlar'
import { merkezAl } from '../lib/merkez'
import type { LzRecipe, LzTable } from '../types'
import { Header, Icon, IskeletKartlar, Logo, PlatformLabel, Sheet, SofraRozet, T_BASLIK, T_SOLUK, Thumb, sureYaz } from '../components/ui'

const SOFRA_EMOJI = ['👩', '👨', '👧', '👦', '👵', '👴', '💑', '👶', '🎉', '🥗', '🏠', '🍽️']
const YENI_GUN = 7

let begeniOkundu = false
type Sekme = 'tarifler' | 'mekanlar' | 'sofralar'
const SEKMELER: Sekme[] = ['tarifler', 'mekanlar', 'sofralar']
const SEKME_ANAHTAR = 'lz-ana-sekme'
const SEKME_AD: Record<Sekme, string> = { tarifler: 'Tariflerim', mekanlar: 'Mekanlarım', sofralar: 'Sofralarım' }
const IPUCU: Record<Sekme, string> = { tarifler: 'Tariflerinde ara…', mekanlar: 'Mekanlarında ara…', sofralar: 'Sofralarında ara…' }
function sonSekme(): Sekme {
  try {
    const x = localStorage.getItem(SEKME_ANAHTAR) as Sekme | null
    return x && SEKMELER.includes(x) ? x : 'tarifler'
  } catch {
    return 'tarifler'
  }
}
type Filtre = 'hepsi' | 'yeni' | 'favori' | string // string = etiket adi

export default function Recipes() {
  const tarifHam = useLiveQuery(() => listRecipes(), [])
  const tarifler = tarifHam ?? []
  const mekanSayisi = useLiveQuery(() => lzDb.mekanlar.count(), [], 0) ?? 0
  const sofralar = useLiveQuery(() => lzDb.sofralar.orderBy('name').toArray(), [], [] as LzTable[]) ?? []
  // ?sekme=mekanlar ile gelindiyse (Etiketler, mekan sayfasi vb.) o sekme acilir; hatirlanan sekme degismez
  const [params, setParams] = useSearchParams()
  const [sekme, setSekmeHam] = useState<Sekme>(() => {
    const x = params.get('sekme') as Sekme | null
    return x && SEKMELER.includes(x) ? x : sonSekme()
  })
  useEffect(() => {
    if (!params.get('sekme')) return
    const p = new URLSearchParams(params)
    p.delete('sekme')
    setParams(p, { replace: true })
    setTimeout(() => sekmeRef.current?.scrollIntoView({ block: 'start' }), 50)
  }, [])
  // Durum seridindeki "Yakininda"ya dokunuldu: Mekanlarim "Yakininda" (1 km) suzgeciyle acilir
  const [yakinIstek, setYakinIstek] = useState(0)
  const setSekme = (x: Sekme) => {
    setYakinIstek(0)
    setSekmeHam(x)
    try {
      localStorage.setItem(SEKME_ANAHTAR, x)
    } catch {
      /* hatirlanmasa da calisir */
    }
  }
  const sekmeRef = useRef<HTMLDivElement>(null)
  const sekmeyeGec = (x: Sekme) => {
    setSekme(x)
    setTimeout(() => sekmeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }
  // Sekmeler arasinda yana kaydirarak gecis (yatay kayan seritler haric)
  const dokunus = useRef<{ x: number; y: number; t: number } | null>(null)
  const kaydirBasla = (e: React.TouchEvent) => {
    const hedef = e.target as HTMLElement
    if (hedef.closest('.overflow-x-auto, input, textarea, .leaflet-container')) return (dokunus.current = null)
    dokunus.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() }
  }
  const kaydirBitir = (e: React.TouchEvent) => {
    const d = dokunus.current
    dokunus.current = null
    if (!d) return
    const dx = e.changedTouches[0].clientX - d.x
    const dy = e.changedTouches[0].clientY - d.y
    if (Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.6 || Date.now() - d.t > 800) return
    const i = SEKMELER.indexOf(sekme) + (dx < 0 ? 1 : -1)
    if (i >= 0 && i < SEKMELER.length) setSekme(SEKMELER[i])
  }
  const [q, setQ] = useState('')
  const [aramaOdak, setAramaOdak] = useState(false)
  const [tumEtiket, setTumEtiket] = useState(false)
  const [filtre, setFiltre] = useState<Filtre>('hepsi')
  const [sofra, setSofra] = useState<number>(0)
  const [yeniSofra, setYeniSofra] = useState(false)
  const [duzenSofra, setDuzenSofra] = useState<LzTable | null>(null)

  // Her sekmenin aramasi ayri: sekme degisince kutu bosalir, son aramalar da o sekmeninkiler
  const aramaTuru = sekme === 'tarifler' ? 'tarif' : sekme === 'mekanlar' ? 'mekan' : 'sofra'
  useEffect(() => setQ(''), [sekme])
  const etiketler = Array.from(new Set(tarifler.flatMap((r) => r.tags))).sort((a, b) => a.localeCompare(b, 'tr'))
  const yeniSinir = Date.now() - YENI_GUN * 86400000
  const arama = q.trim().toLocaleLowerCase('tr')

  // En begenilen: puani olanlar puana gore; eksik puanlar arka planda sirayla okunur
  // Puani okunmamis tarifler uygulama her acildiginda bir kez arka planda okunur (yapay zeka yok)
  useEffect(() => {
    if (begeniOkundu || !tarifler.length) return
    begeniOkundu = true
    void (async () => {
      // Instagram'i yormamak icin aralikli
      for (const r of tarifler.filter(etkilesimEski)) {
        await etkilesimGetir(r)
        await new Promise((x) => setTimeout(x, 1500))
      }
    })()
  }, [tarifler.length])
  useEffect(() => {
    if (filtre !== 'begeni') return
    let iptal = false
    void (async () => {
      for (const r of tarifler.filter(etkilesimEski)) {
        if (iptal) break
        await etkilesimGetir(r)
      }
    })()
    return () => {
      iptal = true
    }
  }, [filtre])
  const seciliSofra = sofra ? sofralar.find((t) => t.id === sofra) : undefined
  // Sofralarim aramasi: sofra adi (ve notu) ile o sofradaki tariflerin basliklari
  const sofralarGorunen = arama
    ? sofralar.filter((t) =>
        esles(arama, `${t.name} ${t.notes ?? ''} ${tarifler.filter((r) => r.tableIds.includes(t.id!)).map((r) => r.title).join(' ')}`)
      )
    : sofralar
  const gorunenHam = tarifler.filter((r) => {
    if (sofra && !r.tableIds.includes(sofra)) return false
    if (filtre === 'yeni' && r.createdAt < yeniSinir) return false
    if (filtre === 'favori' && !r.favorite) return false
    if (filtre === 'begeni' && !r.etkilesim?.puan) return false
    if (filtre !== 'hepsi' && filtre !== 'yeni' && filtre !== 'favori' && filtre !== 'begeni' && !r.tags.includes(filtre)) return false
    if (!arama) return true
    return esles(arama, `${r.title} ${r.ingredients.join(' ')} ${r.tags.join(' ')} ${r.author}`)
  })
  // Her listede (arama ve "Yeni" dahil) en begenilen once
  const gorunen = [...gorunenHam].sort(
          (a, b) =>
            (b.etkilesim?.puan ?? 0) - (a.etkilesim?.puan ?? 0) ||
            (b.etkilesim?.begeni ?? 0) - (a.etkilesim?.begeni ?? 0) ||
            b.createdAt - a.createdAt
        )

  return (
    <div>
      <Header
        title={
          <span className="flex items-center gap-2 min-w-0">
            <Logo className="w-7 h-7 flex-shrink-0" /> <span className="truncate text-[28px] leading-none">Lezzet Rotası</span>
          </span>
        }
        subtitle={`${tarifler.length} tarif · ${mekanSayisi} mekan`}
      >
          <label className="relative block">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#444] dark:text-[#d4d4d8]">
              <Icon name="search" className="w-[20px] h-[20px]" />
            </span>
            <input
              className="lz-arama"
              placeholder={IPUCU[sekme]}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onFocus={() => setAramaOdak(true)}
              onBlur={() => {
                setTimeout(() => setAramaOdak(false), 150)
                sonAramaEkle(aramaTuru, q)
              }}
              onKeyDown={(e) => e.key === 'Enter' && sonAramaEkle(aramaTuru, q)}
            />
          </label>
          {aramaOdak && !q && sonAramalar(aramaTuru).length > 0 && (
            <SonAramalar key={aramaTuru} tur={aramaTuru} sec={(x) => setQ(x)} />
          )}
      </Header>

      <div className="px-4 space-y-3">
        {/* Hizli erisim: emojisiz, ayni boyda simgeli kutular */}
        <div className="grid grid-cols-3 gap-3">
          {(
            [
              ['/ne-pisirsem', 'sparkle', 'Ne pişirsem'],
              ['/hype', 'star', 'Hype tarifler'],
              ['/mekanlar', 'pin', 'Mekanlar'],
              ['/takip', 'users', 'Influencer'],
              ['/diyet', 'leaf', 'Diyetim'],
              ['/sira', 'inbox', 'Sıra']
            ] as const
          ).map(([to, ikon, ad]) => (
            <Link
              key={to}
              to={to}
              onClick={(e) => {
                // Mekanlar kutusu ayni ekrandaki Mekanlarım sekmesine atlar
                if (to !== '/mekanlar') return
                e.preventDefault()
                sekmeyeGec('mekanlar')
              }}
              className="lz-card relative flex flex-col items-center justify-center gap-1.5 px-1.5 py-2.5 min-h-[76px] min-w-0 text-center active:scale-[0.97] transition"
            >
              {/* Simge ustte, yazi altta tam genislikte: sozcuk ortasindan bolunmez */}
              <span className="lz-ikon-kutu w-8 h-8">
                <Icon name={ikon} className="w-[18px] h-[18px]" />
              </span>
              {/* 14 px siyah kalin; sigmazsa bosluktan 2 satira iner (sozcuk bolunmez) */}
              <span className="text-[14px] font-bold leading-tight tracking-[-0.02em] text-black dark:text-white [overflow-wrap:normal] [word-break:normal]">{ad}</span>
              {to === '/sira' && <SiraRozeti />}
              {to === '/takip' && adaylar().length > 0 && (
                <span className="absolute -top-2 -right-2 min-w-[22px] h-[22px] px-1.5 rounded-full bg-lz-600 text-white text-[12px] font-extrabold flex items-center justify-center ring-2 ring-white dark:ring-[#111113] shadow-sm">
                  {adaylar().length}
                </span>
              )}
            </Link>
          ))}
        </div>
        <DurumSeridi
          yakindakiler={() => {
            sekmeyeGec('mekanlar')
            setYakinIstek(Date.now())
          }}
        />

        {/* Tariflerim / Mekanlarım / Sofralarım: esit genislik, tek satir, 48 px; sayilar gercek kayitlardan */}
        <div ref={sekmeRef} role="tablist" className="grid grid-cols-3 gap-1 bg-[#EDEDED] dark:bg-[#26262a] rounded-xl p-1 scroll-mt-[150px]">
          {SEKMELER.map((x) => {
            const sayi = x === 'tarifler' ? tarifler.length : x === 'mekanlar' ? mekanSayisi : sofralar.length
            return (
              <button
                key={x}
                role="tab"
                aria-selected={sekme === x}
                data-sekme={x}
                onClick={() => setSekme(x)}
                className={`h-[48px] min-w-0 px-1 overflow-hidden rounded-[10px] flex items-center justify-center gap-[3px] whitespace-nowrap transition ${
                  // Secili: beyaz, siyah kalin, altta 3 px domates cizgi. Degil: #EDEDED, #222 kalin (sayi da ayni koyulukta)
                  sekme === x
                    ? 'bg-white dark:bg-[#3a3a40] text-black dark:text-white shadow-[0_1px_3px_rgba(0,0,0,0.12),inset_0_-3px_0_#d93d20]'
                    : 'bg-[#EDEDED] dark:bg-[#26262a] text-[#222] dark:text-[#e4e4e7]'
                }`}
              >
                <span className="text-[13px] max-[350px]:text-[12px] font-bold tracking-[-0.02em]">{SEKME_AD[x]}</span>
                <span className="text-[11.5px] max-[350px]:text-[10.5px] font-bold tabular-nums">({sayi})</span>
              </button>
            )
          })}
        </div>

        <div onTouchStart={kaydirBasla} onTouchEnd={kaydirBitir} className="space-y-3 min-h-[50vh]">
        {sekme === 'tarifler' ? (
          <>
            {/* Sofradan gelindiyse secili sofra (Sofra ekle yalnizca Sofralarım sekmesinde) */}
            {seciliSofra && (
              <div className="flex">
                <button className="lz-chip !bg-lz-600 !border-lz-600 !text-white" onClick={() => setSofra(0)}>
                  Sofra: {seciliSofra.name} ✕
                </button>
              </div>
            )}

            {/* Filtreler: hepsi tam gorunsun (yarim cip yok); satira sigmazsa alta gecer */}
            <div className="grid grid-cols-2 gap-2">
              <Chip on={filtre === 'hepsi'} onClick={() => setFiltre('hepsi')} label="Tüm Tarifler" />
              <Chip on={filtre === 'yeni'} onClick={() => setFiltre('yeni')} label="Yeni" />
              <Chip on={filtre === 'favori'} onClick={() => setFiltre('favori')} label="★ Favoriler" />
              <Chip on={filtre === 'begeni'} onClick={() => setFiltre('begeni')} label="En beğenilen" />
            </div>
            {etiketler.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {(tumEtiket ? etiketler : etiketler.slice(0, 6)).map((e) => (
                  <button key={e} className={`lz-etiket ${filtre === e ? 'lz-etiket-on' : ''}`} onClick={() => setFiltre(filtre === e ? 'hepsi' : e)} data-etiket>
                    {e}
                  </button>
                ))}
                {etiketler.length > 6 && (
                  <button className="lz-etiket lz-etiket-daha" onClick={() => setTumEtiket(!tumEtiket)} data-etiket-daha>
                    {tumEtiket ? 'Daha az' : `+${etiketler.length - 6} etiket`}
                  </button>
                )}
              </div>
            )}

            {tarifHam === undefined ? (
              <IskeletKartlar adet={4} izgara />
            ) : tarifler.length === 0 ? (
              <BosDefter />
            ) : gorunen.length === 0 ? (
              <div className={`lz-card p-6 text-center text-sm ${T_SOLUK}`}>
                {filtre === 'begeni' ? 'Paylaşımların beğeni sayıları okunuyor; biraz sonra burada sıralanır.' : 'Bu seçime uyan tarif yok.'}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 pb-4">
                {gorunen.map((r) => (
                  <RecipeCard key={r.id} r={r} />
                ))}
              </div>
            )}
          </>
        ) : sekme === 'mekanlar' ? (
          <Mekanlar gomulu disArama={q} yakinIstek={yakinIstek} />
        ) : (
          <>
            {/* Sofra daireleri ve "Sofra ekle" yalnizca burada */}
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4">
              {sofralarGorunen.map((t) => {
                const on = sofra === t.id
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      setSofra(t.id!)
                      setFiltre('hepsi')
                      setSekmeHam('tarifler') // hatirlanan sekme degismez
                    }}
                    className="flex flex-col items-center gap-1 flex-shrink-0 w-16"
                  >
                    <SofraRozet ad={t.name} className="w-14 h-14 text-[18px]" secili={on} />
                    <span className={`text-[11.5px] truncate w-full text-center ${on ? 'text-lz-600 font-semibold' : T_SOLUK}`}>{t.name}</span>
                  </button>
                )
              })}
              <button onClick={() => setYeniSofra(true)} className="flex flex-col items-center gap-1 flex-shrink-0 w-16" data-sofra-ekle>
                <span className="w-14 h-14 rounded-full flex items-center justify-center border-2 border-dashed border-[#71717a] dark:border-[#a1a1aa] text-[#52525b] dark:text-[#d4d4d8]">
                  <Icon name="plus" />
                </span>
                <span className={`text-[11.5px] font-semibold whitespace-nowrap ${T_BASLIK}`}>Sofra ekle</span>
              </button>
            </div>
            {arama && sofralarGorunen.length === 0 && <div className={`lz-card p-6 text-center text-sm ${T_SOLUK}`}>Bu aramaya uyan sofra yok.</div>}
          <SofraListesi
            sofralar={sofralarGorunen}
            tarifler={tarifler}
            onAc={(id) => {
              setSofra(id)
              setFiltre('hepsi')
              setSekmeHam('tarifler') // hatirlanan sekme degismez
            }}
            onYeni={() => setYeniSofra(true)}
            onDuzenle={(t) => setDuzenSofra(t)}
          />
          </>
        )}
        </div>
      </div>

      <YeniSofra open={yeniSofra} onClose={() => setYeniSofra(false)} />
      <YeniSofra open={!!duzenSofra} duzenle={duzenSofra ?? undefined} onClose={() => setDuzenSofra(null)} />
    </div>
  )
}

function Chip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`lz-chip justify-center min-w-0 ${on ? 'lz-chip-on' : ''}`}>
      {label}
    </button>
  )
}

// Tarif karti: fotograf ustte, baslik en fazla 2 satir, sure ve malzeme hep ayni hizada.
// Fotograf yoksa ayni boyda varsayilan kapak; ayni satirdaki iki kart ayni yukseklikte.
const VIDEO_PLATFORM = new Set(['instagram', 'tiktok', 'youtube', 'facebook'])
function RecipeCard({ r }: { r: LzRecipe }) {
  const meta = [sureYaz(r.minutes), r.ingredients.length ? `${r.ingredients.length} malzeme` : ''].filter(Boolean).join(' · ')
  const fotoVar = !!r.photo
  return (
    <div className="lz-card overflow-hidden flex flex-col min-w-0">
      <div className="relative">
        <Link to={`/tarif/${r.id}`} aria-label={r.title} className="block">
          <Thumb src={r.photo} className="w-full rounded-none aspect-[4/3]" />
        </Link>
        <button
          onClick={() => r.id && toggleFavorite(r.id)}
          className={`absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 dark:bg-black/55 backdrop-blur flex items-center justify-center shadow-sm ${r.favorite ? 'text-amber-400' : 'text-[#71717a] dark:text-[#d4d4d8]'}`}
          aria-label={r.favorite ? 'Favoriden çıkar' : 'Favoriye ekle'}
        >
          <svg viewBox="0 0 24 24" className="w-[16px] h-[16px]" fill={r.favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
            <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9L3.5 9.7l5.9-.8z" strokeLinejoin="round" />
          </svg>
        </button>
        {fotoVar && VIDEO_PLATFORM.has(r.platform) && (
          // Videodan gelen tarif: ortada yari saydam oynat isareti (fotografi kapatmaz)
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="w-12 h-12 rounded-full bg-black/45 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-5 h-5 ml-0.5 text-white" fill="currentColor" aria-hidden="true">
                <path d="M8 5.5v13l11-6.5z" />
              </svg>
            </span>
          </span>
        )}
        {r.etkilesim?.puan ? (
          <span className="absolute bottom-2 left-2 text-[11.5px] font-bold px-2 py-0.5 rounded-full bg-black/60 text-white">★ {r.etkilesim.puan}/10</span>
        ) : null}
      </div>
      <Link to={`/tarif/${r.id}`} className="p-2.5 flex flex-col gap-1 flex-1 min-w-0">
        {/* 2 satirlik sabit yukseklik: kisa basliklarda da alttaki bilgiler ayni hizada */}
        <div className={`font-semibold text-[14.5px] leading-[1.3] line-clamp-2 min-h-[2.6em] ${T_BASLIK}`}>{r.title}</div>
        <div className={`text-[12px] min-h-[1.4em] truncate ${T_SOLUK}`}>{meta}</div>
        <div className="mt-auto pt-0.5 min-w-0">
          <PlatformLabel r={r} />
        </div>
      </Link>
    </div>
  )
}

// Sira ve yakindaki mekanlar ayni seritte, iki ayri dokunulabilir parca; sigmazsa 2 satira iner (… ile kesilmez)
function DurumSeridi({ yakindakiler }: { yakindakiler: () => void }) {
  const s = useSiraOzeti()
  const yakin = useYakinMekanSayisi()
  const mekanVar = (useLiveQuery(() => lzDb.mekanlar.count(), [], 0) ?? 0) > 0
  const sira = s.bekleyen || s.hata || s.biten
  if (!sira && !mekanVar) return null
  // Ayrac: iki parca ayri dokunulabilir; arada ince dikey cizgi
  const ayrac = <span className="w-px my-2 bg-[#D8D0C8] dark:bg-[#4a4a52]" aria-hidden="true" />
  const parca = 'min-h-[44px] px-1 flex items-center text-left text-[13.5px] leading-snug font-bold active:opacity-70'
  return (
    <div className="lz-card !border-l-4 !border-l-lz-600 pl-2.5 pr-2 py-1 min-h-[52px] flex items-center gap-2.5" data-durum-seridi>
      <span className={`lz-ikon-kutu w-8 h-8 ${s.hata && !s.bekleyen ? '!bg-rose-50 !text-rose-700 dark:!bg-[#2a1a1d]' : ''} ${s.bekleyen ? 'animate-pulse' : ''}`}>
        <Icon name={sira ? 'inbox' : 'pin'} className="w-[18px] h-[18px]" />
      </span>
      {/* Iki parca yan yana iki sutun (arada ince dikey cizgi); yazi sigmazsa kendi sutununda alt satira iner */}
      <span className={`flex-1 min-w-0 grid items-stretch gap-x-2 ${sira && mekanVar ? 'grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)]' : 'grid-cols-1'}`}>
        {sira ? (
          <Link to="/sira" className={`${parca} text-black dark:text-white`} data-serit-sira>
            {s.metin}
          </Link>
        ) : null}
        {sira && mekanVar ? ayrac : null}
        {!mekanVar ? null : yakin.durum === 'kapali' ? (
          // Konum yoksa sayi uydurulmaz
          <button onClick={() => void merkezAl(true)} className={`${parca} text-lz-700 dark:text-[#ff9f88]`} data-yakin="kapali">
            <span>
              <span className="text-[#333] dark:text-[#d4d4d8] font-semibold">Konum kapalı · </span>Konumumu bul
            </span>
          </button>
        ) : yakin.durum === 'tamam' ? (
          <button onClick={yakindakiler} className={`${parca} text-lz-700 dark:text-[#ff9f88]`} data-yakin={yakin.sayi}>
            {yakin.sayi ? `Yakınında ${yakin.sayi} mekan var` : `${YAKIN_SERIT_KM} km içinde mekan yok`}
          </button>
        ) : (
          <span className={`${parca} font-semibold ${T_SOLUK}`} data-yakin="aliniyor">
            Konum alınıyor…
          </span>
        )}
      </span>
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
      <div className="grid grid-cols-2 gap-3">
        {sofralar.map((t) => {
          const icindekiler = tarifler.filter((r) => r.tableIds.includes(t.id!))
          return (
            <div key={t.id} className="lz-card p-3 relative">
              <button onClick={() => onAc(t.id!)} className="text-left w-full">
                <div className="flex -space-x-3 mb-2">
                  {icindekiler.slice(0, 3).map((r) => (
                    <Thumb key={r.id} src={r.photo} className="w-11 h-11 rounded-full ring-2 ring-white dark:ring-[#1c1c1f] text-lg" />
                  ))}
                  {icindekiler.length === 0 && (
                    <SofraRozet ad={t.name} className="w-11 h-11 text-[15px]" />
                  )}
                </div>
                <div className={`font-semibold truncate ${T_BASLIK}`}>{t.name}</div>
                <div className={`text-[12px] ${T_SOLUK}`}>{icindekiler.length} tarif</div>
                {t.notes && <div className={`text-[11.5px] mt-1 line-clamp-2 ${T_SOLUK}`}>{t.notes}</div>}
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
          className="rounded-[22px] border-2 border-dashed border-[#dcdbd7] dark:border-[#3a3a40] p-3 flex flex-col items-center justify-center gap-1 min-h-[120px] text-[#5f5f68] dark:text-[#a1a1aa]"
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
        {ad.trim() && (
          <div className={`flex items-center gap-3 text-[13px] ${T_SOLUK}`}>
            <SofraRozet ad={ad} className="w-12 h-12 text-[16px]" /> Sofrada böyle görünecek
          </div>
        )}
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

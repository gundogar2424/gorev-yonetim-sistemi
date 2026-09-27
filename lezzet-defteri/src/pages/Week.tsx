import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { addPlan, addToShopping, listRecipes, lzDb } from '../db'
import type { LzMeal, LzPlan, LzRecipe } from '../types'
import { Header, Icon, Sheet, T_BASLIK, T_GOVDE, T_SOLUK, Thumb, Toast, useToast } from '../components/ui'
import { aiHaftalikMenu, apiAnahtari, profilMetni } from '../lib/ai'
import { GUN_ADI, OGUNLER, gunAnahtari, gunEkle, haftaBasi, kisaTarih } from '../lib/dates'

// BU HAFTA: pazartesiden pazara yemek plani. Her gune kahvalti/ogle/aksam
// icin tarif eklenir; haftanin tum malzemeleri tek dokunusla alisverise gider.
export default function Week() {
  const [kaydir, setKaydir] = useState(0) // 0 = bu hafta, 1 = gelecek hafta...
  const bas = gunEkle(haftaBasi(new Date()), kaydir * 7)
  const gunler = Array.from({ length: 7 }, (_, i) => gunEkle(bas, i))
  const ilk = gunAnahtari(gunler[0])
  const son = gunAnahtari(gunler[6])
  const bugun = gunAnahtari(new Date())

  const planlar = useLiveQuery(() => lzDb.plans.where('date').between(ilk, son, true, true).toArray(), [ilk, son], [] as LzPlan[]) ?? []
  const tarifler = useLiveQuery(() => listRecipes(), [], [] as LzRecipe[]) ?? []
  const tarifMap = new Map(tarifler.map((r) => [r.id!, r]))
  const [secim, setSecim] = useState<{ date: string; meal: LzMeal } | null>(null)
  const [toast, goster] = useToast()
  const [sihirAc, setSihirAc] = useState(false)

  const haftaMalzeme = async () => {
    let n = 0
    for (const p of planlar) {
      const r = tarifMap.get(p.recipeId)
      if (r) n += await addToShopping(r.ingredients, r.id!, r.title)
    }
    goster(n ? `${n} malzeme alışveriş listesine eklendi` : 'Eklenecek yeni malzeme yok')
  }

  const baslik = kaydir === 0 ? 'Bu Hafta' : kaydir === 1 ? 'Gelecek Hafta' : kaydir === -1 ? 'Geçen Hafta' : `${kisaTarih(gunler[0])} haftası`

  return (
    <div>
      <Header
        title={baslik}
        subtitle={`${kisaTarih(gunler[0])} – ${kisaTarih(gunler[6])} · ${planlar.length} yemek`}
        right={
          <>
            <button onClick={() => setKaydir(kaydir - 1)} className="w-10 h-10 rounded-full bg-white dark:bg-[#221d1a] flex items-center justify-center" aria-label="Önceki hafta">
              <Icon name="back" />
            </button>
            <button onClick={() => setKaydir(kaydir + 1)} className="w-10 h-10 rounded-full bg-white dark:bg-[#221d1a] flex items-center justify-center" aria-label="Sonraki hafta">
              <Icon name="back" className="w-5 h-5 rotate-180" />
            </button>
          </>
        }
      />

      <div className="px-4 space-y-2.5 pb-6">
        <Link to="/diyet" className="lz-card p-3.5 flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-[#10261e] flex items-center justify-center text-xl">🥗</span>
          <span className="flex-1">
            <span className={`block font-semibold ${T_BASLIK}`}>Diyetim</span>
            <span className={`block text-[12px] ${T_SOLUK}`}>Diyetisyen planın · öğüne uygun tarif bul</span>
          </span>
          <Icon name="back" className={`w-5 h-5 rotate-180 ${T_SOLUK}`} />
        </Link>
        <div className={`grid gap-2 ${planlar.length > 0 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <button className="lz-btn-primary text-sm px-3" onClick={() => setSihirAc(true)}>
            ✨ Sihirli menü
          </button>
          {planlar.length > 0 && (
            <button className="lz-btn-soft text-sm px-3" onClick={() => void haftaMalzeme()}>
              <Icon name="cart" className="w-4 h-4" /> Malzemeleri listeye ekle
            </button>
          )}
        </div>

        {gunler.map((g, gi) => {
          const anahtar = gunAnahtari(g)
          const gunPlan = planlar.filter((p) => p.date === anahtar)
          const bugunMu = anahtar === bugun
          return (
            <div key={anahtar} className={`lz-card p-3.5 ${bugunMu ? 'ring-2 ring-lz-500' : ''}`}>
              <div className="flex items-baseline justify-between mb-2">
                <div className={`font-bold ${T_BASLIK}`}>
                  {GUN_ADI[gi]} {bugunMu && <span className="lz-pill ml-1 align-middle">Bugün</span>}
                </div>
                <div className={`text-[12px] ${T_SOLUK}`}>{kisaTarih(g)}</div>
              </div>
              <div className="space-y-1.5">
                {OGUNLER.map((o) => {
                  const bu = gunPlan.filter((p) => p.meal === o.id)
                  return (
                    <div key={o.id} className="flex items-start gap-2">
                      <span className={`w-[78px] flex-shrink-0 whitespace-nowrap text-[12px] pt-2 ${T_SOLUK}`}>
                        {o.emoji} {o.ad}
                      </span>
                      <div className="flex-1 min-w-0 flex flex-wrap gap-1.5">
                        {bu.map((p) => {
                          const r = tarifMap.get(p.recipeId)
                          if (!r) return null
                          return (
                            <span key={p.id} className="inline-flex items-center gap-1.5 bg-[#f6ece2] dark:bg-[#2a2420] rounded-full pl-1 pr-1 py-1 max-w-full">
                              <Thumb src={r.photo} className="w-6 h-6 rounded-full text-xs" />
                              <Link to={`/tarif/${r.id}`} className={`text-[13px] font-medium truncate ${T_BASLIK}`}>
                                {r.title}
                              </Link>
                              <button onClick={() => void lzDb.plans.delete(p.id!)} className={`w-5 h-5 flex items-center justify-center ${T_SOLUK}`} aria-label="Plandan çıkar">
                                <Icon name="x" className="w-3.5 h-3.5" />
                              </button>
                            </span>
                          )
                        })}
                        <button
                          onClick={() => setSecim({ date: anahtar, meal: o.id })}
                          className="w-8 h-8 rounded-full border border-dashed border-[#e3d6c9] dark:border-[#3a322d] text-[#b3a69b] flex items-center justify-center"
                          aria-label={`${o.ad} ekle`}
                        >
                          <Icon name="plus" className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <TarifSec
        open={!!secim}
        tarifler={tarifler}
        onClose={() => setSecim(null)}
        onSec={async (r) => {
          if (secim) await addPlan(secim.date, secim.meal, r.id!)
          setSecim(null)
        }}
      />
      <SihirliMenu
        open={sihirAc}
        onClose={() => setSihirAc(false)}
        tarifler={tarifler}
        planlar={planlar}
        gunler={gunler}
        bugun={bugun}
        onBitti={(n) => {
          setSihirAc(false)
          goster(n ? `${n} öğün plana eklendi` : 'Eklenecek boş öğün bulunamadı')
        }}
      />
      <Toast text={toast} />
    </div>
  )
}

// SIHIRLI MENU: haftanin BOS ogunlerini kayitli tariflerle doldurur. Yapay zeka
// aciksa aile tercihlerine (sofra notlari) gore cesitli bir menu kurar;
// kapaliysa tekrar etmeyen rastgele bir secim yapar.
function SihirliMenu({
  open,
  onClose,
  tarifler,
  planlar,
  gunler,
  bugun,
  onBitti
}: {
  open: boolean
  onClose: () => void
  tarifler: LzRecipe[]
  planlar: LzPlan[]
  gunler: Date[]
  bugun: string
  onBitti: (n: number) => void
}) {
  const [ogunler, setOgunler] = useState<LzMeal[]>(['aksam'])
  const [calisiyor, setCalisiyor] = useState(false)
  const [hata, setHata] = useState('')
  const sofralar = useLiveQuery(() => lzDb.sofralar.toArray(), [], []) ?? []
  const aiVar = !!apiAnahtari()

  const bosMu = (gi: number, o: LzMeal) => !planlar.some((p) => p.date === gunAnahtari(gunler[gi]) && p.meal === o)
  const gunIdx = gunler.map((_, i) => i).filter((i) => gunAnahtari(gunler[i]) >= bugun)

  const olustur = async () => {
    setHata('')
    setCalisiyor(true)
    try {
      let secim: { gun: number; ogun: LzMeal; tarifId: number }[] = []
      if (aiVar) {
        secim = await aiHaftalikMenu(
          tarifler.map((r) => ({ id: r.id!, baslik: r.title, etiketler: r.tags, malzemeler: r.ingredients.slice(0, 8).join(', ') })),
          profilMetni(sofralar),
          ogunler,
          gunIdx
        )
      } else {
        // Rastgele: kahvaltiya "Kahvaltılık" etiketliler oncelikli, tekrar yok (tarif yetmezse basa sar)
        for (const o of ogunler) {
          const havuz = tarifler.filter((r) => (o === 'kahvalti') === r.tags.includes('Kahvaltılık'))
          const kaynak = (havuz.length ? havuz : tarifler).slice().sort(() => Math.random() - 0.5)
          gunIdx.forEach((g, k) => kaynak.length && secim.push({ gun: g, ogun: o, tarifId: kaynak[k % kaynak.length].id! }))
        }
      }
      let n = 0
      for (const x of secim) {
        if (!bosMu(x.gun, x.ogun)) continue
        await addPlan(gunAnahtari(gunler[x.gun]), x.ogun, x.tarifId)
        n++
      }
      onBitti(n)
    } catch (e) {
      setHata((e as Error).message)
    }
    setCalisiyor(false)
  }

  return (
    <Sheet open={open} onClose={onClose} title="✨ Sihirli menü">
      {tarifler.length < 3 ? (
        <p className={`text-sm py-4 ${T_SOLUK}`}>Menü kurabilmek için defterinde en az 3 tarif olmalı.</p>
      ) : (
        <div className="space-y-4">
          <p className={`text-[13px] ${T_GOVDE}`}>
            {aiVar
              ? 'Defterindeki tariflerden, sofralarına yazdığın tercihlere uygun, çeşitli bir menü kurulur. Yalnızca boş öğünler doldurulur.'
              : 'Defterindeki tariflerden tekrar etmeyen bir menü kurulur (yapay zeka açılırsa aile tercihlerine göre seçer). Yalnızca boş öğünler doldurulur.'}
          </p>
          <div>
            <div className="lz-label mb-2">Hangi öğünler?</div>
            <div className="flex gap-2">
              {OGUNLER.map((o) => {
                const on = ogunler.includes(o.id)
                return (
                  <button
                    key={o.id}
                    onClick={() => setOgunler(on ? ogunler.filter((x) => x !== o.id) : [...ogunler, o.id])}
                    className={`lz-chip flex-1 justify-center ${on ? 'lz-chip-on' : ''}`}
                  >
                    {o.emoji} {o.ad}
                  </button>
                )
              })}
            </div>
          </div>
          <p className={`text-[12px] ${T_SOLUK}`}>{gunIdx.length} gün planlanacak.</p>
          {hata && <div className="rounded-2xl bg-rose-50 dark:bg-[#2a1a1d] text-rose-700 dark:text-rose-300 text-sm p-3">{hata}</div>}
          <button className="lz-btn-primary w-full" disabled={calisiyor || !ogunler.length || !gunIdx.length} onClick={() => void olustur()}>
            {calisiyor ? 'Menü hazırlanıyor…' : 'Menüyü oluştur'}
          </button>
        </div>
      )}
    </Sheet>
  )
}

function TarifSec({ open, tarifler, onClose, onSec }: { open: boolean; tarifler: LzRecipe[]; onClose: () => void; onSec: (r: LzRecipe) => void }) {
  const [q, setQ] = useState('')
  const a = q.trim().toLocaleLowerCase('tr')
  const liste = tarifler.filter((r) => !a || r.title.toLocaleLowerCase('tr').includes(a))
  return (
    <Sheet open={open} onClose={onClose} title="Tarif seç">
      {tarifler.length === 0 ? (
        <div className={`text-sm text-center py-6 ${T_SOLUK}`}>
          Önce deftere tarif ekle.{' '}
          <Link to="/ekle" className="text-lz-600 font-semibold">
            Tarif ekle
          </Link>
        </div>
      ) : (
        <>
          <input className="lz-input mb-3" placeholder="Ara…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="space-y-2">
            {liste.map((r) => (
              <button key={r.id} onClick={() => onSec(r)} className="lz-card p-2 flex items-center gap-3 w-full text-left active:scale-[0.99] transition">
                <Thumb src={r.photo} className="w-12 h-12 rounded-xl text-xl" />
                <span className={`font-medium flex-1 min-w-0 truncate ${T_BASLIK}`}>{r.title}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </Sheet>
  )
}

import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { lzDb, markCooked } from '../db'
import { PisirmeNotu } from '../components/PisirmeNotu'
import { T_BASLIK } from '../components/ui'
import { ppAdimOzeti, ppDenetle, type PpAdim } from '../lib/pisirici'
import { PpRozetleri } from '../components/PpParcalar'
import { PisirmeAlti, PisirmeUstCubuk, useMutfakModu } from '../components/Pisirme'

// PILAV PISIRICIDE PISIR: adim adim, buyuk yazi, sayac, sesli okuma, Mutfak Modu
export default function PpCook() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const r = useLiveQuery(() => lzDb.recipes.get(id), [id])
  const [i, setI] = useState(0)
  const [notAc, setNotAc] = useState(false) // Afiyet olsun! sonrasi "Nasil oldu?"
  const [kalan, setKalan] = useState(0)
  const [sayac, setSayac] = useState(false)
  const [mutfak, mutfakDegistir] = useMutfakModu()

  useEffect(() => {
    let kilit: { release: () => Promise<void> } | null = null
    const wl = (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock
    wl?.request('screen').then((k) => (kilit = k)).catch(() => {})
    return () => void kilit?.release().catch(() => {})
  }, [])
  useEffect(() => {
    if (!sayac) return
    const t = window.setInterval(() => {
      setKalan((k) => {
        if (k <= 1) {
          setSayac(false)
          try {
            navigator.vibrate?.([300, 150, 300, 150, 300])
          } catch {
            /* yok */
          }
          return 0
        }
        return k - 1
      })
    }, 1000)
    return () => window.clearInterval(t)
  }, [sayac])

  if (!r?.pp) return null
  const pp = ppDenetle(r.pp, r)
  const adimlar = pp.steps
  const a = adimlar[i]
  if (!a) return null
  const son = i === adimlar.length - 1
  const git = async (n: number) => {
    setSayac(false)
    setKalan(0)
    if (n >= adimlar.length) {
      setNotAc(true) // kaydedilince (notlu ya da notsuz) cikilir
      return
    }
    setI(Math.max(0, n))
  }
  const sn = a.dakika * 60
  const sayacYaz = (x: number) => `${Math.floor(x / 3600) ? `${Math.floor(x / 3600)}:` : ''}${String(Math.floor((x % 3600) / 60)).padStart(Math.floor(x / 3600) ? 2 : 1, '0')}:${String(x % 60).padStart(2, '0')}`

  return (
    <div className={`min-h-screen flex flex-col ${mutfak ? 'mutfak' : ''}`}>
      <PisirmeUstCubuk
        renk="pp"
        baslik={r.title}
        alt={`Pilav Pişirici · Adım ${i + 1} / ${adimlar.length}`}
        ilerleme={(i + 1) / adimlar.length}
        kapat={() => navigate(-1)}
        mutfak={mutfak}
        mutfakDegistir={mutfakDegistir}
      />
      <div className="flex-1 px-5 py-5 overflow-y-auto space-y-4">
        {a.ingredients && (
          <div className="lz-card p-3.5">
            <div className="lz-label mb-1">Hazneye</div>
            <div className={`text-[19px] font-semibold ${T_BASLIK}`}>{a.ingredients}</div>
          </div>
        )}
        <p className={`mutfak-adim text-[24px] leading-[1.55] font-medium ${T_BASLIK}`}>{a.text}</p>
        <PpRozetleri a={a} />
        {a.butonlar && (
          <div className="lz-card p-3.5 text-[17px] leading-relaxed">
            <b>Düğmeler:</b> {a.butonlar}
          </div>
        )}
        {a.bitince && <div className="rounded-2xl border-2 border-pp p-3 text-[16px] font-semibold text-pp-700 dark:text-[#e8bfae]">⏹ Bitince: {a.bitince}</div>}
        {a.tip && <p className="text-[15px] rounded-2xl bg-amber-50 dark:bg-[#33270f] text-amber-900 dark:text-amber-200 p-3">💡 {a.tip}</p>}
        {sn > 0 && (
          <div className="lz-card p-4 flex items-center gap-4">
            <div className={`text-[40px] leading-none font-bold tabular-nums flex-1 ${T_BASLIK}`}>{sayacYaz(kalan || sn)}</div>
            {sayac ? (
              <button className="lz-btn-soft" onClick={() => setSayac(false)}>
                Durdur
              </button>
            ) : (
              <button
                className="lz-btn-primary !bg-pp"
                onClick={() => {
                  setKalan(kalan || sn)
                  setSayac(true)
                }}
              >
                Sayaç
              </button>
            )}
          </div>
        )}
      </div>
      <PisirmeNotu
        open={notAc}
        onKaydet={async (not) => {
          
          setNotAc(false)
          await markCooked(r.id!, not)
          navigate(-1)
        }}
      />
      <PisirmeAlti
        renk="pp"
        ileriEtiket={son ? 'Afiyet olsun! ✓' : 'Sonraki ›'}
        ileri={() => void git(i + 1)}
        geriKapali={i === 0}
        geri={() => void git(i - 1)}
        buAdim={okunacak(a)}
        sonrakiAdim={adimlar[i + 1] ? `${i + 2}. adım. ${okunacak(adimlar[i + 1])}` : ''}
      />
    </div>
  )
}

const okunacak = (x: PpAdim) =>
  [x.ingredients ? `Hazneye: ${x.ingredients}.` : '', x.text, ppAdimOzeti(x) ? `Ayar: ${ppAdimOzeti(x).replace(/ · /g, ', ')}.` : '', x.butonlar, x.bitince ? `Bitince: ${x.bitince}` : '', x.tip]
    .filter(Boolean)
    .join(' ')

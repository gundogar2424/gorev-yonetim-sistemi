import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { lzDb } from '../db'
import type { LzMekan } from '../types'
import { Header, T_BASLIK, T_GOVDE, T_SOLUK } from '../components/ui'
import { bugunAyYil, odemeler, tlYaz } from '../lib/harcama'

const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

// HARCAMALARIM: ziyaretlerde "hesabi ben odedim" diye yazilan tutarlar — bu ay, bu yil, aylara ve mekanlara gore
export default function Harcamalarim() {
  const mekanlar = useLiveQuery(() => lzDb.mekanlar.toArray(), [], [] as LzMekan[]) ?? []
  const liste = odemeler(mekanlar)
  const { ay, yil } = bugunAyYil()
  const yillar = Array.from(new Set([yil, ...liste.map((o) => o.tarih.slice(0, 4))])).sort().reverse()
  const [secYil, setSecYil] = useState(yil)
  const top = (f: (t: string) => boolean) => liste.filter((o) => f(o.tarih)).reduce((t, o) => t + o.tutar, 0)
  const buAy = top((t) => t.startsWith(ay))
  const buYil = top((t) => t.startsWith(yil))
  const yilListe = liste.filter((o) => o.tarih.startsWith(secYil))
  const aylik = AYLAR.map((ad, i) => {
    const k = `${secYil}-${String(i + 1).padStart(2, '0')}`
    const l = yilListe.filter((o) => o.tarih.startsWith(k))
    return { ad, toplam: l.reduce((t, o) => t + o.tutar, 0), adet: l.length }
  })
  const enCok = Math.max(1, ...aylik.map((a) => a.toplam))
  const mekanBazli = Object.values(
    yilListe.reduce<Record<number, { m: LzMekan; toplam: number; adet: number }>>((acc, o) => {
      const r = (acc[o.mekan.id!] ??= { m: o.mekan, toplam: 0, adet: 0 })
      r.toplam += o.tutar
      r.adet++
      return acc
    }, {})
  ).sort((a, b) => b.toplam - a.toplam)

  return (
    <div>
      <Header title="Harcamalarım" subtitle="Dışarıda yemek için ödediklerim" back />
      <div className="px-4 space-y-3 pb-8">
        <div className="grid grid-cols-2 gap-2.5">
          {(
            [
              ['Bu ay', buAy],
              ['Bu yıl', buYil]
            ] as const
          ).map(([e, n]) => (
            <div key={e} className="lz-card p-4">
              <div className={`text-[12.5px] ${T_SOLUK}`}>{e}</div>
              <div className={`text-[22px] font-bold tracking-tight tabular-nums ${T_BASLIK}`}>{tlYaz(n)}</div>
            </div>
          ))}
        </div>
        {!liste.length && (
          <div className={`lz-card p-5 text-[13.5px] ${T_GOVDE}`}>
            Henüz tutar yok. Bir mekana gidince mekan sayfasında <b>Buraya gittim</b> formuna “Hesabı ben ödediysem” tutarını yaz; burada aylık ve
            yıllık toplanır.
          </div>
        )}
        {liste.length > 0 && (
          <>
            <div className="lz-card p-4 space-y-2.5">
              <div className="flex items-center gap-2">
                <div className={`flex-1 font-semibold ${T_BASLIK}`}>Aylara göre</div>
                <div className="flex gap-1">
                  {yillar.map((y) => (
                    <button key={y} className={`lz-chip text-[12px] !px-2.5 !py-1 ${secYil === y ? 'lz-chip-on' : ''}`} onClick={() => setSecYil(y)}>
                      {y}
                    </button>
                  ))}
                </div>
              </div>
              <div className={`text-[13px] ${T_SOLUK}`}>
                {secYil} toplamı: <b className={T_BASLIK}>{tlYaz(yilListe.reduce((t, o) => t + o.tutar, 0))}</b> · {yilListe.length} ziyaret
              </div>
              <div className="space-y-1.5">
                {aylik.map((a) => (
                  <div key={a.ad} className="flex items-center gap-2 text-[13px]">
                    <span className={`w-14 flex-shrink-0 ${T_GOVDE}`}>{a.ad}</span>
                    <span className="flex-1 h-2.5 rounded-full bg-[#efefed] dark:bg-[#26262a] overflow-hidden">
                      <span className="block h-full rounded-full bg-lz-500" style={{ width: `${(a.toplam / enCok) * 100}%` }} />
                    </span>
                    <span className={`w-24 text-right tabular-nums ${a.toplam ? `font-semibold ${T_BASLIK}` : T_SOLUK}`}>{a.toplam ? tlYaz(a.toplam) : '—'}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="lz-card p-4 space-y-1">
              <div className={`font-semibold mb-1 ${T_BASLIK}`}>{secYil} · mekanlara göre</div>
              {mekanBazli.map((r) => (
                <Link key={r.m.id} to={`/mekan/${r.m.id}`} className="flex items-center gap-2 py-1.5 text-[14px]">
                  <span className={`flex-1 min-w-0 truncate ${T_GOVDE}`}>
                    {r.m.ad} <span className={`text-[12px] ${T_SOLUK}`}>{r.adet} kez</span>
                  </span>
                  <span className={`font-semibold tabular-nums ${T_BASLIK}`}>{tlYaz(r.toplam)}</span>
                </Link>
              ))}
            </div>
            <div className="lz-card p-4 space-y-1">
              <div className={`font-semibold mb-1 ${T_BASLIK}`}>Son ödemeler</div>
              {liste.slice(0, 30).map((o, i) => (
                <Link key={i} to={`/mekan/${o.mekan.id}`} className="flex items-center gap-2 py-1.5 text-[14px]">
                  <span className={`w-20 flex-shrink-0 text-[12.5px] ${T_SOLUK}`}>{o.tarih.split('-').reverse().join('.')}</span>
                  <span className={`flex-1 min-w-0 truncate ${T_GOVDE}`}>{o.mekan.ad}</span>
                  <span className={`font-semibold tabular-nums ${T_BASLIK}`}>{tlYaz(o.tutar)}</span>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

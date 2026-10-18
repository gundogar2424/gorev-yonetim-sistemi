import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { lzDb } from '../db'
import type { LzMekan } from '../types'
import { Header, T_BASLIK, T_GOVDE, T_SOLUK, Thumb } from '../components/ui'
import { tlYaz } from '../lib/harcama'

const benimPuanim = (m: LzMekan) => {
  const p = (m.ziyaretler ?? []).filter((z) => z.puan)
  return p.length ? p.reduce((t, z) => t + z.puan, 0) / p.length : 0
}
const sonGidis = (m: LzMekan) => [...(m.ziyaretler ?? [])].sort((a, b) => b.tarih.localeCompare(a.tarih))[0]?.tarih ?? ''
const sehirAdi = (m: LzMekan) => m.sehir.trim() || 'Şehri bilinmeyen'
const semtAdi = (m: LzMekan) => m.ilce.trim() || 'Semt yok'

// GITTIGIM YERLER: sehir sehir, semt semt; her semtte benim puanima gore siralama
export default function Gittiklerim() {
  const hepsi = useLiveQuery(() => lzDb.mekanlar.toArray(), [], [] as LzMekan[]) ?? []
  const gidilen = hepsi.filter((m) => m.gidildi || (m.ziyaretler ?? []).length)
  const sehirler = Array.from(new Set(gidilen.map(sehirAdi))).sort((a, b) => a.localeCompare(b, 'tr'))
  const [sehir, setSehir] = useState('')
  const secili = gidilen.filter((m) => !sehir || sehirAdi(m) === sehir)
  const sirala = (l: LzMekan[]) => [...l].sort((a, b) => benimPuanim(b) - benimPuanim(a) || sonGidis(b).localeCompare(sonGidis(a)))

  // sehir -> semt -> mekanlar
  const gruplar = (sehir ? [sehir] : sehirler).map((s) => {
    const l = secili.filter((m) => sehirAdi(m) === s)
    const semtler = Array.from(new Set(l.map(semtAdi)))
      .map((t) => ({ ad: t, mekanlar: sirala(l.filter((m) => semtAdi(m) === t)) }))
      .sort((a, b) => benimPuanim(b.mekanlar[0]) - benimPuanim(a.mekanlar[0]) || a.ad.localeCompare(b.ad, 'tr'))
    return { ad: s, adet: l.length, semtler }
  })

  return (
    <div>
      <Header title="Gittiğim yerler" subtitle={gidilen.length ? `${gidilen.length} mekan · ${sehirler.length} şehir` : 'Ziyaret ettiğin mekanlar'} back />
      <div className="px-4 space-y-3 pb-8">
        {!gidilen.length && (
          <div className={`lz-card p-5 text-[13.5px] ${T_GOVDE}`}>
            Henüz gittiğin mekan yok. Bir mekanın sayfasında <b>Buraya gittim</b> deyip puan verdiğinde burada şehir ve semte göre listelenir.
          </div>
        )}
        {sehirler.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4">
            {['', ...sehirler].map((s) => (
              <button key={s || 'hepsi'} className={`lz-chip flex-shrink-0 text-[13px] ${sehir === s ? 'lz-chip-on' : ''}`} onClick={() => setSehir(s)}>
                {s || 'Tüm şehirler'}
              </button>
            ))}
          </div>
        )}
        {gruplar.map((g) => (
          <div key={g.ad} className="space-y-2">
            <div className={`px-1 text-[18px] font-bold tracking-tight ${T_BASLIK}`}>
              {g.ad} <span className={`text-[13px] font-medium ${T_SOLUK}`}>{g.adet} mekan</span>
            </div>
            {g.semtler.map((t) => (
              <div key={t.ad} className="lz-card p-3.5 space-y-1">
                <div className="lz-label mb-1">{t.ad}</div>
                {t.mekanlar.map((m, i) => {
                  const p = benimPuanim(m)
                  const odenen = (m.ziyaretler ?? []).reduce((s, z) => s + (z.tutar || 0), 0)
                  const son = sonGidis(m)
                  return (
                    <Link key={m.id} to={`/mekan/${m.id}`} className="flex items-center gap-3 py-1.5">
                      <span className={`w-5 text-center text-[13px] font-bold ${i === 0 && p ? 'text-lz-600' : T_SOLUK}`}>{i + 1}</span>
                      <Thumb src={m.foto} className="w-11 h-11 rounded-xl" />
                      <span className="flex-1 min-w-0">
                        <span className={`block font-semibold text-[14.5px] truncate ${T_BASLIK}`}>{m.ad}</span>
                        <span className={`block text-[12px] truncate ${T_SOLUK}`}>
                          {[m.tur, son && `son ${son.split('-').reverse().join('.')}`, (m.ziyaretler ?? []).length > 1 && `${m.ziyaretler!.length} kez`, odenen && tlYaz(odenen)]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </span>
                      <span className={`text-[14px] font-bold whitespace-nowrap ${p ? 'text-amber-600 dark:text-amber-300' : T_SOLUK}`}>
                        {p ? `★ ${p.toFixed(1).replace('.', ',')}` : 'puan yok'}
                      </span>
                    </Link>
                  )
                })}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

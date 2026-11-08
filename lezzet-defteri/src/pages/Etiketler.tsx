import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { lzDb } from '../db'
import type { LzMekan } from '../types'
import { Header, T_BASLIK, T_SOLUK } from '../components/ui'
import { esles } from '../lib/arama'

// ETIKETLER: mekan etiketleri ve mekanlarda yenen yemekler tek sayfada; dokununca o mekanlar yakindan uzaga
export default function Etiketler() {
  const mekanlar = useLiveQuery(() => lzDb.mekanlar.toArray(), [], [] as LzMekan[]) ?? []
  const [ara, setAra] = useState('')
  const q = ara.trim().toLocaleLowerCase('tr')

  const etiketSay = new Map<string, number>()
  for (const m of mekanlar) for (const e of m.etiketler) etiketSay.set(e, (etiketSay.get(e) ?? 0) + 1)
  const etiketler = [...etiketSay.entries()].filter(([e]) => esles(q, e)).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'tr'))

  // Yemekler: onerilenler + benim yediklerim + influencer'larin denedikleri; ayni yemek bir mekanda bir kez sayilir
  const yemekSay = new Map<string, { ad: string; n: number }>()
  for (const m of mekanlar) {
    const parca = [...m.oneriler, ...(m.ziyaretler ?? []).map((z) => z.yedim), m.paylasanYorumu?.yedi ?? '', ...(m.paylasimlar ?? []).map((p) => p.yorum?.yedi ?? '')]
      .flatMap((x) => x.split(/[,;\n]| ve /))
      .map((x) => x.replace(/\([^)]*\)/g, '').trim())
      .filter((x) => x.length >= 3 && x.length <= 40)
    for (const y of new Set(parca.map((x) => x.toLocaleLowerCase('tr')))) {
      const ad = parca.find((x) => x.toLocaleLowerCase('tr') === y)!
      const k = yemekSay.get(y)
      yemekSay.set(y, { ad: k?.ad ?? ad.charAt(0).toLocaleUpperCase('tr') + ad.slice(1), n: (k?.n ?? 0) + 1 })
    }
  }
  const yemekler = [...yemekSay.values()].filter((y) => esles(q, y.ad)).sort((a, b) => b.n - a.n || a.ad.localeCompare(b.ad, 'tr'))

  return (
    <div>
      <Header title="Etiketler" subtitle="Dokun: o mekanlar yakından uzağa" back />
      <div className="px-4 space-y-3 pb-8">
        <input className="lz-input py-2 text-[14px] w-full" placeholder="Ara: pide, kahvaltı, deniz ürünü…" value={ara} onChange={(e) => setAra(e.target.value)} />
        <div className="lz-card p-4 space-y-2.5">
          <div className={`font-semibold ${T_BASLIK}`}>
            Mekan etiketleri <span className={`text-[13px] font-medium ${T_SOLUK}`}>{etiketler.length}</span>
          </div>
          {!etiketler.length && <p className={`text-[13px] ${T_SOLUK}`}>Etiket yok. Mekan sayfasında “Düzenle” ile etiket ekleyebilirsin.</p>}
          <div className="flex flex-wrap gap-1.5">
            {etiketler.map(([e, n]) => (
              <Link key={e} to={`/mekanlar?etiket=${encodeURIComponent(e)}`} className="lz-chip text-[13.5px]">
                {e} <span className="opacity-60 ml-1">{n}</span>
              </Link>
            ))}
          </div>
        </div>
        <div className="lz-card p-4 space-y-2.5">
          <div className={`font-semibold ${T_BASLIK}`}>
            Yemekler <span className={`text-[13px] font-medium ${T_SOLUK}`}>{yemekler.length}</span>
          </div>
          <p className={`text-[12px] ${T_SOLUK}`}>Mekanlarda önerilen, senin yediğin ve influencer’ların denediği yemekler; sayı kaç mekanda geçtiği.</p>
          <div className="flex flex-wrap gap-1.5">
            {yemekler.slice(0, 150).map((y) => (
              <Link key={y.ad} to={`/mekanlar?yemek=${encodeURIComponent(y.ad)}`} className="lz-chip text-[13.5px]">
                {y.ad} {y.n > 1 && <span className="opacity-60 ml-1">{y.n}</span>}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

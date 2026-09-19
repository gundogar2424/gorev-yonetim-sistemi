// Akustik olcum sonucu: perde, jitter, shimmer, HNR — sade dille.
import { acousticComment, rateHnr, rateJitter, rateShimmer, type AcousticResult, type Level3 } from '../lib/acoustic'

function Rozet({ l }: { l: Level3 }) {
  const cls = l === 'iyi' ? 'bg-emerald-50 text-emerald-700 dark:bg-[#1f2e22] dark:text-emerald-300' : l === 'orta' ? 'bg-amber-50 text-amber-700 dark:bg-[#2b2418] dark:text-amber-200' : 'bg-rose-50 text-rose-700 dark:bg-[#2a1a1d] dark:text-rose-300'
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[13px] font-semibold ${cls}`}>{l === 'iyi' ? 'iyi' : l === 'orta' ? 'orta' : 'zayıf'}</span>
}

export default function AcousticCard({ ac, compact }: { ac: AcousticResult; compact?: boolean }) {
  const items: { ad: string; deger: string; aciklama: string; l: Level3 | null }[] = [
    { ad: 'Perde', deger: `${ac.f0} Hz`, aciklama: ac.f0sd > 0 ? `dalgalanma ±${String(ac.f0sd).replace('.', ',')} yarım ton` : 'sabit', l: null },
    { ad: 'Nefeslilik (HNR)', deger: `${String(ac.hnr).replace('.', ',')} dB`, aciklama: 'yüksek = tok, düşük = nefesli', l: rateHnr(ac.hnr) },
    { ad: 'Perde titremesi (jitter)', deger: `%${String(ac.jitter).replace('.', ',')}`, aciklama: 'düşük = kararlı', l: rateJitter(ac.jitter) },
    { ad: 'Şiddet titremesi (shimmer)', deger: `%${String(ac.shimmer).replace('.', ',')}`, aciklama: 'düşük = kararlı', l: rateShimmer(ac.shimmer) }
  ]
  return (
    <div className={`rounded-2xl bg-slate-50 dark:bg-[#352820] ${compact ? 'p-3' : 'p-4'}`}>
      <div className="ses-label mb-2">Ses kalitesi (akustik)</div>
      <ul className="divide-y divide-slate-200/70 dark:divide-[#4a3a30]">
        {items.map((it) => (
          <li key={it.ad} className="py-1.5 flex items-center gap-2">
            <span className="flex-1 min-w-0">
              <span className="block text-[15px] text-slate-700 dark:text-[#f5ece4]">{it.ad}</span>
              <span className="block text-[13px] text-slate-600 dark:text-[#cdbdb3]">{it.aciklama}</span>
            </span>
            <span className="text-[16px] font-bold tabular-nums text-slate-900 dark:text-[#f5ece4]">{it.deger}</span>
            {it.l && <Rozet l={it.l} />}
          </li>
        ))}
      </ul>
      {!compact && <p className="text-[14px] text-slate-700 dark:text-[#e2d5cd] mt-2">{acousticComment(ac)}</p>}
      {!compact && (
        <p className="text-[13px] text-slate-600 dark:text-[#cdbdb3] mt-1">
          Telefon mikrofonuyla ölçüldü: perde ve jitter güvenilir, shimmer ve HNR mikrofona/gürültüye duyarlı (2025 meta-analizi). Aynı telefon, aynı oda, aynı uzaklıkla ölçüp kendi geçmişinle karşılaştır; tanı koymaz.
        </p>
      )}
    </div>
  )
}

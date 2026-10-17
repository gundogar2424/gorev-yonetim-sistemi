import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { lzDb } from '../db'
import type { LzMekan } from '../types'
import { Header, T_BASLIK, T_GOVDE, T_SOLUK } from '../components/ui'
import { mesafeKm, mesafeYaz, telefonKonumu, type Konum } from '../lib/mekan'

const KEY = 'lz-gezi'
const PARCA = 4 // telefonda Google Haritalar tek linkte en fazla 3 ara durak + 1 varis kabul eder

type Kayit = { sehir: string; ids: number[] }
function oku(): Kayit {
  try {
    return { sehir: '', ids: [], ...(JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<Kayit>) }
  } catch {
    return { sehir: '', ids: [] }
  }
}
function yaz(k: Kayit): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(k))
  } catch {
    /* yok */
  }
}

const konumu = (m: LzMekan): Konum | undefined => (m.lat !== undefined && m.lon !== undefined ? { lat: m.lat, lon: m.lon } : undefined)

// Google Haritalar'in bulacagi durak: adres varsa ad + adres, yoksa koordinat, yoksa ad + sehir
function durak(m: LzMekan): string {
  if (m.adres) return [m.ad, m.adres, m.sehir].filter(Boolean).join(', ')
  const k = konumu(m)
  if (k) return `${k.lat},${k.lon}`
  return [m.ad, m.ilce, m.sehir].filter(Boolean).join(', ')
}

// Rota linkleri: ilk bolum bulundugun yerden baslar; sonrakiler bir oncekinin son durağindan
function rotaLinkleri(liste: LzMekan[]): string[] {
  const linkler: string[] = []
  for (let i = 0; i < liste.length; i += PARCA) {
    const parca = liste.slice(i, i + PARCA)
    const varis = parca[parca.length - 1]
    const ara = parca.slice(0, -1)
    const q = new URLSearchParams({ api: '1', destination: durak(varis), travelmode: 'driving' })
    if (i > 0) q.set('origin', durak(liste[i - 1]))
    if (ara.length) q.set('waypoints', ara.map(durak).join('|'))
    linkler.push(`https://www.google.com/maps/dir/?${q.toString()}`)
  }
  return linkler
}

// En yakin komsu: baslangictan (telefon konumu ya da ilk durak) her seferinde en yakini sec
function yakindanUzaga(liste: LzMekan[], bas?: Konum): LzMekan[] {
  const yerli = liste.filter((m) => konumu(m))
  const yersiz = liste.filter((m) => !konumu(m))
  const sonuc: LzMekan[] = []
  let simdiki = bas ?? (yerli[0] ? konumu(yerli[0]) : undefined)
  const kalan = [...yerli]
  while (kalan.length && simdiki) {
    let en = 0
    for (let i = 1; i < kalan.length; i++) if (mesafeKm(simdiki, konumu(kalan[i])!) < mesafeKm(simdiki, konumu(kalan[en])!)) en = i
    const [m] = kalan.splice(en, 1)
    sonuc.push(m)
    simdiki = konumu(m)
  }
  return [...sonuc, ...kalan, ...yersiz]
}

// YEMEK GEZISI PLANI: bir sehirdeki kayitli mekanlar secilir, yakindan uzaga siralanir,
// elle duzenlenir ve Google Haritalar'da durakli rota olarak acilir.
export default function GeziPlani() {
  const hepsi = useLiveQuery(() => lzDb.mekanlar.toArray(), [], [] as LzMekan[]) ?? []
  const [kayit, setKayit] = useState<Kayit>(oku())
  const [mesaj, setMesaj] = useState('')
  useEffect(() => yaz(kayit), [kayit])

  const sehirler = Array.from(new Set(hepsi.map((m) => m.sehir.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'tr'))
  const adaylar = hepsi
    .filter((m) => !kayit.sehir || m.sehir.trim().toLocaleLowerCase('tr') === kayit.sehir.toLocaleLowerCase('tr'))
    .sort((a, b) => Number(!!b.favori) - Number(!!a.favori) || a.ad.localeCompare(b.ad, 'tr'))
  const harita = new Map(hepsi.map((m) => [m.id!, m]))
  const secili = kayit.ids.map((id) => harita.get(id)).filter((m): m is LzMekan => !!m)

  const degis = (id: number) => setKayit((k) => ({ ...k, ids: k.ids.includes(id) ? k.ids.filter((x) => x !== id) : [...k.ids, id] }))
  const tasi = (i: number, yon: -1 | 1) =>
    setKayit((k) => {
      const ids = [...k.ids]
      const j = i + yon
      if (j < 0 || j >= ids.length) return k
      ;[ids[i], ids[j]] = [ids[j], ids[i]]
      return { ...k, ids }
    })
  const sirala = async () => {
    setMesaj('Konumun alınıyor…')
    let bas: Konum | undefined
    try {
      bas = await telefonKonumu(8000)
      setMesaj('Bulunduğun yerden en yakından uzağa sıralandı.')
    } catch {
      setMesaj('Konum alınamadı; ilk duraktan başlayarak yakından uzağa sıralandı.')
    }
    setKayit((k) => ({ ...k, ids: yakindanUzaga(secili, bas).map((m) => m.id!) }))
  }

  const linkler = secili.length ? rotaLinkleri(secili) : []
  const yersiz = secili.filter((m) => !konumu(m) && !m.adres)

  return (
    <div>
      <Header title="Yemek gezisi" subtitle={secili.length ? `${secili.length} durak` : 'Mekanlarını seç, rotanı çıkar'} back />
      <div className="px-4 space-y-3 pb-8">
        {/* 1) Sehir + mekan secimi */}
        <div className="lz-card p-4 space-y-2.5">
          <div className={`font-semibold ${T_BASLIK}`}>1. Nereye gidiyorsun?</div>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4">
            {['', ...sehirler].map((s) => (
              <button
                key={s || 'hepsi'}
                className={`lz-chip whitespace-nowrap flex-shrink-0 text-[13px] ${kayit.sehir === s ? 'lz-chip-on' : ''}`}
                onClick={() => setKayit((k) => ({ ...k, sehir: s }))}
              >
                {s || 'Tüm şehirler'}
              </button>
            ))}
          </div>
          {!hepsi.length && (
            <p className={`text-[13px] ${T_SOLUK}`}>
              Henüz kayıtlı mekan yok. <Link to="/mekanlar" className="text-lz-600 font-semibold underline">Mekanlarım</Link>’dan ekle.
            </p>
          )}
          <div className="space-y-1">
            {adaylar.map((m) => (
              <label key={m.id} className={`flex items-center gap-3 py-1.5 text-[14px] ${T_GOVDE}`}>
                <input type="checkbox" className="w-5 h-5 accent-[#d93d20]" checked={kayit.ids.includes(m.id!)} onChange={() => degis(m.id!)} />
                <span className="flex-1 min-w-0">
                  {m.favori ? '❤️ ' : ''}
                  {m.ad}
                  <span className={`block text-[12px] ${T_SOLUK}`}>{[m.tur, m.ilce].filter(Boolean).join(' · ')}</span>
                </span>
              </label>
            ))}
          </div>
          {adaylar.length > 0 && (
            <button className={`text-[13px] font-semibold text-lz-600`} onClick={() => setKayit((k) => ({ ...k, ids: Array.from(new Set([...k.ids, ...adaylar.map((m) => m.id!)])) }))}>
              Hepsini seç
            </button>
          )}
        </div>

        {/* 2) Rota */}
        {secili.length > 0 && (
          <div className="lz-card p-4 space-y-2.5">
            <div className="flex items-center gap-2">
              <div className={`flex-1 font-semibold ${T_BASLIK}`}>2. Rota sırası</div>
              <button className="lz-btn-soft px-3 py-1.5 text-[12.5px]" onClick={() => void sirala()}>
                📍 Yakından uzağa sırala
              </button>
            </div>
            {mesaj && <p className={`text-[12.5px] ${T_SOLUK}`}>{mesaj}</p>}
            <ol className="space-y-1.5">
              {secili.map((m, i) => {
                const onceki = i > 0 ? konumu(secili[i - 1]) : undefined
                const bu = konumu(m)
                return (
                  <li key={m.id} className="flex items-center gap-2 rounded-2xl bg-[#f3f3f1] dark:bg-[#26262a] px-3 py-2">
                    <span className="w-6 h-6 rounded-full bg-lz-600 text-white text-[12px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                    <Link to={`/mekan/${m.id}`} className={`flex-1 min-w-0 text-[14px] ${T_GOVDE}`}>
                      <span className="font-semibold">{m.ad}</span>
                      <span className={`block text-[11.5px] ${T_SOLUK}`}>
                        {onceki && bu ? `öncekinden ${mesafeYaz(mesafeKm(onceki, bu))}` : bu ? (m.ilce || m.sehir) : 'haritadaki yeri bilinmiyor'}
                      </span>
                    </Link>
                    <button className="w-8 h-8 rounded-full lz-btn-soft !p-0 text-[13px]" aria-label="Yukarı" disabled={i === 0} onClick={() => tasi(i, -1)}>
                      ↑
                    </button>
                    <button className="w-8 h-8 rounded-full lz-btn-soft !p-0 text-[13px]" aria-label="Aşağı" disabled={i === secili.length - 1} onClick={() => tasi(i, 1)}>
                      ↓
                    </button>
                    <button className="w-8 h-8 rounded-full lz-btn-soft !p-0 text-[13px]" aria-label="Çıkar" onClick={() => degis(m.id!)}>
                      ✕
                    </button>
                  </li>
                )
              })}
            </ol>
            {yersiz.length > 0 && (
              <p className="text-[12px] text-amber-700 dark:text-amber-300">⚠️ {yersiz.map((m) => m.ad).join(', ')}: adresi yok; Google Haritalar adından bulmaya çalışır.</p>
            )}
          </div>
        )}

        {/* 3) Google Haritalar */}
        {linkler.length > 0 && (
          <div className="lz-card p-4 space-y-2">
            <div className={`font-semibold ${T_BASLIK}`}>3. Yola çık</div>
            {linkler.map((l, i) => (
              <a key={i} href={l} target="_blank" rel="noreferrer" className="lz-btn-primary w-full text-[15px]">
                🗺️ {linkler.length > 1 ? `Bölüm ${i + 1}: ${i * PARCA + 1}–${Math.min((i + 1) * PARCA, secili.length)}. duraklar` : 'Google Haritalar’da rotayı aç'}
              </a>
            ))}
            <p className={`text-[12px] ${T_SOLUK}`}>
              {linkler.length > 1
                ? `Telefonda Google Haritalar tek seferde en fazla ${PARCA} durak açabildiği için rota bölümlere ayrıldı; bir bölüm bitince sıradakini aç.`
                : 'Rota bulunduğun yerden başlar; duraklar bu sırayla eklenir.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

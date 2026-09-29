import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { aiTarifDegistir, aiTarifSohbet, apiAnahtari, type SohbetMesaji, type TarifDegisikligi } from '../lib/ai'
import { T_GOVDE, T_SOLUK } from './ui'

type TarifOz = { title: string; servings: number; minutes: number; ingredients: string[]; steps: string[]; notes: string; tags: string[] }

export function konusmaIstegi(sohbet: SohbetMesaji[], son: string): string {
  if (!sohbet.length) return son
  return `Aşağıdaki konuşmada kararlaştırılanları tarife uygula.\n\n${sohbet
    .map((m) => `${m.rol === 'sen' ? 'KULLANICI' : 'ŞEF'}: ${m.metin}`)
    .join('\n\n')}${son ? `\n\nKULLANICININ SON İSTEĞİ: ${son}` : ''}`
}

export function SohbetBalonlari({ sohbet, soruyor }: { sohbet: SohbetMesaji[]; soruyor: boolean }) {
  if (!sohbet.length && !soruyor) return null
  return (
    <div className="space-y-2">
      {sohbet.map((m, i) => (
        <div
          key={i}
          className={`rounded-2xl px-3.5 py-2.5 text-[14.5px] leading-relaxed whitespace-pre-line max-w-[88%] ${
            m.rol === 'sen' ? 'ml-auto bg-lz-600 text-white rounded-br-md' : `lz-card rounded-bl-md ${T_GOVDE}`
          }`}
        >
          {m.metin}
        </div>
      ))}
      {soruyor && <div className={`lz-card rounded-2xl rounded-bl-md px-3.5 py-2.5 text-[14px] w-fit ${T_SOLUK}`}>Şef düşünüyor…</div>}
    </div>
  )
}

// Duzenleme ekraninda: tarif uzerine sohbet; karar verilince sonuc forma yazilir.
export function DuzenlemeSohbeti({
  tarif,
  profil,
  onUygula
}: {
  tarif: TarifOz
  profil: string
  onUygula: (s: TarifDegisikligi) => void
}) {
  const [sohbet, setSohbet] = useState<SohbetMesaji[]>([])
  const [istek, setIstek] = useState('')
  const [soruyor, setSoruyor] = useState(false)
  const [calisiyor, setCalisiyor] = useState(false)
  const [hata, setHata] = useState('')
  const alt = useRef<HTMLDivElement>(null)
  const aiVar = !!apiAnahtari()

  useEffect(() => {
    if (sohbet.length) alt.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [sohbet.length, soruyor])

  const sor = async () => {
    const soru = istek.trim()
    if (!soru) return
    setHata('')
    const yeni: SohbetMesaji[] = [...sohbet, { rol: 'sen', metin: soru }]
    setSohbet(yeni)
    setIstek('')
    setSoruyor(true)
    try {
      const cevap = await aiTarifSohbet(tarif, yeni, profil)
      setSohbet([...yeni, { rol: 'ai', metin: cevap || 'Cevap alınamadı, tekrar sorar mısın?' }])
    } catch (e) {
      setHata((e as Error).message)
      setSohbet(sohbet)
      setIstek(soru)
    }
    setSoruyor(false)
  }

  const uygula = async () => {
    setHata('')
    setCalisiyor(true)
    try {
      onUygula(await aiTarifDegistir(tarif, konusmaIstegi(sohbet, istek.trim()), profil))
    } catch (e) {
      setHata((e as Error).message)
    }
    setCalisiyor(false)
  }

  if (!aiVar)
    return (
      <p className={`text-[13px] ${T_SOLUK}`}>
        Bunun için{' '}
        <Link to="/ayarlar" className="underline font-semibold">
          Ayarlar
        </Link>
        ’dan Gemini anahtarı gerekli.
      </p>
    )

  return (
    <div className="space-y-3">
      {!sohbet.length && (
        <p className={`text-[13px] ${T_SOLUK}`}>
          Formdaki tarifin şu anki hali üzerine konuşursunuz. Karar verince “Tarife uygula” de; değişiklikler forma yazılır, sonra kaydedersin.
        </p>
      )}
      <SohbetBalonlari sohbet={sohbet} soruyor={soruyor} />
      {hata && <div className="rounded-2xl bg-rose-50 dark:bg-[#2a1a1d] text-rose-700 dark:text-rose-300 text-sm p-3">⚠️ {hata}</div>}
      <textarea
        className="lz-input min-h-[80px] text-[15px]"
        placeholder="Örn. Grek yoğurdu bizdeki süzme yoğurt mu?"
        value={istek}
        onChange={(e) => setIstek(e.target.value)}
      />
      <div className="grid grid-cols-2 gap-2.5">
        <button className="lz-btn-soft text-sm px-2" disabled={!istek.trim() || soruyor || calisiyor} onClick={() => void sor()}>
          {soruyor ? 'Soruluyor…' : '💬 Sor'}
        </button>
        <button className="lz-btn-primary text-sm px-2" disabled={(!istek.trim() && !sohbet.length) || soruyor || calisiyor} onClick={() => void uygula()}>
          {calisiyor ? 'Uygulanıyor…' : '✨ Tarife uygula'}
        </button>
      </div>
      <div ref={alt} />
    </div>
  )
}
